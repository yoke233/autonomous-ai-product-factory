export type IssueState = "open" | "closed";
export type IssueCloseReason = "completed" | "not_planned" | "unknown";
export type RunState = "queued" | "in_progress" | "waiting" | "completed";
export type RunConclusion = "success" | "failure" | "cancelled" | "timed_out";
export type PullRequestState = "open" | "merged" | "closed";
export type CheckConclusion = "success" | "failure" | "cancelled" | "timed_out";
export type ReviewState = "comment" | "approve" | "request_changes";
export type NotificationDelivery = "sent" | "retrying";

export interface Repository {
  id: string;
  provider: "github";
  fullName: string;
  defaultBranch: string;
  url: string;
  connected: boolean;
  syncedAt: string;
}

export interface Issue {
  id: string;
  providerId: string;
  repositoryId: string;
  number: number;
  title: string;
  body: string;
  state: IssueState;
  closeReason?: IssueCloseReason;
  parentId?: string;
  blockedByIds: string[];
  agentAllowed: boolean;
  selectedPullRequestId?: string;
  labels: string[];
  assignees: string[];
  comments: number;
  updatedAt: string;
  url: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  createdAt: string;
}

export interface Check {
  id: string;
  name: string;
  source: "factory" | "external";
  commitSha: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?: CheckConclusion;
  details: string;
  url?: string;
}

export interface Review {
  id: string;
  state: ReviewState;
  author: string;
  commitSha: string;
  body: string;
  submittedAt: string;
}

export interface PullRequest {
  id: string;
  providerId: string;
  repositoryId: string;
  issueId: string;
  number: number;
  title: string;
  state: PullRequestState;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  mergeable: boolean;
  mergeBlockers: string[];
  commits: Commit[];
  checks: Check[];
  reviews: Review[];
  updatedAt: string;
  url: string;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AcpJsonRpcMessage {
  jsonrpc: "2.0";
  id?: string | number;
  method?: string;
  params?: { [key: string]: JsonValue };
  result?: { [key: string]: JsonValue };
  error?: { code: number; message: string; data?: JsonValue };
}

export interface AcpEvent {
  id: string;
  receivedAt: string;
  direction: "client_to_agent" | "agent_to_client";
  message: AcpJsonRpcMessage;
}

export function isAcpTranscript(value: unknown): value is AcpEvent[] {
  return Array.isArray(value) && value.every((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const event = candidate as Partial<AcpEvent>;
    if (typeof event.id !== "string" || typeof event.receivedAt !== "string" || Number.isNaN(Date.parse(event.receivedAt))) return false;
    if (event.direction !== "client_to_agent" && event.direction !== "agent_to_client") return false;
    if (!event.message || typeof event.message !== "object" || event.message.jsonrpc !== "2.0") return false;
    return Boolean(event.message.method || event.message.result || event.message.error);
  });
}

export interface AgentRun {
  id: string;
  issueId: string;
  pullRequestId?: string;
  state: RunState;
  conclusion?: RunConclusion;
  trigger: "manual" | "dependency_resolved" | "request_changes" | "retry";
  purpose: "implement" | "split";
  triggeredBy: string;
  executor: string;
  startedAt?: string;
  finishedAt?: string;
  waitingReason?: string;
  inputSummary: string;
  graphSummary: string;
  baseSha: string;
  startingHeadSha?: string;
  finalCommitSha?: string;
  acpProtocolVersion: 1;
  acpSessionId: string;
  acpEvents: AcpEvent[];
  cancelRequestedAt?: string;
  createdIssueIds: string[];
  createdDependencies: Array<{ prerequisiteId: string; blockedIssueId: string }>;
  durationMinutes?: number;
  costUsd?: number;
  logSummary: string;
  createdAt: string;
}

export type NotificationKind =
  | "issue_ready"
  | "run_waiting"
  | "run_completed"
  | "issue_split"
  | "review_requested"
  | "changes_requested"
  | "issue_completed"
  | "issue_not_planned"
  | "issue_reopened";

export interface FactoryNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  issueId: string;
  pullRequestId?: string;
  runId?: string;
  createdAt: string;
  read: boolean;
  delivery: NotificationDelivery;
  actionPath: string;
}

export interface IssueDraft {
  repositoryId: string;
  title: string;
  body: string;
  parentId?: string;
  blockedByIds: string[];
  agentAllowed: boolean;
}

export interface ReadinessCheck {
  key: "open" | "children" | "dependencies" | "run" | "permission";
  label: string;
  met: boolean;
  detail: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: "dependency" | "parent";
}

export function subIssuesOf(issues: Issue[], issueId: string): Issue[] {
  return issues.filter((issue) => issue.parentId === issueId);
}

