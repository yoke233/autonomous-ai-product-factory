import { ArrowRight, Bot, GitPullRequest, LockKeyhole, Split } from "lucide-react";
import { Link } from "react-router-dom";

import { IssueBadge } from "@/components/DomainUI";
import { Badge } from "@/components/ui/badge";
import { graphEdges, issueReadiness, type AgentRun, type Issue } from "@/domain";
import { cn } from "@/lib/utils";

function Node({ issue, issues, runs, selectedId }: { issue: Issue; issues: Issue[]; runs: AgentRun[]; selectedId?: string }) {
  const readiness = issueReadiness(issue, issues, runs);
  const activeRun = runs.find((run) => run.issueId === issue.id && run.state !== "completed");

  return (
    <Link
      to={`/issues/${issue.id}`}
      className={cn(
        "block rounded-xl border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        selectedId === issue.id && "border-info ring-2 ring-info/15",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">#{issue.number}</span>
        <IssueBadge issue={issue} />
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5">{issue.title}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {activeRun ? <Badge tone="info"><Bot />运行中</Badge> : readiness.ready ? <Badge tone="success">已就绪</Badge> : issue.state === "open" ? <Badge tone="warning"><LockKeyhole />已阻塞</Badge> : null}
        {issue.parentId ? <Badge><Split />子 Issue</Badge> : null}
        {issue.selectedPullRequestId ? <Badge><GitPullRequest />有 PR</Badge> : null}
      </div>
    </Link>
  );
}

export function IssueGraph({ issues, runs, selectedId }: { issues: Issue[]; runs: AgentRun[]; selectedId?: string }) {
  const completed = issues.filter((issue) => issue.state === "closed" && issue.closeReason === "completed");
  const active = issues.filter((issue) => issue.state === "open" && runs.some((run) => run.issueId === issue.id && run.state !== "completed"));
  const ready = issues.filter((issue) => issueReadiness(issue, issues, runs).ready);
  const blocked = issues.filter((issue) => issue.closeReason === "not_planned" || (issue.state === "open" && !active.includes(issue) && !ready.includes(issue)));
  const stages = [
    { title: "已完成", hint: "可以满足下游依赖", items: completed },
    { title: "可接手 / 执行中", hint: "Agent 当前工作集", items: [...ready, ...active.filter((item) => !ready.includes(item))] },
    { title: "阻塞 / 需处理", hint: "等待依赖、授权或重新规划", items: blocked },
  ];
  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const edges = graphEdges(issues).filter((edge) => issueById.has(edge.from) && issueById.has(edge.to));

  return (
    <div className="overflow-hidden rounded-xl border bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px]">
      <div className="overflow-x-auto p-4">
        <div className="grid min-w-[900px] grid-cols-3 gap-4">
          {stages.map((stage) => (
            <section key={stage.title} className="min-w-0">
              <div className="mb-3">
                <p className="text-xs font-semibold">{stage.title}</p>
                <p className="text-[11px] text-muted-foreground">{stage.hint}</p>
              </div>
              <div className="space-y-2">
                {stage.items.map((issue) => <Node key={issue.id} issue={issue} issues={issues} runs={runs} selectedId={selectedId} />)}
                {!stage.items.length ? <p className="rounded-xl border border-dashed bg-card/70 p-3 text-xs text-muted-foreground">暂无 Issue</p> : null}
              </div>
            </section>
          ))}
        </div>
      </div>
      <section className="border-t bg-card/90 p-4" aria-label="Issue 任务流转">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold">Issue 之间的任务流转</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">每一行都是图中的真实边，不表示 Run 内部步骤。</p>
          </div>
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <Badge>前置依赖</Badge>
            <Badge><Split />子项汇总</Badge>
          </div>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {edges.map((edge) => {
            const from = issueById.get(edge.from)!;
            const to = issueById.get(edge.to)!;
            return (
              <div key={`${edge.kind}-${edge.from}-${edge.to}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border bg-background px-3 py-2.5">
                <Link to={`/issues/${from.id}`} className="min-w-0 text-xs font-medium hover:text-info">
                  <span className="font-mono text-[10px] text-muted-foreground">#{from.number}</span>
                  <span className="ml-1.5 truncate">{from.title}</span>
                </Link>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground" aria-label={edge.kind === "parent" ? "子项汇总边" : "前置依赖边"}>
                  {edge.kind === "parent" ? <Split className="size-3" /> : null}
                  <span>{edge.kind === "parent" ? "汇总" : "前置"}</span>
                  <ArrowRight className="size-4" />
                </span>
                <Link to={`/issues/${to.id}`} className="min-w-0 text-right text-xs font-medium hover:text-info">
                  <span className="truncate">{to.title}</span>
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">#{to.number}</span>
                </Link>
              </div>
            );
          })}
          {!edges.length ? <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">当前范围没有父子边或依赖边。</p> : null}
        </div>
      </section>
    </div>
  );
}
