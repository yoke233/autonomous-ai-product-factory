import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCheck, Inbox, MoreHorizontal, Zap } from "lucide-react";

import { useGoals } from "@/api/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status";
import { ATTENTION, outcomeReason, relTime, statusLabel } from "@/domain";
import { cn } from "@/lib/utils";
import { ApprovalDetail } from "./ApprovalDetail";

export function InboxView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useGoals();

  const items = (data ?? []).filter((g) => ATTENTION.includes(g.status));
  const firstId = items[0]?.id;

  useEffect(() => {
    if (!id && firstId) navigate(`/inbox/${firstId}`, { replace: true });
  }, [id, firstId, navigate]);

  return (
    <div className="grid h-full grid-cols-[360px_1fr] overflow-hidden">
      {/* 列表列 */}
      <div className="flex min-h-0 flex-col border-r border-border">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-[13px] font-semibold">收件箱</h2>
          <button className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent [&_svg]:size-4">
            <MoreHorizontal />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isPending && (
            <div className="space-y-2 p-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}
          {isError && (
            <div className="p-4 text-xs text-danger">加载失败：{String(error)}</div>
          )}
          {!isPending && !isError && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground [&_svg]:size-8">
              <Inbox />
              <p className="text-[13px]">没有待处理的工单</p>
            </div>
          )}
          {items.map((g) => {
            const reason = outcomeReason(g);
            const active = g.id === id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => navigate(`/inbox/${g.id}`)}
                className={cn(
                  "flex w-full items-start gap-2.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent/60",
                  active && "bg-accent",
                )}
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning [&_svg]:size-3.5">
                  <Zap />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {g.goal_text.slice(0, 44) || "（无标题）"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{g.id}</span> · {statusLabel(g.status)}
                    {reason ? ` · ${reason}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={g.status} />
                  <span className="text-[11px] text-muted-foreground">{relTime(g.updated_at)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 详情列 */}
      <div className="min-h-0 overflow-hidden">
        {id ? (
          <ApprovalDetail id={id} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground [&_svg]:size-8">
            <CheckCheck />
            <p className="text-[13px]">收件箱已清空，没有需要决策的工单</p>
          </div>
        )}
      </div>
    </div>
  );
}
