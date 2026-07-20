import type { Store } from "./store.js";
import { executeRun, type Producer } from "./runner.js";
import type { Verdict } from "./types.js";

/**
 * 单进程 Worker：轮询认领 QUEUED Run 并驱动主链路
 * RECEIVED → RUNNING → AWAITING_APPROVAL | NO_SAFE_DELIVERY | SYSTEM_FAULT。
 * 发布批准始终留给 Console（M2 监督式语义）。
 */
export class Worker {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private readonly aborts = new Map<string, AbortController>();

  constructor(
    private readonly store: Store,
    private readonly producer: Producer,
    private readonly intervalMs = 1000,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    for (const a of this.aborts.values()) a.abort();
  }

  cancel(goalId: string): void {
    this.aborts.get(goalId)?.abort();
  }

  /** 认领并执行一个 Run；串行（单写者）。 */
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const claimed = await this.store.claimNextRun();
      if (!claimed) return;
      await this.process(claimed.id, claimed.goal_id);
    } finally {
      this.busy = false;
    }
  }

  private async process(runId: string, goalId: string): Promise<void> {
    const store = this.store;
    const goal = await store.getGoal(goalId);
    if (!goal) return;

    if (goal.status === "CANCELLED") {
      await store.updateRun(runId, { status: "CANCELLED", finished: true });
      return;
    }

    if (!(await store.transitionGoal(goalId, goal.revision, "RUNNING"))) {
      await store.updateRun(runId, { status: "CANCELLED", error: "goal revision conflict", finished: true });
      return;
    }
    await store.addEvent(goalId, "run.started", `Run ${runId} 开始执行（隔离 worktree）`);

    const abort = new AbortController();
    this.aborts.set(goalId, abort);
    try {
      const result = await executeRun(goal, runId, this.producer, abort.signal);
      await store.updateRun(runId, {
        status: "SUCCEEDED",
        worktreePath: result.worktreeDir,
        branch: result.branch,
        finished: true,
      });
      const candidate = await store.createCandidate({
        runId,
        goalId,
        branch: result.branch,
        baseCommit: result.baseCommit,
        headCommit: result.headCommit,
        diffStat: result.diffStat,
        patch: result.patch,
      });
      await store.addEvent(goalId, "candidate.sealed", `Candidate 封存于分支 ${result.branch}`);

      const failed = result.checks.filter((c) => c.exitCode !== 0);
      const verdict: Verdict = result.checks.length === 0 ? "INCONCLUSIVE" : failed.length === 0 ? "PASS" : "FAIL";
      await store.createAssessment({
        candidateId: candidate.id,
        goalId,
        verdict,
        checks: result.checks,
        ...(verdict === "INCONCLUSIVE" ? { notes: "Repo Profile 未声明任何验证命令，无法给出 PASS" } : {}),
      });
      await store.addEvent(goalId, "assessment.done", `Assessment: ${verdict}`);

      const fresh = await store.getGoal(goalId);
      if (!fresh || fresh.status === "CANCELLED") return;
      if (verdict === "FAIL") {
        await store.transitionGoal(goalId, fresh.revision, "NO_SAFE_DELIVERY", {
          reason: "verification failed",
          failedChecks: failed.map((c) => c.name),
        });
        await store.addEvent(goalId, "goal.no_safe_delivery", "验证失败，不产生可交付候选");
      } else {
        await store.transitionGoal(goalId, fresh.revision, "AWAITING_APPROVAL");
        await store.addEvent(goalId, "goal.awaiting_approval", "等待发布批准（Console 一次批准制）");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const aborted = abort.signal.aborted;
      await store.updateRun(runId, {
        status: aborted ? "CANCELLED" : "FAILED",
        error: message.slice(0, 4000),
        finished: true,
      });
      const fresh = await store.getGoal(goalId);
      if (fresh && fresh.status !== "CANCELLED") {
        await store.transitionGoal(goalId, fresh.revision, aborted ? "CANCELLED" : "SYSTEM_FAULT", {
          reason: message.slice(0, 1000),
        });
      }
      await store.addEvent(goalId, aborted ? "goal.cancelled" : "run.failed", message.slice(0, 1000));
    } finally {
      this.aborts.delete(goalId);
    }
  }
}
