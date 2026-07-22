import { AlertTriangle, Check, Circle, Clock3, GitPullRequest, LoaderCircle, ShieldCheck, X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { issueStateLabel, reviewStateLabel, runConclusionLabel, runStateLabel, type Check as CheckRecord, type Issue, type PullRequestState, type ReadinessCheck, type ReviewState, type AgentRun } from "@/domain";

export function IssueBadge({ issue }: { issue: Issue }) {
  const tone = issue.state === "open" ? "info" : issue.closeReason === "completed" ? "success" : issue.closeReason === "not_planned" ? "warning" : "muted";
  return <Badge tone={tone}>{issueStateLabel(issue)}</Badge>;
}

export function RunBadge({ run }: { run: AgentRun }) {
  const tone = run.state === "completed" ? run.conclusion === "success" ? "success" : "danger" : run.state === "in_progress" ? "info" : "warning";
  return <Badge tone={tone}>{run.state === "in_progress" ? <LoaderCircle className="animate-spin" /> : null}{run.state === "completed" ? runConclusionLabel(run.conclusion) : runStateLabel(run.state)}</Badge>;
}

export function PullRequestBadge({ state }: { state: PullRequestState }) {
  const labels = { open: "打开", merged: "已合并", closed: "已关闭" } as const;
  return <Badge tone={state === "merged" ? "success" : state === "open" ? "info" : "muted"}><GitPullRequest />{labels[state]}</Badge>;
}

export function CheckBadge({ check }: { check: CheckRecord }) {
  const tone = check.status !== "completed" ? "warning" : check.conclusion === "success" ? "success" : "danger";
  const label = check.status === "queued" ? "排队中" : check.status === "in_progress" ? "检查中" : check.conclusion === "success" ? "通过" : check.conclusion === "failure" ? "失败" : check.conclusion === "timed_out" ? "超时" : "取消";
  return <Badge tone={tone}>{label}</Badge>;
}

export function ReviewBadge({ state }: { state: ReviewState }) {
  return <Badge tone={state === "approve" ? "success" : state === "request_changes" ? "danger" : "muted"}>{reviewStateLabel(state)}</Badge>;
}

export function ReadinessChecklist({ checks, compact = false }: { checks: ReadinessCheck[]; compact?: boolean }) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-5")}>
      {checks.map((check) => (
        <div key={check.key} className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5">
          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", check.met ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
            {check.met ? <Check className="size-3" /> : <X className="size-3" />}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium">{check.label}</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{check.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function Fact({ label, value, state }: { label: string; value: string; state: "yes" | "no" | "unknown" | "running" }) {
  const Icon = state === "yes" ? Check : state === "no" ? X : state === "running" ? Clock3 : Circle;
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border bg-card px-3.5 py-3">
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", state === "yes" && "bg-success-soft text-success", state === "no" && "bg-danger-soft text-danger", state === "running" && "bg-info-soft text-info", state === "unknown" && "bg-muted text-muted-foreground")}><Icon className="size-3.5" /></span>
      <span className="min-w-0"><span className="block truncate text-[11px] text-muted-foreground">{label}</span><span className="block truncate text-xs font-semibold">{value}</span></span>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="mb-3 flex items-end justify-between gap-4"><div>{eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p> : null}<h2 className="mt-0.5 text-sm font-semibold">{title}</h2></div>{action}</div>;
}

export function InlineWarning({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 rounded-lg border border-warning/20 bg-warning-soft px-3 py-2.5 text-xs leading-5 text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{children}</div>;
}

export function EmptyState({ icon: Icon = ShieldCheck, title, description }: { icon?: typeof ShieldCheck; title: string; description: string }) {
  return <div className="grid min-h-44 place-items-center rounded-xl border border-dashed bg-muted/20 p-6 text-center"><div><span className="mx-auto mb-3 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="size-4" /></span><p className="font-medium">{title}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p></div></div>;
}
