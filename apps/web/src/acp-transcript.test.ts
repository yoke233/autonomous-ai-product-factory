import assert from "node:assert/strict";
import test from "node:test";

import { projectAcpSession, projectAcpTranscript } from "./acp-transcript.ts";
import type { AcpEvent, AcpJsonRpcMessage } from "./domain.ts";

let sequence = 0;
function event(message: AcpJsonRpcMessage, direction: AcpEvent["direction"] = "agent_to_client"): AcpEvent {
  sequence += 1;
  return { id: `event-${sequence}`, receivedAt: new Date(Date.UTC(2026, 6, 22, 0, 0, sequence)).toISOString(), direction, message };
}

test("消息分片按 messageId 合并，交错消息仍保持首次出现顺序", () => {
  const items = projectAcpTranscript([
    event({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "agent_message_chunk", messageId: "a", content: { type: "text", text: "前" } } } }),
    event({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "agent_message_chunk", messageId: "b", content: { type: "text", text: "旁路" } } } }),
    event({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "agent_message_chunk", messageId: "a", content: { type: "text", text: "后" } } } }),
  ]);
  assert.deepEqual(items.map((item) => item.text), ["前后", "旁路"]);
  assert.equal(items[0]?.events.length, 2);
});

test("最新 plan 完整替换当前计划，同时保留两条原始事件", () => {
  const items = projectAcpTranscript([
    event({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "plan", entries: [{ content: "旧步骤", priority: "high", status: "pending" }] } } }),
    event({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "plan", entries: [{ content: "新步骤", priority: "high", status: "in_progress" }] } } }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.planEntries?.[0]?.content, "新步骤");
  assert.equal(items[0]?.events.length, 2);
});

test("工具更新按 ACP 语义替换 content 集合，同时合并状态", () => {
  const items = projectAcpTranscript([
    event({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "tool_call", toolCallId: "call", title: "测试", status: "pending" } } }),
    event({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId: "call", status: "in_progress", content: [{ type: "content", content: { type: "text", text: "一半" } }] } } }),
    event({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId: "call", status: "completed", content: [{ type: "diff", path: "src/a.ts" }] } } }),
  ]);
  assert.equal(items[0]?.status, "completed");
  assert.equal(items[0]?.toolContent?.length, 1);
  assert.match(items[0]?.toolContent?.[0]?.text ?? "", /src\/a.ts/);
});

test("字符串 RequestId 将权限响应关联回原权限卡", () => {
  const items = projectAcpTranscript([
    event({ jsonrpc: "2.0", id: "permission-1", method: "session/request_permission", params: { sessionId: "s", toolCall: { toolCallId: "call" }, options: [{ optionId: "allow", name: "允许一次", kind: "allow_once" }] } }),
    event({ jsonrpc: "2.0", id: "permission-1", result: { outcome: { outcome: "selected", optionId: "allow" } } }, "client_to_agent"),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "permission");
  assert.equal(items[0]?.status, "completed");
  assert.match(items[0]?.text ?? "", /已选择：允许一次/);
  assert.equal(items[0]?.events.length, 2);
});

test("数字与字符串 RequestId 保持不同身份，不会串错响应", () => {
  const items = projectAcpTranscript([
    event({ jsonrpc: "2.0", id: 1, method: "session/prompt", params: { sessionId: "s", prompt: [{ type: "text", text: "工作" }] } }, "client_to_agent"),
    event({ jsonrpc: "2.0", id: "1", method: "session/request_permission", params: { sessionId: "s", toolCall: { toolCallId: "call" }, options: [{ optionId: "allow", name: "允许一次", kind: "allow_once" }] } }),
    event({ jsonrpc: "2.0", id: 1, result: { stopReason: "end_turn" } }),
  ]);
  assert.equal(items.at(-1)?.kind, "stop");
  assert.equal(items.find((item) => item.kind === "permission")?.status, "pending");
});

test("ACP 会话状态只取自 session/new 对应响应", () => {
  const pending = [event({ jsonrpc: "2.0", id: "new", method: "session/new", params: { cwd: "D:/workspace", mcpServers: [] } }, "client_to_agent")];
  assert.deepEqual(projectAcpSession(pending), { status: "pending" });
  assert.deepEqual(projectAcpSession([...pending, event({ jsonrpc: "2.0", id: "new", result: { sessionId: "agent-session" } })]), { status: "completed", sessionId: "agent-session" });
  assert.deepEqual(projectAcpSession([...pending, event({ jsonrpc: "2.0", id: "new", error: { code: -32000, message: "无法建立" } })]), { status: "failed", error: "无法建立" });
});

test("非文本内容显示占位信息而不是空消息", () => {
  const items = projectAcpTranscript([
    event({ jsonrpc: "2.0", id: "prompt-1", method: "session/prompt", params: { sessionId: "s", prompt: [{ type: "image", mimeType: "image/png", data: "..." }, { type: "resource_link", uri: "file:///a.ts", name: "a.ts" }] } }, "client_to_agent"),
  ]);
  assert.equal(items[0]?.text, "[图片 · image/png]\n[资源链接 · a.ts]");
});

test("取消通知后仍接收最终更新，原 prompt 响应才结束本轮", () => {
  const items = projectAcpTranscript([
    event({ jsonrpc: "2.0", id: "new-1", method: "session/new", params: { cwd: "D:/workspace", mcpServers: [] } }, "client_to_agent"),
    event({ jsonrpc: "2.0", id: "new-1", result: { sessionId: "s" } }),
    event({ jsonrpc: "2.0", id: "prompt-1", method: "session/prompt", params: { sessionId: "s", prompt: [{ type: "text", text: "工作" }] } }, "client_to_agent"),
    event({ jsonrpc: "2.0", method: "session/cancel", params: { sessionId: "s" } }, "client_to_agent"),
    event({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "agent_message_chunk", messageId: "final", content: { type: "text", text: "已清理" } } } }),
    event({ jsonrpc: "2.0", id: "prompt-1", result: { stopReason: "cancelled" } }),
  ]);
  assert.deepEqual(items.slice(-3).map((item) => item.kind), ["protocol", "agent", "stop"]);
  assert.equal(items.at(-1)?.text, "cancelled");
});
