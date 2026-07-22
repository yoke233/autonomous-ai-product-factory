import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  addDependencyToGraph,
  graphHasCycle,
  isAcpTranscript,
  issueCloseBlocker,
  issueReadiness,
  type AcpEvent,
  type AgentRun,
  type FactoryNotification,
  type Issue,
  type IssueCloseReason,
  type IssueDraft,
  type JsonValue,
  type PullRequest,
  type Repository,
  type ReviewState,
} from "@/domain";

const STORAGE_KEY = "factory-console-v8";

const repositories: Repository[] = [{
  id: "repo-checkout",
  provider: "github",
  fullName: "commerce/checkout-service",
  defaultBranch: "main",
  url: "https://github.com/commerce/checkout-service",
  connected: true,
  syncedAt: "2026-07-22T09:42:00.000Z",
}];

const seedIssues: Issue[] = [
  {
    id: "issue-184", providerId: "GI_kw184", repositoryId: "repo-checkout", number: 184,
    title: "完善结算链路的可靠性", body: "拆分并完成结算链路的幂等、冲突可观察性和回归保护。",
    state: "open", blockedByIds: [], agentAllowed: true, labels: ["epic", "payments"], assignees: ["你"], comments: 8,
    updatedAt: "2026-07-22T09:38:00.000Z", url: "https://github.com/commerce/checkout-service/issues/184",
  },
  {
    id: "issue-185", providerId: "GI_kw185", repositoryId: "repo-checkout", number: 185,
    title: "阻止结算接口重复扣款", body: "相同幂等键在重试和并发请求下只能产生一次扣款。",
    state: "closed", closeReason: "completed", parentId: "issue-184", blockedByIds: [], agentAllowed: true,
    selectedPullRequestId: "pr-399", labels: ["backend"], assignees: ["Agent"], comments: 12,
    updatedAt: "2026-07-22T08:10:00.000Z", url: "https://github.com/commerce/checkout-service/issues/185",
  },
  {
    id: "issue-186", providerId: "GI_kw186", repositoryId: "repo-checkout", number: 186,
    title: "记录并发扣款冲突", body: "记录冲突请求的摘要和关联支付，但不得泄露支付信息。",
    state: "open", parentId: "issue-184", blockedByIds: ["issue-185"], agentAllowed: true,
    selectedPullRequestId: "pr-412", labels: ["backend", "observability"], assignees: ["Agent"], comments: 6,
    updatedAt: "2026-07-22T09:41:00.000Z", url: "https://github.com/commerce/checkout-service/issues/186",
  },
  {
    id: "issue-187", providerId: "GI_kw187", repositoryId: "repo-checkout", number: 187,
    title: "补充结算回归与并发测试", body: "覆盖重复请求、并发竞争和日志脱敏场景。",
    state: "open", parentId: "issue-184", blockedByIds: ["issue-186"], agentAllowed: true,
    labels: ["tests"], assignees: [], comments: 2,
    updatedAt: "2026-07-22T08:40:00.000Z", url: "https://github.com/commerce/checkout-service/issues/187",
  },
  {
    id: "issue-201", providerId: "GI_kw201", repositoryId: "repo-checkout", number: 201,
    title: "导出审计记录为 CSV", body: "提供异步、流式的审计导出，不阻塞在线请求。",
    state: "closed", closeReason: "completed", blockedByIds: [], agentAllowed: true,
    selectedPullRequestId: "pr-388", labels: ["admin"], assignees: ["你"], comments: 9,
    updatedAt: "2026-07-21T16:20:00.000Z", url: "https://github.com/commerce/checkout-service/issues/201",
  },
  {
    id: "issue-223", providerId: "GI_kw223", repositoryId: "repo-checkout", number: 223,
    title: "降低用户资料接口延迟", body: "把 P95 延迟降到 120ms 以下，并保证缓存及时失效。",
    state: "open", blockedByIds: [], agentAllowed: false, labels: ["performance"], assignees: ["你"], comments: 3,
    updatedAt: "2026-07-22T09:12:00.000Z", url: "https://github.com/commerce/checkout-service/issues/223",
  },
  {
    id: "issue-231", providerId: "GI_kw231", repositoryId: "repo-checkout", number: 231,
    title: "迁移旧支付指标", body: "旧指标方案已经放弃，下游方案需要重新选择前置。",
    state: "closed", closeReason: "not_planned", blockedByIds: [], agentAllowed: false, labels: ["metrics"], assignees: [], comments: 1,
    updatedAt: "2026-07-20T04:12:00.000Z", url: "https://github.com/commerce/checkout-service/issues/231",
  },
  {
    id: "issue-232", providerId: "GI_kw232", repositoryId: "repo-checkout", number: 232,
    title: "统一支付指标面板", body: "等待新的指标迁移方案。",
    state: "open", blockedByIds: ["issue-231"], agentAllowed: true, labels: ["metrics"], assignees: [], comments: 0,
    updatedAt: "2026-07-21T04:12:00.000Z", url: "https://github.com/commerce/checkout-service/issues/232",
  },
];

