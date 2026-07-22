import type { AcpEvent, JsonValue } from "./domain.ts";

type JsonObject = { [key: string]: JsonValue };
export type TranscriptKind = "user" | "agent" | "thought" | "plan" | "tool" | "permission" | "usage" | "stop" | "protocol";
export type ToolContentItem = { kind: "text" | "diff" | "terminal"; text: string };

export interface TranscriptItem {
  id: string;
  kind: TranscriptKind;
  title: string;
  text?: string;
  status?: string;
  receivedAt: string;
  events: AcpEvent[];
  planEntries?: Array<{ content: string; priority: string; status: string }>;
  toolContent?: ToolContentItem[];
  permissionOptions?: Array<{ optionId: string; name: string }>;
  toolCallId?: string;
}

function object(value: JsonValue | undefined): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function array(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function string(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function contentLabel(value: JsonValue | undefined): string {
  const block = object(value);
  const type = string(block.type);
  if (type === "text") return string(block.text);
  if (type === "image") return `[图片${string(block.mimeType) ? ` · ${string(block.mimeType)}` : ""}]`;
  if (type === "audio") return `[音频${string(block.mimeType) ? ` · ${string(block.mimeType)}` : ""}]`;
  if (type === "resource_link") return `[资源链接 · ${string(block.name) || string(block.uri) || "未命名"}]`;
  if (type === "resource") {
    const resource = object(block.resource);
    return `[资源 · ${string(resource.uri) || string(resource.name) || "内嵌内容"}]`;
  }
  return type ? `[${type} 内容]` : "[未知内容]";
}

function promptText(params: JsonObject): string {
  return array(params.prompt).map(contentLabel).filter(Boolean).join("\n");
}

function toolContents(update: JsonObject): ToolContentItem[] {
  return array(update.content).flatMap((value): ToolContentItem[] => {
    const item = object(value);
    if (item.type === "content") return [{ kind: "text", text: contentLabel(item.content) }];
    if (item.type === "diff") {
      const oldText = typeof item.oldText === "string" ? item.oldText : "";
      const newText = string(item.newText);
      return [{ kind: "diff", text: `${string(item.path) || "未命名文件"}${oldText ? `\n--- 修改前\n${oldText}` : ""}\n+++ 修改后\n${newText}` }];
    }
    if (item.type === "terminal") return [{ kind: "terminal", text: string(item.terminalId) || "终端" }];
    return [{ kind: "text", text: contentLabel(value) }];
  });
}

function requestKey(id: string | number | undefined): string | undefined {
  return id === undefined ? undefined : `${typeof id}:${id}`;
}

export interface AcpSessionProjection {
  status: "missing" | "pending" | "completed" | "failed";
  sessionId?: string;
  error?: string;
}

export function projectAcpSession(events: AcpEvent[]): AcpSessionProjection {
  const requests = new Set<string>();
  let projection: AcpSessionProjection = { status: "missing" };
  for (const event of events) {
    const key = requestKey(event.message.id);
    if (event.message.method === "session/new" && key) {
      requests.add(key);
      projection = { status: "pending" };
      continue;
    }
    if (!key || !requests.has(key)) continue;
    if (event.message.error) return { status: "failed", error: event.message.error.message };
    const result = object(event.message.result);
    const sessionId = string(result.sessionId);
    if (sessionId) return { status: "completed", sessionId };
  }
  return projection;
}

export function projectAcpTranscript(events: AcpEvent[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const messages = new Map<string, TranscriptItem>();
  const tools = new Map<string, TranscriptItem>();
  const requests = new Map<string, { method: string; item?: TranscriptItem }>();
  let plan: TranscriptItem | undefined;

  for (const event of events) {
    const { message } = event;
    const params = object(message.params);
    const key = requestKey(message.id);

    if (message.method) {
      if (key) requests.set(key, { method: message.method });
      if (message.method === "session/new") {
        const item: TranscriptItem = { id: event.id, kind: "protocol", title: "建立 ACP 会话", text: string(params.cwd), status: "pending", receivedAt: event.receivedAt, events: [event] };
        items.push(item);
        if (key) requests.set(key, { method: message.method, item });
        continue;
      }
      if (message.method === "session/prompt") {
        const item: TranscriptItem = { id: event.id, kind: "user", title: "用户", text: promptText(params), receivedAt: event.receivedAt, events: [event] };
        items.push(item);
        if (key) requests.set(key, { method: message.method, item });
        continue;
      }
      if (message.method === "session/request_permission") {
        const toolCall = object(params.toolCall);
        const options = array(params.options).map((value) => {
          const option = object(value);
          return { optionId: string(option.optionId), name: string(option.name) };
        }).filter((option) => option.optionId);
        const toolCallId = string(toolCall.toolCallId);
        const item: TranscriptItem = { id: event.id, kind: "permission", title: "请求权限", text: `${toolCallId} · ${options.map((option) => option.name).join(" / ")}`, status: "pending", toolCallId, permissionOptions: options, receivedAt: event.receivedAt, events: [event] };
        items.push(item);
        if (key) requests.set(key, { method: message.method, item });
        continue;
      }
      if (message.method === "session/cancel") {
        items.push({ id: event.id, kind: "protocol", title: "正在取消本轮执行", text: string(params.sessionId), receivedAt: event.receivedAt, events: [event] });
        continue;
      }
      if (message.method === "session/update") {
        const update = object(params.update);
        const type = string(update.sessionUpdate);
        if (type === "agent_message_chunk" || type === "agent_thought_chunk" || type === "user_message_chunk") {
          const messageId = string(update.messageId) || event.id;
          const messageKey = `${type}:${messageId}`;
          const text = contentLabel(update.content);
          const existing = messages.get(messageKey);
          if (existing) {
            existing.text = `${existing.text ?? ""}${text}`;
            existing.events.push(event);
          } else {
            const item: TranscriptItem = { id: event.id, kind: type === "agent_thought_chunk" ? "thought" : type === "user_message_chunk" ? "user" : "agent", title: type === "agent_thought_chunk" ? "思考过程" : type === "user_message_chunk" ? "用户" : "Agent", text, receivedAt: event.receivedAt, events: [event] };
            messages.set(messageKey, item);
            items.push(item);
          }
          continue;
        }
        if (type === "plan" || type === "plan_update") {
          const entries = array(update.entries).map((value) => {
            const entry = object(value);
            return { content: string(entry.content), priority: string(entry.priority), status: string(entry.status) };
          });
          if (plan) {
            plan.planEntries = entries;
            plan.events.push(event);
          } else {
            plan = { id: event.id, kind: "plan", title: "执行计划", receivedAt: event.receivedAt, events: [event], planEntries: entries };
            items.push(plan);
          }
          continue;
        }
        if (type === "tool_call") {
          const toolCallId = string(update.toolCallId) || event.id;
          const item: TranscriptItem = { id: event.id, kind: "tool", title: string(update.title) || toolCallId, text: string(update.kind) || "other", status: string(update.status) || "pending", receivedAt: event.receivedAt, events: [event], toolContent: toolContents(update) };
          tools.set(toolCallId, item);
          items.push(item);
          continue;
        }
        if (type === "tool_call_update") {
          const toolCallId = string(update.toolCallId) || event.id;
          const existing = tools.get(toolCallId);
          if (existing) {
            existing.status = string(update.status) || existing.status;
            existing.title = string(update.title) || existing.title;
            existing.text = string(update.kind) || existing.text;
            existing.events.push(event);
            if (Object.prototype.hasOwnProperty.call(update, "content")) existing.toolContent = toolContents(update);
          } else {
            const item: TranscriptItem = { id: event.id, kind: "tool", title: toolCallId, status: string(update.status), receivedAt: event.receivedAt, events: [event], toolContent: toolContents(update) };
            tools.set(toolCallId, item);
            items.push(item);
          }
          continue;
        }
        if (type === "usage_update") {
          const cost = object(update.cost);
          items.push({ id: event.id, kind: "usage", title: "上下文用量", text: `${Number(update.used ?? 0).toLocaleString()} / ${Number(update.size ?? 0).toLocaleString()} tokens${cost.amount ? ` · ${cost.amount} ${string(cost.currency)}` : ""}`, receivedAt: event.receivedAt, events: [event] });
          continue;
        }
        items.push({ id: event.id, kind: "protocol", title: type || "session/update", receivedAt: event.receivedAt, events: [event] });
        continue;
      }
    }

    const request = key ? requests.get(key) : undefined;
    if (request?.method === "session/new") {
      const result = object(message.result);
      if (request.item) {
        request.item.title = message.error ? "ACP 会话建立失败" : "ACP 会话已建立";
        request.item.text = message.error?.message ?? string(result.sessionId);
        request.item.status = message.error ? "failed" : "completed";
        request.item.events.push(event);
      }
      continue;
    }
    if (request?.method === "session/request_permission") {
      const result = object(message.result);
      const outcome = object(result.outcome);
      const optionId = string(outcome.optionId);
      if (request.item) {
        const option = request.item.permissionOptions?.find((candidate) => candidate.optionId === optionId);
        request.item.status = string(outcome.outcome) === "selected" ? "completed" : "failed";
        request.item.text = `${request.item.toolCallId ?? "工具调用"} · ${option ? `已选择：${option.name}` : string(outcome.outcome) || message.error?.message || "无响应"}`;
        request.item.events.push(event);
      }
      continue;
    }
    if (request?.method === "session/prompt") {
      const result = object(message.result);
      items.push({ id: event.id, kind: "stop", title: "本轮执行已结束", text: string(result.stopReason) || message.error?.message, receivedAt: event.receivedAt, events: [event] });
      continue;
    }
    items.push({ id: event.id, kind: "protocol", title: message.error ? "JSON-RPC 错误" : "JSON-RPC 响应", text: message.error?.message, receivedAt: event.receivedAt, events: [event] });
  }
  return items;
}
