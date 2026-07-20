import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Lock, MessagesSquare, Plus, TriangleAlert } from "lucide-react";

import { api, type Goal, type Intake, type IntakeDraft } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dot } from "@/components/status";
import { useIntakes } from "@/intakes";
import { projectName, relTime, type Tone } from "@/domain";
import { cn } from "@/lib/utils";

function DraftCard({ intake, onStarted }: { intake: Intake; onStarted: (g: Goal) => void }) {
  const draft = intake.draft as IntakeDraft;
  const [goalText, setGoalText] = useState(draft.goalText);
  const [buildCommand, setBuildCommand] = useState(draft.buildCommand ?? "");
  const [testCommand, setTestCommand] = useState(draft.testCommand ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setGoalText(draft.goalText);
    setBuildCommand(draft.buildCommand ?? "");
    setTestCommand(draft.testCommand ?? "");
  }, [draft]);

  const start = async () => {
    setBusy(true);
    setErr("");
    try {
      const g = await api.startIntake(intake.id, {
        goalText,
        ...(buildCommand ? { buildCommand } : {}),
        ...(testCommand ? { testCommand } : {}),
      });
      onStarted(g);
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <Card className="my-2 overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium [&_svg]:size-3.5">
        <Lock className="text-muted-foreground" />
        工单草稿
        <span className="ml-auto font-mono text-muted-foreground">g_draft · 自包含</span>
      </div>
      <div className="space-y-3 p-3">
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            GOAL（执行者只看得到这段文字）
          </div>
          <Textarea value={goalText} rows={5} onChange={(e) => setGoalText(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            构建 / 测试命令
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1 text-xs">
              <span className="font-mono text-muted-foreground">build</span>
              <input
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="pnpm build"
                className="w-36 bg-transparent font-mono outline-none placeholder:text-muted-foreground/60"
              />
            </label>
            <label className="flex items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1 text-xs">
              <span className="font-mono text-muted-foreground">test</span>
              <input
                value={testCommand}
                onChange={(e) => setTestCommand(e.target.value)}
                placeholder="pnpm test"
                className="w-36 bg-transparent font-mono outline-none placeholder:text-muted-foreground/60"
              />
            </label>
          </div>
          {!buildCommand && !testCommand && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              没有验证命令时 Assessment 只能是 INCONCLUSIVE，批准前需自行确认 diff。
            </p>
          )}
        </div>
        <div className="flex items-start gap-1.5 rounded-md bg-warning-soft px-2.5 py-2 text-xs text-warning [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
          <TriangleAlert />
          <span>对话不会带给执行者，草稿必须自包含 —— 执行者只读到上面的 Goal 与命令。</span>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2.5">
        <Button size="sm" disabled={busy || !goalText.trim()} onClick={start}>
          <Check />
          {busy ? "开工中…" : "确认开工"}
        </Button>
        {err && <span className="text-xs text-danger">{err}</span>}
      </div>
    </Card>
  );
}

export function ConversationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { intakes, upsert } = useIntakes();

  const [repoPath, setRepoPath] = useState("");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const chatEnd = useRef<HTMLDivElement | null>(null);

  const current = id ? (intakes.find((i) => i.id === id) ?? null) : null;
  const composing = id == null;
  const busy = pending !== null;

  // 深链 /chat/:id 未命中会话列表时按 id 拉取补齐。
  useEffect(() => {
    if (id && !intakes.some((i) => i.id === id)) {
      api.getIntake(id).then(upsert).catch(() => {});
    }
  }, [id, intakes, upsert]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [current?.messages.length, pending]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setPending(text);
    setErr("");
    try {
      let session = current;
      if (!session) {
        session = await api.createIntake(repoPath.trim());
        upsert(session);
        navigate(`/chat/${session.id}`, { replace: true });
      }
      setInput("");
      const updated = await api.sendIntakeMessage(session.id, text);
      upsert(updated);
    } catch (e2) {
      setErr(String(e2));
      setInput(text);
    } finally {
      setPending(null);
    }
  };

  const onStarted = (g: Goal) => {
    if (current) upsert({ ...current, status: "STARTED", goal_id: g.id });
    qc.invalidateQueries({ queryKey: ["goals"] });
    navigate(`/inbox/${g.id}`);
  };

  return (
    <div className="grid h-full grid-cols-[300px_1fr] overflow-hidden">
      {/* 会话列表 */}
      <div className="flex min-h-0 flex-col border-r border-border">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-[13px] font-semibold">对话</h2>
          <button
            type="button"
            onClick={() => {
              navigate("/chat");
              setRepoPath("");
              setInput("");
              setErr("");
            }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent [&_svg]:size-4"
          >
            <Plus />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {intakes.length === 0 && composing && (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground [&_svg]:size-8">
              <MessagesSquare />
              <p className="text-[13px]">新对话，先填仓库路径开始</p>
            </div>
          )}
          {intakes.map((i) => {
            const title = i.messages.find((m) => m.role === "user")?.text ?? projectName(i.repo_path);
            const sub = i.status === "STARTED" ? "已转工单" : i.draft ? "草稿已就绪 · 待确认开工" : "澄清中";
            const tone: Tone = i.status === "STARTED" ? "info" : i.draft ? "success" : "warning";
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => navigate(`/chat/${i.id}`)}
                className={cn(
                  "flex w-full items-start gap-2.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent/60",
                  i.id === id && "bg-accent",
                )}
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-info-soft text-info [&_svg]:size-3.5">
                  <MessagesSquare />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{title.slice(0, 40)}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{sub}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Dot tone={tone} />
                  <span className="text-[11px] text-muted-foreground">{relTime(i.updated_at)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 聊天面板 */}
      <div className="flex min-h-0 flex-col">
        {composing && (
          <div className="shrink-0 border-b border-border px-4 py-3">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              仓库路径（本地 Git 仓库，只读 Clarifier 会阅读它了解上下文）
            </div>
            <Input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="D:\project\some-repo" />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-3 flex justify-center">
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
              只读 Clarifier{current ? ` · ${projectName(current.repo_path)}` : ""}
            </span>
          </div>
          {current?.messages.map((m, i) => (
            <Message key={i} role={m.role} text={m.text} />
          ))}
          {pending !== null && (
            <>
              <Message role="user" text={pending} />
              <Message role="agent" text="正在阅读仓库并思考…" thinking />
            </>
          )}
          {current?.draft && current.status === "OPEN" && (
            <DraftCard intake={current} onStarted={onStarted} />
          )}
          {!current && !composing && (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground [&_svg]:size-8">
              <MessagesSquare />
              <p className="text-[13px]">选择一个对话，或新建</p>
            </div>
          )}
          <div ref={chatEnd} />
        </div>

        <form className="flex shrink-0 items-end gap-2 border-t border-border px-4 py-3" onSubmit={send}>
          <span className="flex shrink-0 items-center gap-1 self-center rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground [&_svg]:size-3">
            <Lock />
            只读 Clarifier
          </span>
          <Textarea
            value={input}
            rows={2}
            disabled={busy || current?.status === "STARTED"}
            placeholder={
              composing ? "描述你想要什么，例：给 POST /orders 加幂等保护…" : "回复 Clarifier，补充或修正需求…"
            }
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(e);
            }}
          />
          <Button
            type="submit"
            size="sm"
            className="self-stretch"
            disabled={busy || !input.trim() || (composing && !repoPath.trim())}
          >
            {busy ? "等待中…" : composing ? "开始沟通" : "发送"}
          </Button>
        </form>
        {err && <p className="px-4 pb-3 text-xs text-danger">{err}</p>}
      </div>
    </div>
  );
}

function Message({ role, text, thinking }: { role: "user" | "agent"; text: string; thinking?: boolean }) {
  const me = role === "user";
  return (
    <div className={cn("mb-2.5 flex gap-2", me && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          me ? "bg-primary text-primary-foreground" : "bg-info-soft text-info",
        )}
      >
        {me ? "你" : "CL"}
      </div>
      <div
        className={cn(
          "max-w-[78%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-relaxed",
          me ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          thinking && "text-muted-foreground",
        )}
      >
        {thinking && (
          <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground align-middle" />
        )}
        {text}
      </div>
    </div>
  );
}