export function graphEdges(issues: Issue[]): GraphEdge[] {
  return issues.flatMap((issue) => [
    ...issue.blockedByIds.map((prerequisiteId) => ({ from: prerequisiteId, to: issue.id, kind: "dependency" as const })),
    ...(issue.parentId ? [{ from: issue.id, to: issue.parentId, kind: "parent" as const }] : []),
  ]);
}

export function graphHasCycle(issues: Issue[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const issue of issues) adjacency.set(issue.id, []);
  for (const edge of graphEdges(issues)) adjacency.get(edge.from)?.push(edge.to);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return issues.some((issue) => visit(issue.id));
}

export function addDependencyToGraph(issues: Issue[], blockedIssueId: string, prerequisiteId: string): Issue[] {
  if (blockedIssueId === prerequisiteId) throw new Error("Issue 不能依赖自己");
  if (!issues.some((issue) => issue.id === blockedIssueId)) throw new Error("被阻塞的 Issue 不存在");
  if (!issues.some((issue) => issue.id === prerequisiteId)) throw new Error("前置 Issue 不存在");
  const next = issues.map((issue) => issue.id === blockedIssueId
    ? { ...issue, blockedByIds: [...new Set([...issue.blockedByIds, prerequisiteId])] }
    : issue);
  if (graphHasCycle(next)) throw new Error("这条依赖会形成环，原 DAG 未改变");
  return next;
}

export function issueReadiness(issue: Issue, issues: Issue[], runs: AgentRun[]): { ready: boolean; checks: ReadinessCheck[] } {
  const children = subIssuesOf(issues, issue.id);
  const blockers = issue.blockedByIds.map((id) => issues.find((candidate) => candidate.id === id)).filter((item): item is Issue => Boolean(item));
  const activeRun = runs.find((run) => run.issueId === issue.id && run.state !== "completed");
  const completed = (candidate: Issue) => candidate.state === "closed" && candidate.closeReason === "completed";
  const checks: ReadinessCheck[] = [
    { key: "open", label: "Issue 仍然打开", met: issue.state === "open", detail: issue.state === "open" ? "可继续推进" : `已关闭 · ${issue.closeReason === "completed" ? "已完成" : issue.closeReason === "not_planned" ? "不再处理" : "原因未知"}` },
    { key: "children", label: "子 Issue 已完成", met: children.every(completed), detail: children.length === 0 ? "没有子 Issue" : `${children.filter(completed).length}/${children.length} 已完成` },
    { key: "dependencies", label: "前置依赖已完成", met: blockers.length === issue.blockedByIds.length && blockers.every(completed), detail: issue.blockedByIds.length === 0 ? "没有前置依赖" : `${blockers.filter(completed).length}/${issue.blockedByIds.length} 已完成` },
    { key: "run", label: "没有进行中的运行", met: !activeRun, detail: activeRun ? `${activeRun.id} · ${runStateLabel(activeRun.state)}` : "执行权空闲" },
    { key: "permission", label: "允许 Agent 接手", met: issue.agentAllowed, detail: issue.agentAllowed ? "已授权" : "等待用户授权" },
  ];
  return { ready: checks.every((check) => check.met), checks };
}

export function issueCloseBlocker(
  issueId: string,
  reason: Exclude<IssueCloseReason, "unknown">,
  issues: Issue[],
  runs: AgentRun[],
): string | undefined {
  const issue = issues.find((candidate) => candidate.id === issueId);
  if (!issue) return "Issue 不存在";
  const activeRun = runs.find((run) => run.issueId === issueId && run.state !== "completed");
  if (activeRun) return `请先取消 ${activeRun.id}`;
  if (reason === "not_planned") return undefined;

  const completed = (candidate: Issue | undefined) => candidate?.state === "closed" && candidate.closeReason === "completed";
  const incompleteChild = issues.find((candidate) => candidate.parentId === issueId && !completed(candidate));
  if (incompleteChild) return `Sub-issue #${incompleteChild.number} 尚未完成`;
  if (issue.blockedByIds.some((id) => !completed(issues.find((candidate) => candidate.id === id)))) return "前置依赖尚未完成";
  return undefined;
}

export function runStateLabel(state: RunState): string {
  return ({ queued: "排队中", in_progress: "运行中", waiting: "等待用户", completed: "已结束" } as const)[state];
}

export function runConclusionLabel(value?: RunConclusion): string {
  if (!value) return "—";
  return ({ success: "成功", failure: "失败", cancelled: "已取消", timed_out: "已超时" } as const)[value];
}

export function issueStateLabel(issue: Issue): string {
  if (issue.state === "open") return "打开";
  if (issue.closeReason === "completed") return "已完成";
  if (issue.closeReason === "not_planned") return "不再处理";
  return "已关闭";
}

export function reviewStateLabel(state: ReviewState): string {
  return ({ comment: "评论", approve: "批准", request_changes: "要求修改" } as const)[state];
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function shortSha(value: string): string {
  return value.slice(0, 7);
}
