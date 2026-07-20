import { randomUUID } from "node:crypto";
import type { DB } from "./db.js";
import type {
  Assessment,
  Boundary,
  Candidate,
  FactoryEvent,
  Goal,
  GoalStatus,
  Run,
  RunStatus,
  Verdict,
  VerificationCheck,
} from "./types.js";

/** 所有权威状态迁移集中在此；goal 更新一律带 revision CAS（INV-03 的单机版）。 */
export class Store {
  constructor(private readonly db: DB) {}

  async createGoal(input: { repoPath: string; goalText: string; boundary: Boundary }): Promise<Goal> {
    const id = `g_${randomUUID().slice(0, 8)}`;
    await this.db.query(
      `INSERT INTO goals (id, repo_path, goal_text, boundary, status) VALUES ($1,$2,$3,$4,'RECEIVED')`,
      [id, input.repoPath, input.goalText, JSON.stringify(input.boundary)],
    );
    const runId = `r_${randomUUID().slice(0, 8)}`;
    await this.db.query(`INSERT INTO runs (id, goal_id, status) VALUES ($1,$2,'QUEUED')`, [runId, id]);
    await this.addEvent(id, "goal.received", "Goal 已受理，Run 已入队");
    return (await this.getGoal(id))!;
  }

  async getGoal(id: string): Promise<Goal | null> {
    const r = await this.db.query<Goal>(`SELECT * FROM goals WHERE id = $1`, [id]);
    return r.rows[0] ?? null;
  }

  async listGoals(): Promise<Goal[]> {
    const r = await this.db.query<Goal>(`SELECT * FROM goals ORDER BY created_at DESC`);
    return r.rows;
  }

  /** CAS 迁移；revision 不匹配返回 false（调用方决定重读或放弃）。 */
  async transitionGoal(
    id: string,
    expectedRevision: number,
    to: GoalStatus,
    outcome?: Record<string, unknown>,
  ): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE goals SET status = $1, outcome = COALESCE($2, outcome), revision = revision + 1, updated_at = now()
       WHERE id = $3 AND revision = $4`,
      [to, outcome ? JSON.stringify(outcome) : null, id, expectedRevision],
    );
    return (r.affectedRows ?? 0) > 0;
  }

  /** 原子认领一个 QUEUED Run（单进程内的 claim 语义）。 */
  async claimNextRun(): Promise<(Run & { goal: Goal }) | null> {
    const r = await this.db.query<Run>(
      `UPDATE runs SET status = 'RUNNING'
       WHERE id = (SELECT id FROM runs WHERE status = 'QUEUED' ORDER BY created_at LIMIT 1)
       RETURNING *`,
    );
    const run = r.rows[0];
    if (!run) return null;
    const goal = await this.getGoal(run.goal_id);
    if (!goal) return null;
    return { ...run, goal };
  }

  async updateRun(
    id: string,
    patch: { status?: RunStatus; worktreePath?: string; branch?: string; error?: string; finished?: boolean },
  ): Promise<void> {
    await this.db.query(
      `UPDATE runs SET
         status        = COALESCE($1, status),
         worktree_path = COALESCE($2, worktree_path),
         branch        = COALESCE($3, branch),
         error         = COALESCE($4, error),
         finished_at   = CASE WHEN $5 THEN now() ELSE finished_at END
       WHERE id = $6`,
      [patch.status ?? null, patch.worktreePath ?? null, patch.branch ?? null, patch.error ?? null, patch.finished ?? false, id],
    );
  }

  async getRuns(goalId: string): Promise<Run[]> {
    const r = await this.db.query<Run>(`SELECT * FROM runs WHERE goal_id = $1 ORDER BY created_at`, [goalId]);
    return r.rows;
  }

  async createCandidate(input: {
    runId: string;
    goalId: string;
    branch: string;
    baseCommit: string;
    headCommit: string;
    diffStat: string;
    patch: string;
  }): Promise<Candidate> {
    const id = `c_${randomUUID().slice(0, 8)}`;
    await this.db.query(
      `INSERT INTO candidates (id, run_id, goal_id, branch, base_commit, head_commit, diff_stat, patch)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, input.runId, input.goalId, input.branch, input.baseCommit, input.headCommit, input.diffStat, input.patch],
    );
    const r = await this.db.query<Candidate>(`SELECT * FROM candidates WHERE id = $1`, [id]);
    return r.rows[0]!;
  }

  async getCandidate(goalId: string): Promise<Candidate | null> {
    const r = await this.db.query<Candidate>(
      `SELECT * FROM candidates WHERE goal_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [goalId],
    );
    return r.rows[0] ?? null;
  }

  async createAssessment(input: {
    candidateId: string;
    goalId: string;
    verdict: Verdict;
    checks: VerificationCheck[];
    notes?: string;
  }): Promise<Assessment> {
    const id = `a_${randomUUID().slice(0, 8)}`;
    await this.db.query(
      `INSERT INTO assessments (id, candidate_id, goal_id, verdict, evidence) VALUES ($1,$2,$3,$4,$5)`,
      [id, input.candidateId, input.goalId, input.verdict, JSON.stringify({ checks: input.checks, notes: input.notes })],
    );
    const r = await this.db.query<Assessment>(`SELECT * FROM assessments WHERE id = $1`, [id]);
    return r.rows[0]!;
  }

  async getAssessment(goalId: string): Promise<Assessment | null> {
    const r = await this.db.query<Assessment>(
      `SELECT * FROM assessments WHERE goal_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [goalId],
    );
    return r.rows[0] ?? null;
  }

  async addEvent(goalId: string, kind: string, message: string): Promise<void> {
    await this.db.query(`INSERT INTO events (goal_id, kind, message) VALUES ($1,$2,$3)`, [goalId, kind, message]);
  }

  async getEvents(goalId: string): Promise<FactoryEvent[]> {
    const r = await this.db.query<FactoryEvent>(
      `SELECT * FROM events WHERE goal_id = $1 ORDER BY id`,
      [goalId],
    );
    return r.rows;
  }
}
