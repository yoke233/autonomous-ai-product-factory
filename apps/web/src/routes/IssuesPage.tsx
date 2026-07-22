import { ArrowRight, Bot, CircleDot, GitBranch, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { IssueGraph } from "@/components/IssueGraph";
import { IssueBadge, RunBadge } from "@/components/DomainUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { issueReadiness } from "@/domain";
import { useFactory } from "@/factory-store";

export function IssuesPage() {
  const { issues, runs } = useFactory();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => issues.filter((issue) => `${issue.number} ${issue.title} ${issue.labels.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [issues, query]);
  const ready = issues.filter((issue) => issueReadiness(issue, issues, runs).ready).length;
  const active = issues.filter((issue) => runs.some((run) => run.issueId === issue.id && run.state !== "completed")).length;
  const blocked = issues.filter((issue) => issue.state === "open" && !issueReadiness(issue, issues, runs).ready && !runs.some((run) => run.issueId === issue.id && run.state !== "completed")).length;
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Repository workflow</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Issue 任务图</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">节点是 Issue。父子关系负责拆分，前置依赖决定 Agent 何时可以接手。</p></div><Button asChild><Link to="/issues/new"><Plus />新建 Issue</Link></Button></div>
    <div className="grid gap-3 sm:grid-cols-3"><Card className="p-4"><p className="text-xs text-muted-foreground">已就绪</p><p className="mt-2 text-2xl font-semibold text-success">{ready}</p><p className="mt-1 text-[11px] text-muted-foreground">全部入边均已满足</p></Card><Card className="p-4"><p className="text-xs text-muted-foreground">Agent 正在处理</p><p className="mt-2 text-2xl font-semibold text-info">{active}</p><p className="mt-1 text-[11px] text-muted-foreground">每个 Issue 最多一个有效 Run</p></Card><Card className="p-4"><p className="text-xs text-muted-foreground">等待依赖或授权</p><p className="mt-2 text-2xl font-semibold text-warning">{blocked}</p><p className="mt-1 text-[11px] text-muted-foreground">可查看具体阻塞条件</p></Card></div>
    <section><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">依赖视图</h2><p className="text-[11px] text-muted-foreground">前置 Issue → 被阻塞 Issue；Sub-issue → Parent 是隐式完成边</p></div><Badge><GitBranch />{issues.length} 个节点</Badge></div><IssueGraph issues={issues} runs={runs} /></section>
    <section><div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold">全部 Issue</h2><p className="text-[11px] text-muted-foreground">同一个 Issue 在返工期间保持同一身份</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索编号、标题或标签" className="pl-8" /></div></div>
      <div className="overflow-hidden rounded-xl border bg-card"><div className="hidden grid-cols-[90px_1fr_150px_150px_28px] border-b bg-muted/50 px-4 py-2 text-[11px] font-medium text-muted-foreground md:grid"><span>状态</span><span>Issue</span><span>运行</span><span>依赖</span><span /></div>{visible.map((issue) => { const currentRun = runs.find((run) => run.issueId === issue.id && run.state !== "completed"); const readiness = issueReadiness(issue, issues, runs); return <Link key={issue.id} to={`/issues/${issue.id}`} className="grid gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/35 md:grid-cols-[90px_1fr_150px_150px_28px] md:items-center"><IssueBadge issue={issue} /><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">#{issue.number}</span><span className="truncate font-medium">{issue.title}</span></div><div className="mt-1 flex gap-1">{issue.labels.map((label) => <Badge key={label}>{label}</Badge>)}</div></div><div>{currentRun ? <RunBadge run={currentRun} /> : issue.state === "open" ? <Badge tone={readiness.ready ? "success" : "warning"}>{readiness.ready ? <CircleDot /> : <Bot />}{readiness.ready ? "可接手" : "未就绪"}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</div><div className="text-xs text-muted-foreground">{issue.blockedByIds.length ? `${issue.blockedByIds.length} 个前置` : issue.parentId ? "子 Issue" : "无前置"}</div><ArrowRight className="size-4 text-muted-foreground" /></Link>; })}</div>
    </section>
  </div>;
}