const seedPullRequests: PullRequest[] = [
  {
    id: "pr-412", providerId: "PR_kw412", repositoryId: "repo-checkout", issueId: "issue-186", number: 412,
    title: "记录并发扣款冲突并完成脱敏", state: "open", baseBranch: "main", headBranch: "agent/issue-186-conflict-log",
    headSha: "b6f8c21d9e4", mergeable: false, mergeBlockers: ["外部检查仍在运行", "需要最新提交获得批准"],
    commits: [
      { sha: "9ac41f20a1", message: "feat: add conflict audit record", author: "factory-agent", createdAt: "2026-07-22T08:32:00.000Z" },
      { sha: "b6f8c21d9e4", message: "fix: redact payment metadata", author: "factory-agent", createdAt: "2026-07-22T09:35:00.000Z" },
    ],
    checks: [
      { id: "check-agent-412", name: "Agent 本地验证", source: "factory", commitSha: "b6f8c21d9e4", status: "completed", conclusion: "success", details: "单元测试 38/38；类型检查通过" },
      { id: "check-ci-412", name: "GitHub Actions / test", source: "external", commitSha: "b6f8c21d9e4", status: "in_progress", details: "由仓库现有 CI 执行", url: "https://github.com/commerce/checkout-service/actions" },
    ],
    reviews: [
      { id: "review-412-1", state: "request_changes", author: "lin", commitSha: "9ac41f20a1", body: "日志里仍然包含完整支付标识，请完成脱敏后重新请求审核。", submittedAt: "2026-07-22T09:02:00.000Z" },
    ],
    updatedAt: "2026-07-22T09:41:00.000Z", url: "https://github.com/commerce/checkout-service/pull/412",
  },
  {
    id: "pr-399", providerId: "PR_kw399", repositoryId: "repo-checkout", issueId: "issue-185", number: 399,
    title: "为扣款请求增加幂等保护", state: "merged", baseBranch: "main", headBranch: "agent/issue-185-idempotency",
    headSha: "7a0e113c21f", mergeable: true, mergeBlockers: [],
    commits: [{ sha: "7a0e113c21f", message: "feat: guard duplicate payment", author: "factory-agent", createdAt: "2026-07-22T07:44:00.000Z" }],
    checks: [{ id: "check-399", name: "Agent 本地验证", source: "factory", commitSha: "7a0e113c21f", status: "completed", conclusion: "success", details: "并发测试通过" }],
    reviews: [{ id: "review-399", state: "approve", author: "你", commitSha: "7a0e113c21f", body: "幂等边界和并发覆盖符合要求。", submittedAt: "2026-07-22T08:01:00.000Z" }],
    updatedAt: "2026-07-22T08:08:00.000Z", url: "https://github.com/commerce/checkout-service/pull/399",
  },
  {
    id: "pr-388", providerId: "PR_kw388", repositoryId: "repo-checkout", issueId: "issue-201", number: 388,
    title: "异步导出审计记录", state: "merged", baseBranch: "main", headBranch: "agent/issue-201-audit-export",
    headSha: "fe17a88c301", mergeable: true, mergeBlockers: [],
    commits: [{ sha: "fe17a88c301", message: "feat: stream audit exports", author: "factory-agent", createdAt: "2026-07-21T15:21:00.000Z" }],
    checks: [{ id: "check-388", name: "GitHub Actions / test", source: "external", commitSha: "fe17a88c301", status: "completed", conclusion: "success", details: "功能和负载测试通过" }],
    reviews: [{ id: "review-388", state: "approve", author: "lin", commitSha: "fe17a88c301", body: "通过。", submittedAt: "2026-07-21T16:02:00.000Z" }],
    updatedAt: "2026-07-21T16:18:00.000Z", url: "https://github.com/commerce/checkout-service/pull/388",
  },
];

function transcriptTime(startedAt: string, minuteOffset: number): string {
  return new Date(Date.parse(startedAt) + minuteOffset * 60_000).toISOString();
}

