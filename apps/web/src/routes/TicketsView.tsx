import { useNavigate, useSearchParams } from "react-router-dom";
import { Folder, Plus, SignalHigh } from "lucide-react";

import { useGoals } from "@/api/queries";
import type { Goal } from "@/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Dot } from "@/components/status";
import { outcomeReason, projectName, relTime, type Tone } from "@/domain";
import { cn } from "@/lib/utils";

/** 看板列 = 交付生命周期的状态阶段。只读：状态由后端交付循环驱动，卡片不可拖拽换列，
 *  人的干预（批准/否决/取消/留言）在工单详情页完成。 */
/** “我的工单/进行中”作用域：需要我持续跟进的非终态工单。 */
const MINE_STATUSES = ["RECEIVED", "RUNNING", "AWAITING_APPROVAL"];

const COLUMNS: { key: string; label: string; tone: Tone; statuses: string[] }[] = [
  { key: "received", label: "已受理", tone: "info", statuses: ["RECEIVED"] },
  { key: "running", label: "生产中", tone: "info", statuses: ["RUNNING"] },
  { key: "approval", label: "待批准", tone: "warning", statuses: ["AWAITING_APPROVAL"] },
  { key: "delivered", label: "已交付", tone: "success", statuses: ["DELIVERED"] },
  { key: "blocked", label: "未交付 / 异常", tone: "danger", statuses: ["NO_SAFE_DELIVERY", "SYSTEM_FAULT"] },
  { key: "cancelled", label: "已取消", tone: "muted", statuses: ["CANCELLED"] },
];

function KanbanCard({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const reason = goal.status === "NO_SAFE_DELIVERY" ? outcomeReason(goal) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left shadow-xs transition-colors hover:border-input"
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        <SignalHigh />
        <span className="font-mono">{goal.id}</span>
      </div>
      <div className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug">
        {goal.goal_text || "（无标题）"}
      </div>
      {reason && <div className="mt-1 line-clamp-1 text-xs text-danger">{reason}</div>}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 [&_svg]:size-3">
          <Folder />
          {projectName(goal.repo_path)}
        </span>
        <span>更新于 {relTime(goal.updated_at)}</span>
      </div>
    </button>
  );
}

export function TicketsView() {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useGoals();
  const [sp, setSp] = useSearchParams();
  const repo = sp.get("repo");
  const mine = sp.get("scope") === "mine";
  const allGoals = data ?? [];
  let goals = repo ? allGoals.filter((g) => g.repo_path === repo) : allGoals;
  if (mine) goals = goals.filter((g) => MINE_STATUSES.includes(g.status));
  const projects = Array.from(
    new Map(allGoals.map((g) => [g.repo_path, projectName(g.repo_path)] as const)).entries(),
  );

  const setParam = (key: string, val: string | null) => {
    const next = new URLSearchParams(sp);
    if (val) next.set(key, val);
    else next.delete(key);
    setSp(next);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-semibold">{mine ? "我的工单" : "工单"}</h2>
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setParam("scope", null)}
              className={cn("rounded px-2 py-0.5", !mine && "bg-accent font-medium text-accent-foreground")}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => setParam("scope", "mine")}
              className={cn("rounded px-2 py-0.5", mine && "bg-accent font-medium text-accent-foreground")}
            >
              进行中
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{goals.length} 个 · 看板</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground [&_svg]:size-3.5">
          <Folder />
          <select
            value={repo ?? ""}
            onChange={(e) => setParam("repo", e.target.value || null)}
            className="h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">全部项目</option>
            {projects.map(([path, name]) => (
              <option key={path} value={path}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isError && <div className="p-4 text-xs text-danger">加载失败：{String(error)}</div>}

      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="flex h-full gap-3 p-3">
          {COLUMNS.map((col) => {
            const rows = goals.filter((g) => col.statuses.includes(g.status));
            return (
              <div key={col.key} className="flex h-full w-[290px] shrink-0 flex-col rounded-lg bg-muted/40">
                <div className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium">
                  <Dot tone={col.tone} />
                  <span>{col.label}</span>
                  <span className="text-muted-foreground">{rows.length}</span>
                  <button className="ml-auto flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent [&_svg]:size-3.5">
                    <Plus />
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {isPending && <Skeleton className="h-20 w-full" />}
                  {!isPending && rows.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted-foreground/70">无工单</div>
                  )}
                  {rows.map((g) => (
                    <KanbanCard key={g.id} goal={g} onOpen={() => navigate(`/tickets/${g.id}`)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
