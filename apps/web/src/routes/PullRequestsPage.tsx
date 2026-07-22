import { ArrowRight, GitPullRequest } from "lucide-react";
import { Link } from "react-router-dom";

import { PullRequestBadge, ReviewBadge } from "@/components/DomainUI";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useFactory } from "@/factory-store";

export function PullRequestsPage() {
  const { pullRequests, issues } = useFactory();
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Pull Requests</h1><p className="mt-1 text-sm text-muted-foreground">PR 是 Issue 的代码方案；返工继续更新同一个 PR。</p></div><div className="grid gap-3">{pullRequests.map((pr) => { const issue = issues.find((item) => item.id === pr.issueId); const latestReview = pr.reviews.at(-1); return <Link key={pr.id} to={`/pulls/${pr.id}`}><Card className="grid gap-4 p-4 transition hover:border-info/40 hover:shadow-sm md:grid-cols-[1fr_170px_170px_24px] md:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><GitPullRequest className="size-4 text-info" /><span className="font-mono text-xs text-muted-foreground">#{pr.number}</span><span className="truncate font-semibold">{pr.title}</span></div><p className="mt-1 text-xs text-muted-foreground">Issue #{issue?.number} · head <span className="font-mono">{pr.headSha.slice(0, 7)}</span></p></div><PullRequestBadge state={pr.state} /><div>{latestReview ? <ReviewBadge state={latestReview.state} /> : <Badge tone="warning">等待 Review</Badge>}</div><ArrowRight className="size-4 text-muted-foreground" /></Card></Link>; })}</div></div>;
}