function seedAcpTranscript(input: {
  sessionId: string;
  issueNumber: number;
  prompt: string;
  file: string;
  toolTitle: string;
  startedAt: string;
  completed: boolean;
  finalMessage: string;
}): AcpEvent[] {
  const event = (id: string, minuteOffset: number, direction: AcpEvent["direction"], message: AcpEvent["message"]): AcpEvent => ({
    id: `${input.sessionId}-${id}`,
    receivedAt: transcriptTime(input.startedAt, minuteOffset),
    direction,
    message,
  });
  const session = { sessionId: input.sessionId };
  const newRequestId = `new-${input.sessionId}`;
  const promptRequestId = `prompt-${input.sessionId}`;
  const events: AcpEvent[] = [
    event("session-new", 0, "client_to_agent", {
      jsonrpc: "2.0", id: newRequestId, method: "session/new",
      params: { cwd: "D:/workspace", mcpServers: [] },
    }),
    event("session-created", 0, "agent_to_client", {
      jsonrpc: "2.0", id: newRequestId, result: { sessionId: input.sessionId },
    }),
    event("prompt", 0, "client_to_agent", {
      jsonrpc: "2.0", id: promptRequestId, method: "session/prompt",
      params: { ...session, prompt: [{ type: "text", text: input.prompt }] },
    }),
    event("plan", 1, "agent_to_client", {
      jsonrpc: "2.0", method: "session/update",
      params: { ...session, update: { sessionUpdate: "plan", entries: [
        { content: "读取 Issue、Review 与相关代码", priority: "high", status: "completed" },
        { content: "修改实现并运行验证", priority: "high", status: input.completed ? "completed" : "in_progress" },
        { content: "更新 Pull Request", priority: "medium", status: input.completed ? "completed" : "pending" },
      ] } },
    }),
    event("message-1", 1, "agent_to_client", {
      jsonrpc: "2.0", method: "session/update",
      params: { ...session, update: { sessionUpdate: "agent_message_chunk", messageId: "msg-1", content: { type: "text", text: `我先检查 Issue #${input.issueNumber} 的当前代码和约束。` } } },
    }),
    event("thought-1", 2, "agent_to_client", {
      jsonrpc: "2.0", method: "session/update",
      params: { ...session, update: { sessionUpdate: "agent_thought_chunk", messageId: "thought-1", content: { type: "text", text: "需要先确认当前实现，再选择最小改动范围。" } } },
    }),
    event("tool-call", 2, "agent_to_client", {
      jsonrpc: "2.0", method: "session/update",
      params: { ...session, update: { sessionUpdate: "tool_call", toolCallId: "call-1", title: input.toolTitle, kind: "edit", status: "pending", locations: [{ path: input.file }], rawInput: { path: input.file } } },
    }),
    event("permission", 2, "agent_to_client", {
      jsonrpc: "2.0", id: `permission-${input.sessionId}`, method: "session/request_permission",
      params: { ...session, toolCall: { toolCallId: "call-1" }, options: [
        { optionId: "allow-once", name: "本次允许", kind: "allow_once" },
        { optionId: "reject-once", name: "拒绝", kind: "reject_once" },
      ] },
    }),
    event("permission-result", 2, "client_to_agent", {
      jsonrpc: "2.0", id: `permission-${input.sessionId}`, result: { outcome: { outcome: "selected", optionId: "allow-once" } },
    }),
    event("tool-progress", 3, "agent_to_client", {
      jsonrpc: "2.0", method: "session/update",
      params: { ...session, update: { sessionUpdate: "tool_call_update", toolCallId: "call-1", status: "in_progress", content: [{ type: "content", content: { type: "text", text: "正在修改并运行相关验证。" } }] } },
    }),
  ];
  if (!input.completed) return events;
  return [
    ...events,
    event("tool-complete", 6, "agent_to_client", {
      jsonrpc: "2.0", method: "session/update",
      params: { ...session, update: { sessionUpdate: "tool_call_update", toolCallId: "call-1", status: "completed", content: [
        { type: "diff", path: input.file, oldText: "// previous implementation", newText: "// updated implementation" },
        { type: "content", content: { type: "text", text: "本地测试与类型检查通过。" } },
      ], rawOutput: { exitCode: 0 } } },
    }),
    event("message-2", 7, "agent_to_client", {
      jsonrpc: "2.0", method: "session/update",
      params: { ...session, update: { sessionUpdate: "agent_message_chunk", messageId: "msg-2", content: { type: "text", text: input.finalMessage } } },
    }),
    event("usage", 7, "agent_to_client", {
      jsonrpc: "2.0", method: "session/update",
      params: { ...session, update: { sessionUpdate: "usage_update", used: 18_420, size: 200_000, cost: { amount: 0.32, currency: "USD" } } },
    }),
    event("prompt-result", 8, "agent_to_client", { jsonrpc: "2.0", id: promptRequestId, result: { stopReason: "end_turn" } }),
  ];
}

