// Three ACP transcript variants, switchable via ?variant=, on the existing /runs/:runId route.
import {
  Bot,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  FileDiff,
  ListChecks,
  LockKeyhole,
  Terminal,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { projectAcpTranscript, type TranscriptItem } from "@/acp-transcript";
import { formatTime, type AcpEvent, type JsonValue } from "@/domain";
import { cn } from "@/lib/utils";

function RawJson({ events }: { events: AcpEvent[] }) {
  return (
    <details className="mt-3 rounded-lg border bg-background text-foreground">
      <summary className="cursor-pointer px-3 py-2 text-[11px] text-muted-foreground">查看原始 JSON · {events.length} 条事件</summary>
      <pre className="max-h-80 overflow-auto border-t p-3 text-[10px] leading-5 text-foreground">{JSON.stringify(events.map((event) => event.message), null, 2)}</pre>
    </details>
  );
}

function ToolStatus({ status }: { status?: string }) {
  if (status === "completed") return <Badge tone="success"><Check />已完成</Badge>;
  if (status === "failed") return <Badge tone="danger"><XCircle />失败</Badge>;
  if (status === "in_progress") return <Badge tone="info"><Clock3 />执行中</Badge>;
  return <Badge tone="warning"><Circle />等待</Badge>;
}

function Plan({ item }: { item: TranscriptItem }) {
  return (
    <div className="space-y-2">
      {item.planEntries?.map((entry, index) => (
        <div key={`${entry.content}-${index}`} className="flex items-start gap-2 text-xs">
          <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", entry.status === "completed" && "border-success bg-success text-white", entry.status === "in_progress" && "border-info text-info")}>{entry.status === "completed" ? <Check className="size-2.5" /> : <Circle className="size-2.5" />}</span>
          <span className={entry.status === "completed" ? "text-muted-foreground line-through" : ""}>{entry.content}</span>
        </div>
      ))}
    </div>
  );
}

function ToolContent({ content }: { content?: TranscriptItem["toolContent"] }) {
  if (!content?.length) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {content.map((entry, index) => (
        <div key={`${entry.kind}-${index}`} className="flex items-start gap-2 rounded-md bg-muted/70 px-2.5 py-2 text-xs text-muted-foreground">
          {entry.kind === "diff" ? <FileDiff className="mt-0.5 size-3.5 shrink-0" /> : entry.kind === "terminal" ? <Terminal className="mt-0.5 size-3.5 shrink-0" /> : <ChevronRight className="mt-0.5 size-3.5 shrink-0" />}
          <span className="whitespace-pre-wrap break-all">{entry.text}</span>
        </div>
      ))}
    </div>
  );
}

function ConversationItem({ item }: { item: TranscriptItem }) {
  if (item.kind === "usage" || item.kind === "stop" || item.kind === "protocol") {
    return <div className="flex justify-center"><div className="rounded-full border bg-card px-3 py-1.5 text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{item.title}</span>{item.text ? ` · ${item.text}` : ""}<RawJson events={item.events} /></div></div>;
  }
  if (item.kind === "user") {
    return <div className="flex justify-end gap-2"><div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-foreground px-4 py-3 text-sm leading-6 text-background"><p>{item.text}</p><p className="mt-2 text-right text-[10px] opacity-60">{formatTime(item.receivedAt)}</p><RawJson events={item.events} /></div><span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background"><User className="size-4" /></span></div>;
  }
  if (item.kind === "agent") {
    return <div className="flex gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-info-soft text-info"><Bot className="size-4" /></span><div className="max-w-[82%] rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm leading-6"><p className="font-medium">Agent</p><p className="mt-1 whitespace-pre-wrap">{item.text}</p><p className="mt-2 text-[10px] text-muted-foreground">{formatTime(item.receivedAt)}</p><RawJson events={item.events} /></div></div>;
  }
  if (item.kind === "thought") {
    return <details className="ml-10 rounded-xl border border-dashed bg-muted/40 px-4 py-3"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">思考过程</summary><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.text}</p><RawJson events={item.events} /></details>;
  }
  if (item.kind === "plan") {
    return <div className="ml-10 rounded-xl border bg-card p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold"><ListChecks className="size-4 text-info" />执行计划</div><Plan item={item} /><RawJson events={item.events} /></div>;
  }
  if (item.kind === "permission") {
    return <div className="ml-10 rounded-xl border border-warning/30 bg-warning-soft/50 p-4"><div className="flex items-center justify-between gap-2 text-xs font-semibold text-warning"><span className="flex items-center gap-2"><LockKeyhole className="size-4" />请求权限</span><ToolStatus status={item.status} /></div><p className="mt-2 text-xs">{item.text}</p><RawJson events={item.events} /></div>;
  }
  return <div className="ml-10 rounded-xl border bg-card p-4"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Wrench className="size-4 shrink-0 text-info" /><span className="truncate text-xs font-semibold">{item.title}</span><Badge>{item.text}</Badge></div><ToolStatus status={item.status} /></div><ToolContent content={item.toolContent} /><RawJson events={item.events} /></div>;
}

