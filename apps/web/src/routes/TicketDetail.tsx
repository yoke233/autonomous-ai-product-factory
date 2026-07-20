import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, User } from "lucide-react";

import { useGoal, useGoalComments, usePostComment } from "@/api/queries";
import type { GoalComment } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status";
import { projectName, relTime } from "@/domain";
import {
  AssessmentBlock,
  GoalActions,
  GoalSecondary,
  PlanBlock,
  SummaryBlock,
} from "./goal-parts";

const AUTHOR: Record<GoalComment["author"], { name: string; short: string; cls: string }> = {
  human: { name: "你", short: "你", cls: "bg-primary text-primary-foreground" },
  executor: { name: "执行器", short: "EX", cls: "bg-info-soft text-info" },
  system: { name: "系统", short: "SYS", cls: "bg-muted text-muted-foreground" },
};

function CommentThread({ id, active }: { id: string; active: boolean }) {
  const { data, isPending } = useGoalComments(id);
  const post = usePostComment(id);
  const [text, setText] = useState("");
  const comments = data ?? [];

  // 发送后到执行器回执之间显示“处理中”：记录发送时的非人类留言数，
  // 待其增加（执行器有新回复）时清除。
  const replyCount = comments.filter((c) => c.author !== "human").length;
  const [awaitingFrom, setAwaitingFrom] = useState<number | null>(null);
  const awaiting = awaitingFrom !== null && replyCount <= awaitingFrom;
  useEffect(() => {
    if (awaitingFrom !== null && replyCount > awaitingFrom) setAwaitingFrom(null);
  }, [replyCount, awaitingFrom]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    post.mutate(t, { onSuccess: () => setText("") });
    setAwaitingFrom(replyCount);
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13px] font-semibold">讨论</h2>
        <span className="text-xs text-muted-foreground">{comments.length} 条</span>
      </div>

      {isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <div className="space-y-3">
          {comments.length === 0 && (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              还没有留言。给执行器发送一条说明或补充需求。
            </p>
          )}
          {comments.map((c) => {
            const a = AUTHOR[c.author];
            return (
              <div key={c.id} className="flex gap-2.5">
                <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${a.cls}`}>
                  {a.short}
                </div>
                <Card className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-muted-foreground">{relTime(c.created_at)}前</span>
                  </div>
                  <p className="whitespace-pre-wrap px-3 py-2.5 text-[13px] leading-relaxed">{c.text}</p>
                </Card>
              </div>
            );
          })}
          {awaiting && (
            <div className="flex gap-2.5">
              <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${AUTHOR.executor.cls}`}>
                {AUTHOR.executor.short}
              </div>
              <Card className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-[13px] text-muted-foreground">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-info" />
                执行器正在处理你的留言…
              </Card>
            </div>
          )}
        </div>
      )}

      {/* 发送框 */}
      <div className="mt-4 flex gap-2.5">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground [&_svg]:size-3.5">
          <User />
        </div>
        <div className="min-w-0 flex-1">
          <Textarea
            value={text}
            rows={3}
            placeholder="给执行器留言：补充需求、回答它的提问或纠正方向…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
          />
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" disabled={post.isPending || !text.trim()} onClick={submit}>
              <Send />
              {post.isPending ? "发送中…" : "发送给执行器"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {active
                ? "发送后执行器会在下次读取时收到你的留言（Ctrl/⌘+Enter）"
                : "工单已进入终态，留言仅作记录"}
            </span>
          </div>
          {post.error && <p className="mt-1.5 text-xs text-danger">{String(post.error)}</p>}
        </div>
      </div>
    </div>
  );
}

export function TicketDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: detail, isPending, isError, error } = useGoal(id);

  const active = detail ? ["RECEIVED", "RUNNING", "AWAITING_APPROVAL"].includes(detail.goal.status) : false;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 顶栏 */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          type="button"
          onClick={() => navigate("/tickets")}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          <ArrowLeft />
          返回看板
        </button>
        <div className="mx-1 h-4 w-px bg-border" />
        <span className="font-mono text-xs text-muted-foreground">{id}</span>
        {detail && <StatusBadge status={detail.goal.status} />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError && <p className="p-6 text-[13px] text-danger">{String(error)}</p>}
        {isPending || !detail ? (
          <div className="mx-auto max-w-5xl space-y-4 p-6">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_260px]">
            {/* 主栏 */}
            <main className="min-w-0 space-y-6">
              <h1 className="text-xl font-semibold leading-snug">{detail.goal.goal_text || "（无标题）"}</h1>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <SummaryBlock detail={detail} />
                <AssessmentBlock detail={detail} />
                <div className="[&>section]:border-b-0">
                  <PlanBlock detail={detail} />
                </div>
              </div>
              <CommentThread id={id} active={active} />
            </main>

            {/* 右栏 */}
            <aside className="space-y-4">
              <Card className="divide-y divide-border text-[13px]">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-muted-foreground">状态</span>
                  <StatusBadge status={detail.goal.status} />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-muted-foreground">项目</span>
                  <Link
                    to={`/tickets?repo=${encodeURIComponent(detail.goal.repo_path)}`}
                    className="max-w-[140px] truncate text-info hover:underline"
                  >
                    {projectName(detail.goal.repo_path)}
                  </Link>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-muted-foreground">交付方式</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {detail.goal.boundary.deliveryMode}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-muted-foreground">更新</span>
                  <span className="text-muted-foreground">{relTime(detail.goal.updated_at)}前</span>
                </div>
              </Card>

              <GoalActions goal={detail.goal} className="px-1" />
              <GoalSecondary detail={detail} />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