const seedRuns: AgentRun[] = [
  {
    id: "run-104", issueId: "issue-186", pullRequestId: "pr-412", state: "in_progress", trigger: "request_changes", purpose: "implement",
    triggeredBy: "你", executor: "Codex Worker · 香港-03", startedAt: "2026-07-22T09:18:00.000Z",
    inputSummary: "Issue #186、6 条评论、Review review-412-1", graphSummary: "前置 #185 completed；Parent #184；下游 #187",
    baseSha: "4e90ca1", startingHeadSha: "9ac41f20a1", acpProtocolVersion: 1, acpSessionId: "sess_run_104",
    acpEvents: seedAcpTranscript({ sessionId: "sess_run_104", issueNumber: 186, prompt: "处理 PR #412 的 Review 意见：完成日志脱敏并验证并发场景。", file: "src/checkout/conflict-log.ts", toolTitle: "修改冲突日志脱敏", startedAt: "2026-07-22T09:18:00.000Z", completed: false, finalMessage: "" }),
    createdIssueIds: [], createdDependencies: [],
    logSummary: "正在运行并发场景，随后将更新 PR #412。", createdAt: "2026-07-22T09:18:00.000Z",
  },
  {
    id: "run-103", issueId: "issue-186", pullRequestId: "pr-412", state: "completed", conclusion: "success", trigger: "manual", purpose: "implement",
    triggeredBy: "你", executor: "Codex Worker · 香港-03", startedAt: "2026-07-22T08:18:00.000Z", finishedAt: "2026-07-22T08:56:00.000Z",
    inputSummary: "Issue #186 初始正文和 4 条评论", graphSummary: "前置 #185 completed；Parent #184",
    baseSha: "4e90ca1", finalCommitSha: "9ac41f20a1", acpProtocolVersion: 1, acpSessionId: "sess_run_103",
    acpEvents: seedAcpTranscript({ sessionId: "sess_run_103", issueNumber: 186, prompt: "实现并发扣款冲突日志并创建 Pull Request。", file: "src/checkout/conflict-log.ts", toolTitle: "实现冲突日志", startedAt: "2026-07-22T08:18:00.000Z", completed: true, finalMessage: "实现和本地验证完成，已创建 PR #412。" }),
    createdIssueIds: [], createdDependencies: [], durationMinutes: 38, costUsd: 2.41,
    logSummary: "代码和本地验证已完成；后续 Review 要求继续修改。", createdAt: "2026-07-22T08:18:00.000Z",
  },
  {
    id: "run-87", issueId: "issue-185", pullRequestId: "pr-399", state: "completed", conclusion: "success", trigger: "manual", purpose: "implement",
    triggeredBy: "你", executor: "Codex Worker · 香港-02", startedAt: "2026-07-22T07:10:00.000Z", finishedAt: "2026-07-22T07:48:00.000Z",
    inputSummary: "Issue #185 和验收评论", graphSummary: "Parent #184；无前置依赖", baseSha: "81a20cd", finalCommitSha: "7a0e113c21f",
    acpProtocolVersion: 1, acpSessionId: "sess_run_87",
    acpEvents: seedAcpTranscript({ sessionId: "sess_run_87", issueNumber: 185, prompt: "实现扣款幂等保护并补充并发测试。", file: "src/checkout/idempotency.ts", toolTitle: "实现幂等保护", startedAt: "2026-07-22T07:10:00.000Z", completed: true, finalMessage: "幂等保护和并发测试已完成，已更新 PR #399。" }),
    createdIssueIds: [], createdDependencies: [], durationMinutes: 38, costUsd: 1.92, logSummary: "完成代码和本地验证，等待 Review。", createdAt: "2026-07-22T07:10:00.000Z",
  },
];

const seedNotifications: FactoryNotification[] = [
  { id: "notice-1", kind: "changes_requested", title: "PR #412 被要求修改", body: "日志仍包含完整支付标识，Agent 已开始处理。", issueId: "issue-186", pullRequestId: "pr-412", runId: "run-104", createdAt: "2026-07-22T09:03:00.000Z", read: false, delivery: "sent", actionPath: "/pulls/pr-412" },
  { id: "notice-2", kind: "issue_ready", title: "Issue #186 已解除阻塞", body: "前置 Issue #185 已完成，可以接手。", issueId: "issue-186", createdAt: "2026-07-22T08:11:00.000Z", read: true, delivery: "sent", actionPath: "/issues/issue-186" },
  { id: "notice-3", kind: "issue_completed", title: "Issue #185 已完成", body: "PR #399 已合并；Parent #184 进度 1/3。", issueId: "issue-185", pullRequestId: "pr-399", createdAt: "2026-07-22T08:10:00.000Z", read: false, delivery: "sent", actionPath: "/issues/issue-185" },
  { id: "notice-4", kind: "issue_not_planned", title: "Issue #231 不再处理", body: "下游 Issue #232 仍被阻塞，需要重新选择前置。", issueId: "issue-231", createdAt: "2026-07-20T04:13:00.000Z", read: false, delivery: "retrying", actionPath: "/issues/issue-231" },
];

interface StoredFactory {
  schemaVersion: 8;
  dataVersion: number;
  repositories: Repository[];
  issues: Issue[];
  pullRequests: PullRequest[];
  runs: AgentRun[];
  notifications: FactoryNotification[];
}

interface FactoryContextValue extends StoredFactory {
  unreadCount: number;
  createIssue: (draft: IssueDraft) => string;
  startRun: (issueId: string, purpose?: "implement" | "split", trigger?: AgentRun["trigger"]) => string;
  cancelRun: (runId: string) => void;
  retryRun: (runId: string) => string;
  setAgentAllowed: (issueId: string, allowed: boolean) => void;
  addDependency: (blockedIssueId: string, prerequisiteId: string) => void;
  closeIssue: (issueId: string, reason: Exclude<IssueCloseReason, "unknown">) => void;
  reopenIssue: (issueId: string) => void;
  submitReview: (pullRequestId: string, state: ReviewState, body: string) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  resetDemo: () => void;
}

const FactoryContext = createContext<FactoryContextValue | null>(null);

function seedStore(): StoredFactory {
  return { schemaVersion: 8, dataVersion: 0, repositories: structuredClone(repositories), issues: structuredClone(seedIssues), pullRequests: structuredClone(seedPullRequests), runs: structuredClone(seedRuns), notifications: structuredClone(seedNotifications) };
}

function parseStored(raw: string | null): StoredFactory | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredFactory>;
    if (value.schemaVersion !== 8 || !Array.isArray(value.issues) || !Array.isArray(value.pullRequests) || !Array.isArray(value.runs) || !value.runs.every((run) => isAcpTranscript(run.acpEvents)) || !Array.isArray(value.notifications) || !Array.isArray(value.repositories)) return null;
    return value as StoredFactory;
  } catch {
    return null;
  }
}