export function AcpConversationVariant({ events }: { events: AcpEvent[] }) {
  const items = projectAcpTranscript(events);
  return <div className="mx-auto max-w-4xl space-y-4">{items.map((item) => <ConversationItem key={item.id} item={item} />)}</div>;
}

function rpcObject(value: JsonValue | undefined): { [key: string]: JsonValue } {
  return value && typeof value === "object" && !Array.isArray(value) ? value as { [key: string]: JsonValue } : {};
}

function eventLabel(event: AcpEvent): { name: string; detail: string } {
  const { message } = event;
  if (message.method === "session/update") {
    const update = rpcObject(rpcObject(message.params).update);
    return { name: "session/update", detail: typeof update.sessionUpdate === "string" ? update.sessionUpdate : "update" };
  }
  if (message.method) return { name: message.method, detail: message.id === undefined ? "notification" : `request · ${typeof message.id}:${message.id}` };
  return { name: message.error ? "JSON-RPC error" : "JSON-RPC response", detail: message.id === undefined ? "无 ID" : `${typeof message.id}:${message.id}` };
}

export function AcpStreamVariant({ events }: { events: AcpEvent[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[80px_28px_120px_minmax(0,1fr)] border-b bg-muted/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>时间</span><span /><span>事件</span><span>内容</span>
      </div>
      {events.map((event) => {
        const label = eventLabel(event);
        return <details key={event.id} className="group border-b last:border-0">
          <summary className="grid cursor-pointer list-none grid-cols-[80px_28px_120px_minmax(0,1fr)] items-center px-4 py-3 text-xs hover:bg-muted/40">
            <span className="font-mono text-[10px] text-muted-foreground">{new Date(event.receivedAt).toLocaleTimeString("zh-CN", { hour12: false })}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{event.direction === "client_to_agent" ? "→" : "←"}</span>
            <span className="truncate font-mono text-[10px] text-info">{label.name}</span>
            <span className="truncate"><span className="font-semibold">{event.direction === "client_to_agent" ? "客户端 → Agent" : "Agent → 客户端"}</span>{` · ${label.detail}`}</span>
          </summary>
          <pre className="max-h-80 overflow-auto border-t bg-foreground p-4 text-[10px] leading-5 text-background">{JSON.stringify(event.message, null, 2)}</pre>
        </details>
      })}
    </Card>
  );
}

export function AcpInspectorVariant({ events }: { events: AcpEvent[] }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? "");
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3"><p className="text-xs font-semibold">会话事件</p><p className="mt-0.5 text-[11px] text-muted-foreground">选择一条查看原始 ACP JSON</p></div>
        <div className="divide-y">
          {events.map((event) => {
            const label = eventLabel(event);
            return <button key={event.id} type="button" onClick={() => setSelectedId(event.id)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50", selected?.id === event.id && "bg-info-soft/50")}>
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted font-mono text-xs text-muted-foreground">{event.direction === "client_to_agent" ? "→" : "←"}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{label.name}</span><span className="font-mono text-[9px] text-muted-foreground">{new Date(event.receivedAt).toLocaleTimeString("zh-CN", { hour12: false })}</span></span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{label.detail}</span></span>
            </button>;
          })}
        </div>
      </Card>
      <Card className="min-w-0 overflow-hidden lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between border-b px-4 py-3"><div><p className="text-xs font-semibold">{selected ? eventLabel(selected).name : "没有事件"}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{selected ? `${selected.direction} · ${eventLabel(selected).detail}` : ""}</p></div><Code2 className="size-4 text-info" /></div>
        <pre className="max-h-[68vh] overflow-auto bg-foreground p-4 text-[10px] leading-5 text-background">{selected ? JSON.stringify(selected.message, null, 2) : "{}"}</pre>
      </Card>
    </div>
  );
}
