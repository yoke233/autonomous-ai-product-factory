import assert from "node:assert/strict";
import test from "node:test";

import { addDependencyToGraph, graphEdges, graphHasCycle, isAcpTranscript, issueCloseBlocker, issueReadiness, type AgentRun, type Issue } from "./domain.ts";

const base = (input: Partial<Issue> & Pick<Issue, "id" | "number" | "title">): Issue => ({
  providerId: input.id,
  repositoryId: "repo",
  body: "",
  state: "open",
  blockedByIds: [],
  agentAllowed: true,
  labels: [],
  assignees: [],
  comments: 0,
  updatedAt: "2026-07-22T00:00:00Z",
  url: `https://example.test/${input.number}`,
  ...input,
});

test("Issue 只有在子 Issue 与显式依赖都 completed 时才就绪", () => {
  const parent = base({ id: "parent", number: 1, title: "parent", blockedByIds: ["dep"] });
  const child = base({ id: "child", number: 2, title: "child", parentId: "parent", state: "closed", closeReason: "completed" });
  const dependency = base({ id: "dep", number: 3, title: "dep", state: "closed", closeReason: "completed" });
  assert.equal(issueReadiness(parent, [parent, child, dependency], []).ready, true);
});

test("not planned 不满足父级完成边或显式依赖", () => {
  const parent = base({ id: "parent", number: 1, title: "parent" });
  const child = base({ id: "child", number: 2, title: "child", parentId: "parent", state: "closed", closeReason: "not_planned" });
  assert.equal(issueReadiness(parent, [parent, child], []).ready, false);
});

test("进行中的 Run 会占用 Issue", () => {
  const issue = base({ id: "issue", number: 1, title: "issue" });
  const run = { id: "run", issueId: "issue", state: "in_progress" } as AgentRun;
  assert.equal(issueReadiness(issue, [issue], [run]).ready, false);
});

test("第一个 queued Run 创建后，同一 Issue 立即不再可接手", () => {
  const issue = base({ id: "issue", number: 1, title: "issue" });
  assert.equal(issueReadiness(issue, [issue], []).ready, true);
  const firstRun = { id: "run-1", issueId: "issue", state: "queued" } as AgentRun;
  assert.equal(issueReadiness(issue, [issue], [firstRun]).ready, false);
});

test("存在有效 Run 时，completed 与 not planned 两种关闭都被拒绝", () => {
  const issue = base({ id: "issue", number: 1, title: "issue" });
  const run = { id: "run-1", issueId: "issue", state: "in_progress" } as AgentRun;
  assert.equal(issueCloseBlocker(issue.id, "completed", [issue], [run]), "请先取消 run-1");
  assert.equal(issueCloseBlocker(issue.id, "not_planned", [issue], [run]), "请先取消 run-1");
});

test("标记 completed 时仍要求所有子 Issue 和前置依赖 completed", () => {
  const parent = base({ id: "parent", number: 1, title: "parent", blockedByIds: ["dep"] });
  const child = base({ id: "child", number: 2, title: "child", parentId: "parent", state: "closed", closeReason: "not_planned" });
  const dependency = base({ id: "dep", number: 3, title: "dep", state: "closed", closeReason: "completed" });
  assert.equal(issueCloseBlocker(parent.id, "completed", [parent, child, dependency], []), "Sub-issue #2 尚未完成");
  assert.equal(issueCloseBlocker(parent.id, "not_planned", [parent, child, dependency], []), undefined);
});

test("显式依赖与 Sub-issue 隐式完成边共同参与环检测", () => {
  const parent = base({ id: "parent", number: 1, title: "parent" });
  const child = base({ id: "child", number: 2, title: "child", parentId: "parent", blockedByIds: ["parent"] });
  assert.equal(graphHasCycle([parent, child]), true);
});

test("DAG 边统一从前置或 Sub-issue 指向被阻塞 Issue 或 Parent", () => {
  const parent = base({ id: "parent", number: 1, title: "parent" });
  const prerequisite = base({ id: "prerequisite", number: 2, title: "prerequisite" });
  const child = base({ id: "child", number: 3, title: "child", parentId: "parent", blockedByIds: ["prerequisite"] });
  assert.deepEqual(graphEdges([parent, prerequisite, child]), [
    { from: "prerequisite", to: "child", kind: "dependency" },
    { from: "child", to: "parent", kind: "parent" },
  ]);
});

test("新增依赖基于传入的最新图，形成环时保持原图不变", () => {
  const first = base({ id: "first", number: 1, title: "first" });
  const second = base({ id: "second", number: 2, title: "second", blockedByIds: ["first"] });
  const issues = [first, second];
  assert.throws(() => addDependencyToGraph(issues, "first", "second"), /形成环/);
  assert.deepEqual(first.blockedByIds, []);
  assert.deepEqual(second.blockedByIds, ["first"]);
});

test("Run 成功不会自动关闭 Issue", () => {
  const issue = base({ id: "issue", number: 1, title: "issue" });
  const run = { id: "run", issueId: "issue", state: "completed", conclusion: "success" } as AgentRun;
  assert.equal(issueReadiness(issue, [issue], [run]).checks.find((check) => check.key === "open")?.met, true);
  assert.equal(issue.state, "open");
});

test("ACP transcript 只接受带方向、时间和 JSON-RPC 2.0 消息的有序事件", () => {
  const events = [{
    id: "event-1",
    receivedAt: "2026-07-22T00:00:00Z",
    direction: "client_to_agent",
    message: { jsonrpc: "2.0", id: 1, method: "session/prompt", params: { sessionId: "session-1", prompt: [] } },
  }];
  assert.equal(isAcpTranscript(events), true);
  assert.equal(isAcpTranscript([{ ...events[0], message: { jsonrpc: "1.0", method: "session/prompt" } }]), false);
  assert.equal(isAcpTranscript([{ id: "event-1", direction: "client_to_agent", message: events[0]!.message }]), false);
});
