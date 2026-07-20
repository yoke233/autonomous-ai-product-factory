import { Check, ChevronRight, FileText, Lock, X } from "lucide-react";

import { useGoalAction } from "@/api/queries";
import type { Goal, GoalDetail } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { diffSummary, outcomeReason } from "@/domain";
import { cn } from "@/lib/utils";

export function Block({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-5 py-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex size-4 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
          {n}
        </span>
        <span className="text-[13px] font-semibold">{title}</span>
      </div>
      {children}
    </section>
  );
}

export function LoadingDetail() {
  return (
    <div className="space-y-4 px-5 py-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function SummaryBlock({ detail }: { detail: GoalDetail }) {
  const { goal, candidate } = detail;
  const stat = candidate ? diffSummary(candidate.diff_stat) : null;
  return (
    <Block n={1} title="结果摘要">
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{goal.goal_text}</p>
      {candidate ? (
        <>
          <div className="mt-2.5 flex items-center gap-3 text-xs">
            {stat?.files && <span className="text-muted-foreground">{stat.files} 个文件变更</span>}
            {stat?.add && <span className="font-medium text-success">+{stat.add}</span>}
            {stat?.del && <span className="font-medium text-danger">−{stat.del}</span>}
          </div>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-foreground/80">
            {candidate.diff_stat.trim()}
          </pre>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          尚无候选产物（Candidate）。工单仍在生产或未产出可交付变更。
        </p>
      )}
    </Block>
  );
}

export function AssessmentBlock({ detail }: { detail: GoalDetail }) {
  const { assessment } = detail;
  const verdict = assessment?.verdict;
  return (
    <Block n={2} title="验证结论">
      {assessment ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold [&_svg]:size-3.5",
                verdict === "PASS" && "bg-success-soft text-success",
                verdict === "FAIL" && "bg-danger-soft text-danger",
                verdict !== "PASS" && verdict !== "FAIL" && "bg-warning-soft text-warning",
              )}
            >
              {verdict === "FAIL" ? <X /> : <Check />}
              Assessment {verdict}
            </span>
            <span className="text-xs text-muted-foreground">
              {verdict === "PASS"
                ? "构建与测试均通过，可安全交付。"
                : verdict === "FAIL"
                  ? "存在失败的验证项，交付有风险。"
                  : "缺少可执行的验证命令，需自行确认 diff。"}
            </span>
          </div>
          {assessment.evidence.notes && (
            <p className="mt-2 text-xs text-muted-foreground">{assessment.evidence.notes}</p>
          )}
          <div className="mt-2 space-y-1">
            {assessment.evidence.checks.map((c) => (
              <details key={c.name} className="rounded-md border border-border">
                <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs [&_svg]:size-3.5">
                  {c.exitCode === 0 ? <Check className="text-success" /> : <X className="text-danger" />}
                  <span className="font-mono text-foreground/80">{c.command}</span>
                  <span className="ml-auto text-muted-foreground">exit {c.exitCode}</span>
                </summary>
                <pre className="overflow-x-auto border-t border-border bg-muted px-2.5 py-2 font-mono text-xs text-foreground/75">
                  {c.outputTail || "（无输出）"}
                </pre>
              </details>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">尚无验证结论。</p>
      )}
    </Block>
  );
}

export function PlanBlock({ detail }: { detail: GoalDetail }) {
  const { goal, candidate } = detail;
  const reason = outcomeReason(goal);
  return (
    <Block n={3} title="交付计划">
      <dl className="space-y-1.5 text-[13px]">
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-muted-foreground">交付方式</dt>
          <dd className="flex items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{goal.boundary.deliveryMode}</span>
            <span className="text-muted-foreground">仅交付产物，不触碰远端</span>
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-muted-foreground">封存</dt>
          {candidate ? (
            <dd className="flex items-center gap-1.5 font-mono text-xs [&_svg]:size-3.5">
              <Lock className="text-muted-foreground" />
              {candidate.branch}@{candidate.head_commit.slice(0, 7)}
            </dd>
          ) : (
            <dd className="text-muted-foreground">待产出候选后封存 branch@commit</dd>
          )}
        </div>
        {goal.status === "NO_SAFE_DELIVERY" && (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-muted-foreground">无交付</dt>
            <dd className="text-danger">{reason ?? "无安全交付"}</dd>
          </div>
        )}
        {goal.status === "DELIVERED" && (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-muted-foreground">已交付</dt>
            <dd className="text-success">候选已批准并封存</dd>
          </div>
        )}
      </dl>
    </Block>
  );
}

export function GoalActions({ goal, className }: { goal: Goal; className?: string }) {
  const approve = useGoalAction("approve");
  const reject = useGoalAction("reject");
  const cancel = useGoalAction("cancel");
  const busy = approve.isPending || reject.isPending || cancel.isPending;
  const err = approve.error ?? reject.error ?? cancel.error;

  if (!["AWAITING_APPROVAL", "RECEIVED", "RUNNING"].includes(goal.status)) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {goal.status === "AWAITING_APPROVAL" && (
        <>
          <Button disabled={busy} onClick={() => approve.mutate(goal.id)}>
            <Check />
            批准交付
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => reject.mutate(goal.id)}>
            <X />
            否决
          </Button>
          <span className="text-xs text-muted-foreground">决策后封存不可变，可随时回看</span>
        </>
      )}
      {["RECEIVED", "RUNNING"].includes(goal.status) && (
        <Button variant="ghost" disabled={busy} onClick={() => cancel.mutate(goal.id)}>
          <X />
          取消工单
        </Button>
      )}
      {err && <p className="w-full text-xs text-danger">{String(err)}</p>}
    </div>
  );
}

export function GoalSecondary({ detail }: { detail: GoalDetail }) {
  const { candidate, events } = detail;
  const stat = candidate ? diffSummary(candidate.diff_stat) : null;
  return (
    <div className="space-y-1">
      {candidate && (
        <details className="group rounded-md border border-border">
          <summary className="flex cursor-pointer items-center gap-1.5 px-2.5 py-2 text-xs font-medium [&_svg]:size-3.5">
            <ChevronRight className="text-muted-foreground transition-transform group-open:rotate-90" />
            <FileText className="text-muted-foreground" />
            Candidate diff
            <span className="ml-auto text-muted-foreground">
              {stat?.files ? `${stat.files} files` : "补丁"} · {stat?.add ?? 0}/{stat?.del ?? 0}
            </span>
          </summary>
          <pre className="max-h-96 overflow-auto border-t border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-foreground/80">
            {candidate.patch || "（空补丁）"}
          </pre>
        </details>
      )}
      <details className="group rounded-md border border-border">
        <summary className="flex cursor-pointer items-center gap-1.5 px-2.5 py-2 text-xs font-medium [&_svg]:size-3.5">
          <ChevronRight className="text-muted-foreground transition-transform group-open:rotate-90" />
          时间线
          <span className="ml-auto text-muted-foreground">{events.length} 条</span>
        </summary>
        <ul className="border-t border-border px-3 py-2 text-xs">
          {events.length === 0 && <li className="text-muted-foreground">暂无事件</li>}
          {events.map((e) => (
            <li key={e.id} className="flex gap-2 py-0.5">
              <span className="shrink-0 font-mono text-muted-foreground">
                {new Date(e.created_at).toLocaleTimeString()}
              </span>
              <span className="shrink-0 font-medium text-foreground/70">{e.kind}</span>
              <span className="text-foreground/80">{e.message}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
