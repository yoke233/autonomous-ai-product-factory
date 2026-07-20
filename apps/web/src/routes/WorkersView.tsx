import { useNavigate } from "react-router-dom";
import { Bot, GitBranch } from "lucide-react";

import { useGoals } from "@/api/queries";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { projectName, relTime } from "@/domain";

/** 执行器池容量。真实值应由后端 Worker 遥测提供；此处作为展示上限。 */
const POOL = 4;

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="flex-1 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold ${tone}`}>{value}</div>
    </Card>
  );
}

export function WorkersView() {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useGoals();
  const goals = data ?? [];
  const running = goals.filter((g) => g.status === "RUNNING");
  const busy = Math.min(running.length, POOL);
  const idle = Math.max(0, POOL - busy);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
        <h2 className="text-[13px] font-semibold">Worker</h2>
        <span className="text-xs text-muted-foreground">执行器池 · 容量 {POOL}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isError && <p className="text-xs text-danger">加载失败：{String(error)}</p>}
        {isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="flex gap-3">
            <Stat label="总容量" value={POOL} tone="text-foreground" />
            <Stat label="忙碌" value={busy} tone="text-info" />
            <Stat label="空闲" value={idle} tone="text-success" />
          </div>
        )}

        <div className="mt-5 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          活跃执行器
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          执行器在隔离 worktree 中执行工单，状态由运行中的工单派生。
        </p>

        <div className="space-y-2">
          {!isPending && running.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground [&_svg]:size-8">
              <Bot />
              <p className="text-[13px]">当前没有运行中的工单，执行器全部空闲</p>
            </div>
          )}
          {running.map((g) => (
            <Card
              key={g.id}
              className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:border-input"
              onClick={() => navigate(`/tickets/${g.id}`)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-info-soft text-info [&_svg]:size-4">
                <Bot />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{g.goal_text}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground [&_svg]:size-3">
                  <span className="flex items-center gap-1 font-mono">
                    <GitBranch />
                    factory/{g.id}
                  </span>
                  <span className="size-0.5 rounded-full bg-muted-foreground/40" />
                  <span>{projectName(g.repo_path)}</span>
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">已运行 {relTime(g.updated_at)}</span>
            </Card>
          ))}
          {Array.from({ length: idle }).map((_, i) => (
            <div
              key={`idle-${i}`}
              className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3 text-muted-foreground"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted [&_svg]:size-4">
                <Bot />
              </span>
              <span className="text-[13px]">空闲槽位</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
