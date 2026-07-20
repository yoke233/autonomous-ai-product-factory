/** 领域类型 — 词汇与 docs/README.md §4/§7 对齐（切片 v0 只实现主链路子集）。 */

export type GoalStatus =
  | "RECEIVED"
  | "RUNNING"
  | "AWAITING_APPROVAL"
  | "DELIVERED"
  | "NO_SAFE_DELIVERY"
  | "CANCELLED"
  | "SYSTEM_FAULT";

export type RunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type Verdict = "PASS" | "FAIL" | "INCONCLUSIVE";

/** Repo Profile：目标仓库的构建/测试命令声明（v0 最小子集）。 */
export interface RepoProfile {
  buildCommand?: string;
  testCommand?: string;
}

export interface Boundary {
  deliveryMode: "ARTIFACT_ONLY";
  repoProfile: RepoProfile;
}

export interface Goal {
  id: string;
  revision: number;
  repo_path: string;
  goal_text: string;
  boundary: Boundary;
  status: GoalStatus;
  outcome: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  goal_id: string;
  status: RunStatus;
  worktree_path: string | null;
  branch: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface Candidate {
  id: string;
  run_id: string;
  goal_id: string;
  branch: string;
  base_commit: string;
  head_commit: string;
  diff_stat: string;
  patch: string;
  created_at: string;
}

export interface VerificationCheck {
  name: string;
  command: string;
  exitCode: number;
  outputTail: string;
}

export interface Assessment {
  id: string;
  candidate_id: string;
  goal_id: string;
  verdict: Verdict;
  evidence: { checks: VerificationCheck[]; notes?: string };
  created_at: string;
}

export interface FactoryEvent {
  id: number;
  goal_id: string;
  kind: string;
  message: string;
  created_at: string;
}

/** Intake：开工前的需求澄清会话，聊明确后转正式 Goal。 */
export type IntakeStatus = "OPEN" | "STARTED";

export interface IntakeMessage {
  role: "user" | "agent";
  text: string;
  at: string;
}

export interface IntakeDraft {
  goalText: string;
  buildCommand?: string;
  testCommand?: string;
}

export interface Intake {
  id: string;
  repo_path: string;
  messages: IntakeMessage[];
  draft: IntakeDraft | null;
  status: IntakeStatus;
  goal_id: string | null;
  created_at: string;
  updated_at: string;
}