function readInitial(): StoredFactory {
  return parseStored(window.sessionStorage.getItem(STORAGE_KEY)) ?? seedStore();
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function makeAcpEvent(direction: AcpEvent["direction"], message: AcpEvent["message"], receivedAt = new Date().toISOString()): AcpEvent {
  return { id: makeId("acp"), receivedAt, direction, message };
}

function acpUpdate(run: AgentRun, update: { [key: string]: JsonValue }, receivedAt?: string): AcpEvent {
  return makeAcpEvent("agent_to_client", {
    jsonrpc: "2.0",
    method: "session/update",
    params: { sessionId: run.acpSessionId, update },
  }, receivedAt);
}

function promptRequestId(run: AgentRun): string | number | undefined {
  return run.acpEvents.find((event) => event.message.method === "session/prompt")?.message.id;
}

export function FactoryProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoredFactory>(readInitial);
  const storeRef = useRef(store);

  function update(producer: (current: StoredFactory) => Omit<StoredFactory, "schemaVersion" | "dataVersion">) {
    const current = storeRef.current;
    const data = producer(current);
    const next: StoredFactory = { ...data, schemaVersion: 8, dataVersion: current.dataVersion + 1 };
    storeRef.current = next;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setStore(next);
  }

  useEffect(() => {
    const cancelling = store.runs.find((run) => run.state !== "completed" && run.cancelRequestedAt);
    const queued = store.runs.find((run) => run.executor === "本地演示 Agent" && run.state === "queued");
    const running = store.runs.find((run) => run.executor === "本地演示 Agent" && run.state === "in_progress");
    const target = cancelling ?? queued ?? running;
    if (!target) return;
    const timer = window.setTimeout(() => {
      update((current) => {
        const run = current.runs.find((candidate) => candidate.id === target.id);
        if (!run) return current;
        if (run.state === "completed") return current;
        const runIssue = current.issues.find((candidate) => candidate.id === run.issueId);
        if (!runIssue || runIssue.state !== "open") return current;
        if (run.cancelRequestedAt) {
          const now = new Date(Math.max(Date.now(), Date.parse(run.startedAt ?? run.createdAt) + 1_000)).toISOString();
          const finalEvents = [
            acpUpdate(run, { sessionUpdate: "agent_message_chunk", messageId: "msg-cancelled", content: { type: "text", text: "已停止当前工作并完成必要的清理。" } }, now),
            makeAcpEvent("agent_to_client", { jsonrpc: "2.0", id: promptRequestId(run) ?? "prompt-unknown", result: { stopReason: "cancelled" } }, now),
          ];
          const notification: FactoryNotification = { id: makeId("notice"), kind: "run_completed", title: `Run ${run.id} 已取消`, body: "Agent 已确认本轮停止；Issue 保持打开。", issueId: run.issueId, runId: run.id, createdAt: now, read: false, delivery: "sent", actionPath: `/runs/${run.id}` };
          return {
            ...current,
            runs: current.runs.map((candidate) => candidate.id === run.id ? { ...candidate, state: "completed", conclusion: "cancelled", finishedAt: now, acpEvents: [...candidate.acpEvents, ...finalEvents], logSummary: "Agent 已确认取消；Issue 保持打开。" } : candidate),
            notifications: [notification, ...current.notifications],
          };
        }
        if (run.state === "queued") {
          const now = new Date().toISOString();
          const events = [
            acpUpdate(run, { sessionUpdate: "plan", entries: [
              { content: "读取 Issue 和代码", priority: "high", status: "in_progress" },
              { content: run.purpose === "split" ? "拆分 Sub-issues" : "修改代码并验证", priority: "high", status: "pending" },
            ] }, now),
            acpUpdate(run, { sessionUpdate: "agent_message_chunk", messageId: "msg-start", content: { type: "text", text: "我已经读取 Issue 和关系图，开始处理。" } }, now),
          ];
          return { ...current, runs: current.runs.map((candidate) => candidate.id === run.id ? { ...candidate, state: "in_progress", startedAt: now, acpEvents: [...candidate.acpEvents, ...events], logSummary: "Agent 已读取 Issue 和关系图，正在执行。" } : candidate) };
        }

        const now = new Date().toISOString();
        if (run.purpose === "split") {
          const parent = current.issues.find((issue) => issue.id === run.issueId);
          if (!parent) return current;
          const childId = makeId("issue");
          const nextNumber = Math.max(...current.issues.map((issue) => issue.number)) + 1;
          const child: Issue = { id: childId, providerId: makeId("github-issue"), repositoryId: parent.repositoryId, number: nextNumber, title: `${parent.title} · 实现子项`, body: "Agent 根据父 Issue 建议的新子项，请继续补充具体范围。", state: "open", parentId: parent.id, blockedByIds: [], agentAllowed: true, labels: ["agent-created"], assignees: [], comments: 0, updatedAt: now, url: `${parent.url.split("/issues/")[0]}/issues/${nextNumber}` };
          const completedEvents = [
            acpUpdate(run, { sessionUpdate: "tool_call", toolCallId: "call-create-sub-issue", title: `创建 Sub-issue #${nextNumber}`, kind: "other", status: "pending", rawInput: { parentIssue: parent.number } }, now),
            acpUpdate(run, { sessionUpdate: "tool_call_update", toolCallId: "call-create-sub-issue", status: "completed", rawOutput: { issueNumber: nextNumber, issueId: childId } }, now),
            acpUpdate(run, { sessionUpdate: "agent_message_chunk", messageId: "msg-finish", content: { type: "text", text: `完成拆分，已创建 Sub-issue #${nextNumber}；父 Issue 保持打开。` } }, now),
            makeAcpEvent("agent_to_client", { jsonrpc: "2.0", id: promptRequestId(run) ?? "prompt-unknown", result: { stopReason: "end_turn" } }, now),
          ];
          const completedRun: AgentRun = { ...run, state: "completed", conclusion: "success", finishedAt: now, createdIssueIds: [childId], acpEvents: [...run.acpEvents, ...completedEvents], logSummary: "完成 Issue 拆分；父 Issue 保持打开。", durationMinutes: 2, costUsd: 0.18 };
          const notification: FactoryNotification = { id: makeId("notice"), kind: "issue_split", title: `Issue #${parent.number} 已拆分`, body: `创建了 Sub-issue #${nextNumber}，父 Issue 保持打开。`, issueId: parent.id, runId: run.id, createdAt: now, read: false, delivery: "sent", actionPath: `/issues/${parent.id}` };
          return { ...current, issues: [...current.issues, child], runs: current.runs.map((candidate) => candidate.id === run.id ? completedRun : candidate), notifications: [notification, ...current.notifications] };
        }

        const issue = current.issues.find((candidate) => candidate.id === run.issueId);
        if (!issue) return current;
        const existingPr = issue.selectedPullRequestId ? current.pullRequests.find((pr) => pr.id === issue.selectedPullRequestId) : undefined;
        const commitSha = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
        const pullRequestId = existingPr?.id ?? makeId("pr");
        const prNumber = existingPr?.number ?? Math.max(...current.pullRequests.map((pr) => pr.number)) + 1;
        const nextPr: PullRequest = existingPr ? {
          ...existingPr,
          headSha: commitSha,
          commits: [...existingPr.commits, { sha: commitSha, message: `fix: address issue #${issue.number}`, author: "factory-agent", createdAt: now }],
          checks: [...existingPr.checks, { id: makeId("check"), name: "Agent 本地验证", source: "factory", commitSha, status: "completed", conclusion: "success", details: "演示检查通过" }],
          mergeable: false,
          mergeBlockers: ["等待最新提交 Review"],
          updatedAt: now,
        } : {
          id: pullRequestId, providerId: makeId("github-pr"), repositoryId: issue.repositoryId, issueId: issue.id, number: prNumber,
          title: issue.title, state: "open", baseBranch: "main", headBranch: `agent/issue-${issue.number}`, headSha: commitSha,
          mergeable: false, mergeBlockers: ["等待 Review"], commits: [{ sha: commitSha, message: `feat: resolve issue #${issue.number}`, author: "factory-agent", createdAt: now }],
          checks: [{ id: makeId("check"), name: "Agent 本地验证", source: "factory", commitSha, status: "completed", conclusion: "success", details: "演示检查通过" }], reviews: [], updatedAt: now,
          url: `https://github.com/commerce/checkout-service/pull/${prNumber}`,
        };
        const completedEvents = [
          acpUpdate(run, { sessionUpdate: "tool_call", toolCallId: "call-edit", title: `修改 Issue #${issue.number} 相关代码`, kind: "edit", status: "pending", rawInput: { issueNumber: issue.number } }, now),
          acpUpdate(run, { sessionUpdate: "tool_call_update", toolCallId: "call-edit", status: "completed", content: [{ type: "content", content: { type: "text", text: "代码修改完成。" } }], rawOutput: { commitSha } }, now),
          acpUpdate(run, { sessionUpdate: "tool_call", toolCallId: "call-test", title: "运行 pnpm test", kind: "execute", status: "pending", rawInput: { command: "pnpm test" } }, now),
          acpUpdate(run, { sessionUpdate: "tool_call_update", toolCallId: "call-test", status: "completed", content: [{ type: "content", content: { type: "text", text: "测试通过。" } }], rawOutput: { exitCode: 0 } }, now),
          acpUpdate(run, { sessionUpdate: "agent_message_chunk", messageId: "msg-finish", content: { type: "text", text: `代码和本地验证已完成，已更新 PR #${prNumber}。` } }, now),
          acpUpdate(run, { sessionUpdate: "usage_update", used: 12_640, size: 200_000, cost: { amount: 0.32, currency: "USD" } }, now),
          makeAcpEvent("agent_to_client", { jsonrpc: "2.0", id: promptRequestId(run) ?? "prompt-unknown", result: { stopReason: "end_turn" } }, now),
        ];
        const completedRun: AgentRun = { ...run, pullRequestId, state: "completed", conclusion: "success", finishedAt: now, finalCommitSha: commitSha, acpEvents: [...run.acpEvents, ...completedEvents], durationMinutes: 4, costUsd: 0.32, logSummary: "代码和本地验证已完成，PR 等待人工 Review。" };
        const notification: FactoryNotification = { id: makeId("notice"), kind: "review_requested", title: `PR #${prNumber} 等待 Review`, body: `Run ${run.id} 已成功，最新提交 ${commitSha.slice(0, 7)}。`, issueId: issue.id, pullRequestId, runId: run.id, createdAt: now, read: false, delivery: "sent", actionPath: `/pulls/${pullRequestId}` };
        return {
          ...current,
          issues: current.issues.map((candidate) => candidate.id === issue.id ? { ...candidate, selectedPullRequestId: pullRequestId, updatedAt: now } : candidate),
          pullRequests: existingPr ? current.pullRequests.map((pr) => pr.id === existingPr.id ? nextPr : pr) : [nextPr, ...current.pullRequests],
          runs: current.runs.map((candidate) => candidate.id === run.id ? completedRun : candidate),
          notifications: [notification, ...current.notifications],
        };
      });
    }, queued ? 700 : 1700);
    return () => window.clearTimeout(timer);
  }, [store.dataVersion]);

  function createIssue(draft: IssueDraft): string {
    const id = makeId("issue");
    update((current) => {
      const number = Math.max(...current.issues.map((issue) => issue.number)) + 1;
      const issue: Issue = { id, providerId: makeId("github-issue"), repositoryId: draft.repositoryId, number, title: draft.title.trim(), body: draft.body.trim(), state: "open", parentId: draft.parentId || undefined, blockedByIds: draft.blockedByIds, agentAllowed: draft.agentAllowed, labels: [], assignees: ["你"], comments: 0, updatedAt: new Date().toISOString(), url: `https://github.com/commerce/checkout-service/issues/${number}` };
      const issues = [issue, ...current.issues];
      if (graphHasCycle(issues)) throw new Error("这个父子关系或依赖会形成环");
      return { ...current, issues };
    });
    return id;
  }

  function startRun(issueId: string, purpose: "implement" | "split" = "implement", trigger: AgentRun["trigger"] = "manual"): string {
    const id = makeId("run");
    update((current) => {
      const issue = current.issues.find((candidate) => candidate.id === issueId);
      if (!issue) throw new Error("Issue 不存在");
      const readiness = issueReadiness(issue, current.issues, current.runs);
      if (!readiness.ready) throw new Error(readiness.checks.find((check) => !check.met)?.detail ?? "Issue 尚未就绪");
      const acpSessionId = makeId("sess");
      const newRequestId = makeId("new");
      const promptRequestId = makeId("prompt");
      const createdAt = new Date().toISOString();
      const prompt = purpose === "split"
        ? `分析 Issue #${issue.number}，创建必要的 Sub-issues 和 Dependencies。`
        : `处理 Issue #${issue.number}：${issue.title}`;
      const sessionEvents = [
        makeAcpEvent("client_to_agent", { jsonrpc: "2.0", id: newRequestId, method: "session/new", params: { cwd: "D:/workspace", mcpServers: [] } }, createdAt),
        makeAcpEvent("agent_to_client", { jsonrpc: "2.0", id: newRequestId, result: { sessionId: acpSessionId } }, createdAt),
        makeAcpEvent("client_to_agent", {
        jsonrpc: "2.0", id: promptRequestId, method: "session/prompt",
        params: { sessionId: acpSessionId, prompt: [{ type: "text", text: prompt }] },
        }, createdAt),
      ];
      const run: AgentRun = { id, issueId, pullRequestId: issue.selectedPullRequestId, state: "queued", trigger, purpose, triggeredBy: "你", executor: "本地演示 Agent", inputSummary: `Issue #${issue.number} 当前正文和评论`, graphSummary: `${issue.parentId ? "存在 Parent；" : ""}${issue.blockedByIds.length} 个前置依赖`, baseSha: "demo-base", startingHeadSha: issue.selectedPullRequestId ? current.pullRequests.find((pr) => pr.id === issue.selectedPullRequestId)?.headSha : undefined, acpProtocolVersion: 1, acpSessionId, acpEvents: sessionEvents, createdIssueIds: [], createdDependencies: [], logSummary: "ACP 会话已建立，等待执行器接手。", createdAt };
      return { ...current, runs: [run, ...current.runs] };
    });
    return id;
  }

  function cancelRun(runId: string) {
    const now = new Date().toISOString();
    update((current) => ({ ...current, runs: current.runs.map((run) => run.id === runId && run.state !== "completed" && !run.cancelRequestedAt ? { ...run, cancelRequestedAt: now, acpEvents: [...run.acpEvents, makeAcpEvent("client_to_agent", { jsonrpc: "2.0", method: "session/cancel", params: { sessionId: run.acpSessionId } }, now)], logSummary: "取消请求已发送，等待 Agent 返回最终更新。" } : run) }));
  }

  function retryRun(runId: string): string {
    const previous = storeRef.current.runs.find((run) => run.id === runId);
    if (!previous) throw new Error("Run 不存在");
    return startRun(previous.issueId, previous.purpose, "retry");
  }

  function setAgentAllowed(issueId: string, allowed: boolean) {
    update((current) => ({ ...current, issues: current.issues.map((issue) => issue.id === issueId ? { ...issue, agentAllowed: allowed, updatedAt: new Date().toISOString() } : issue) }));
  }

  function addDependency(blockedIssueId: string, prerequisiteId: string) {
    update((current) => {
      const issues = addDependencyToGraph(current.issues, blockedIssueId, prerequisiteId);
      return { ...current, issues };
    });
  }

  function closeIssue(issueId: string, reason: Exclude<IssueCloseReason, "unknown">) {
    const now = new Date().toISOString();
    update((current) => {
      const issue = current.issues.find((candidate) => candidate.id === issueId);
      if (!issue) throw new Error("Issue 不存在");
      const blocker = issueCloseBlocker(issueId, reason, current.issues, current.runs);
      if (blocker) throw new Error(blocker);
      const previousReady = new Map(current.issues.map((issue) => [issue.id, issueReadiness(issue, current.issues, current.runs).ready]));
      const issues = current.issues.map((issue) => issue.id === issueId ? { ...issue, state: "closed" as const, closeReason: reason, updatedAt: now } : issue);
      const closed = issues.find((issue) => issue.id === issueId)!;
      const notice: FactoryNotification = { id: makeId("notice"), kind: reason === "completed" ? "issue_completed" : "issue_not_planned", title: `Issue #${closed.number} ${reason === "completed" ? "已完成" : "不再处理"}`, body: reason === "completed" ? "已重新计算 Parent 和下游 Issue。" : "它不会满足依赖，下游仍保持阻塞。", issueId, createdAt: now, read: false, delivery: "sent", actionPath: `/issues/${issueId}` };
      const readyNotices = issues.filter((issue) => !previousReady.get(issue.id) && issueReadiness(issue, issues, current.runs).ready).map((issue): FactoryNotification => ({ id: makeId("notice"), kind: "issue_ready", title: `Issue #${issue.number} 已就绪`, body: "全部前置依赖已完成，可以接手。", issueId: issue.id, createdAt: now, read: false, delivery: "sent", actionPath: `/issues/${issue.id}` }));
      return { ...current, issues, notifications: [...readyNotices, notice, ...current.notifications] };
    });
  }

  function reopenIssue(issueId: string) {
    const now = new Date().toISOString();
    update((current) => {
      const issue = current.issues.find((candidate) => candidate.id === issueId)!;
      const notification: FactoryNotification = { id: makeId("notice"), kind: "issue_reopened", title: `Issue #${issue.number} 已重新打开`, body: "尚未开始的下游将重新阻塞；已发生的 Run、Commit 和 Merge 不回滚。", issueId, createdAt: now, read: false, delivery: "sent", actionPath: `/issues/${issueId}` };
      return { ...current, issues: current.issues.map((candidate) => candidate.id === issueId ? { ...candidate, state: "open", closeReason: undefined, updatedAt: now } : candidate), notifications: [notification, ...current.notifications] };
    });
  }

  function submitReview(pullRequestId: string, state: ReviewState, body: string) {
    const now = new Date().toISOString();
    update((current) => {
      const pr = current.pullRequests.find((candidate) => candidate.id === pullRequestId)!;
      const review = { id: makeId("review"), state, author: "你", commitSha: pr.headSha, body: body.trim() || (state === "approve" ? "批准当前提交。" : state === "request_changes" ? "请继续修改。" : "留下评论。"), submittedAt: now };
      const notification = state === "request_changes" ? { id: makeId("notice"), kind: "changes_requested" as const, title: `PR #${pr.number} 被要求修改`, body: review.body, issueId: pr.issueId, pullRequestId, createdAt: now, read: false, delivery: "sent" as const, actionPath: `/pulls/${pullRequestId}` } : undefined;
      return { ...current, pullRequests: current.pullRequests.map((candidate) => candidate.id === pullRequestId ? { ...candidate, reviews: [...candidate.reviews, review], updatedAt: now } : candidate), notifications: notification ? [notification, ...current.notifications] : current.notifications };
    });
  }

  function markNotificationRead(notificationId: string) {
    update((current) => ({ ...current, notifications: current.notifications.map((notice) => notice.id === notificationId ? { ...notice, read: true } : notice) }));
  }

  function markAllNotificationsRead() {
    update((current) => ({ ...current, notifications: current.notifications.map((notice) => ({ ...notice, read: true })) }));
  }

  function resetDemo() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    const next = seedStore();
    storeRef.current = next;
    setStore(next);
  }

  const value = useMemo<FactoryContextValue>(() => ({ ...store, unreadCount: store.notifications.filter((notice) => !notice.read).length, createIssue, startRun, cancelRun, retryRun, setAgentAllowed, addDependency, closeIssue, reopenIssue, submitReview, markNotificationRead, markAllNotificationsRead, resetDemo }), [store]);
  return <FactoryContext.Provider value={value}>{children}</FactoryContext.Provider>;
}

export function useFactory(): FactoryContextValue {
  const value = useContext(FactoryContext);
  if (!value) throw new Error("useFactory must be used inside FactoryProvider");
  return value;
}
