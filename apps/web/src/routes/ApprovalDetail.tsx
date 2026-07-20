import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

import { useGoal } from "@/api/queries";
import { StatusBadge } from "@/components/status";
import { projectName, relTime } from "@/domain";
import {
  AssessmentBlock,
  GoalActions,
  GoalSecondary,
  LoadingDetail,
  PlanBlock,
  SummaryBlock,
} from "./goal-parts";

export function ApprovalDetail({ id }: { id: string }) {
  const { data: detail, isPending, isError, error } = useGoal(id);

  if (isError) {
    return <div className="px-5 py-4 text-[13px] text-danger">{String(error)}</div>;
  }
  if (isPending || !detail) return <LoadingDetail />;

  const { goal } = detail;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{goal.id}</span>
          <span className="text-[15px] font-semibold">{goal.goal_text.slice(0, 40) || "（无标题）"}</span>
          <StatusBadge status={goal.status} />
          <Link
            to={`/tickets/${goal.id}`}
            className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
          >
            <ExternalLink />
            打开工单页
          </Link>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{projectName(goal.repo_path)}</span>
          <span className="size-0.5 rounded-full bg-muted-foreground/40" />
          <span>目标 2 分钟内可决策</span>
          <span className="size-0.5 rounded-full bg-muted-foreground/40" />
          <span>更新于 {relTime(goal.updated_at)}前</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SummaryBlock detail={detail} />
        <AssessmentBlock detail={detail} />
        <PlanBlock detail={detail} />
        <GoalActions goal={goal} className="px-5 py-4" />
        <div className="px-5 pb-6 pt-2">
          <GoalSecondary detail={detail} />
        </div>
      </div>
    </div>
  );
}
