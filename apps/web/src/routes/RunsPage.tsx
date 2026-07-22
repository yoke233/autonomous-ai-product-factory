import { ArrowRight, Bot } from "lucide-react";
import { Link } from "react-router-dom";

import { RunBadge } from "@/components/DomainUI";
import { Card } from "@/components/ui/card";
import { formatTime } from "@/domain";
import { useFactory } from "@/factory-store";

export function RunsPage() {
  const { runs, issues } = useFactory();
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Agent 运行</h1><p className="mt-1 text-sm text-muted-foreground">每个 Run 只接手一个 Issue；Run 成功不会自动关闭 Issue。</p></div><div className="overflow-hidden rounded-xl border bg-card"><div className="hidden grid-cols-[150px_1fr_150px_170px_28px] border-b bg-muted/50 px-4 py-2 text-[11px] font-medium text-muted-foreground md:grid"><span>Run</span><span>Issue</span><span>状态</span><span>启动时间</span><span /></div>{runs.map((run) => { const issue = issues.find((item) => item.id === run.issueId); return <Link key={run.id} to={`/runs/${run.id}`} className="grid gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/35 md:grid-cols-[150px_1fr_150px_170px_28px] md:items-center"><span className="flex items-center gap-2 font-mono text-xs font-semibold"><Bot className="size-4 text-info" />{run.id}</span><span className="truncate text-xs"><span className="font-mono text-muted-foreground">#{issue?.number}</span> {issue?.title}</span><RunBadge run={run} /><span className="text-xs text-muted-foreground">{formatTime(run.createdAt)}</span><ArrowRight className="size-4 text-muted-foreground" /></Link>; })}</div></div>;
}
