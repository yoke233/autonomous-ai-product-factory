// Three variants of the Issue detail page, switchable via ?variant=, on the existing /issues/:issueId route.
import { ArrowLeft, Bot, ExternalLink, GitBranch, GitPullRequest, Plus, RotateCcw, Split, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { IssueBadge, PullRequestBadge, ReadinessChecklist, RunBadge, SectionTitle } from "@/components/DomainUI";
import { IssueGraph } from "@/components/IssueGraph";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/PrototypeSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { issueReadiness } from "@/domain";
import { useFactory } from "@/factory-store";

function RelationshipPanel({ issueId }: { issueId: string }) {
  const { issues, addDependency } = useFactory();
  const issue = issues.find((item) => item.id === issueId)!;
  const parent = issues.find((item) => item.id === issue.parentId);
  const children = issues.filter((item) => item.parentId === issue.id);
  const blockers = issue.blockedByIds.map((id) => issues.find((item) => item.id === id)).filter(Boolean);
  const blocked = issues.filter((item) => item.blockedByIds.includes(issue.id));
  const [candidate, setCandidate] = useState("");
  const [error, setError] = useState("");
  function add() { try { addDependency(issue.id, candidate); setCandidate(""); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "无法添加依赖"); } }
  const row = (label: string, items: typeof issues, icon: ReactNode) => <div className="grid grid-cols-[88px_1fr] gap-3 border-b py-2.5 last:border-0"><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{label}</span><div className="space-y-1">{items.length ? items.map((item) => <Link key={item.id} to={`/issues/${item.id}`} className="block truncate text-xs font-medium text-info hover:underline">#{item.number} {item.title}</Link>) : <span className="text-xs text-muted-foreground">无</span>}</div></div>;
  return <Card className="p-4"><SectionTitle eyebrow="Issue DAG" title="关系" action={<Button asChild size="sm" variant="outline"><Link to={`/issues/new?parent=${issue.id}`}><Plus />添加子 Issue</Link></Button>} />{row("Parent", parent ? [parent] : [], <GitBranch className="size-3" />)}{row("Sub-issues", children, <Split className="size-3" />)}{row("Blocked by", blockers as typeof issues, <ArrowLeft className="size-3" />)}{row("Blocking", blocked, <GitBranch className="size-3" />)}<div className="mt-3 flex gap-2"><select name="blockedByIssue" aria-label="选择新的前置 Issue" className="h-8 min-w-0 flex-1 rounded-md border bg-card px-2 text-xs" value={candidate} onChange={(event) => setCandidate(event.target.value)}><option value="">选择新的前置 Issue</option>{issues.filter((item) => item.id !== issue.id && !issue.blockedByIds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>#{item.number} {item.title}</option>)}</select><Button size="sm" variant="outline" disabled={!candidate} onClick={add}>添加依赖</Button></div>{error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}</Card>;
}

function ActivityList({ issueId }: { issueId: string }) {
  const { issues, pullRequests, runs, notifications } = useFactory();
  const issue = issues.find((item) => item.id === issueId)!;
  const events = [
    ...runs.filter((run) => run.issueId === issueId).map((run) => ({ id: run.id, at: run.createdAt, title: `Agent Run · ${run.id}`, body: run.logSummary, to: `/runs/${run.id}` })),
    ...pullRequests.filter((pr) => pr.issueId === issueId).map((pr) => ({ id: pr.id, at: pr.updatedAt, title: `PR #${pr.number} · ${pr.state === "merged" ? "已合并" : "已更新"}`, body: `${pr.commits.length} 个 Commit，head ${pr.headSha.slice(0, 7)}`, to: `/pulls/${pr.id}` })),
    ...notifications.filter((notice) => notice.issueId === issueId).map((notice) => ({ id: notice.id, at: notice.createdAt, title: notice.title, body: notice.body, to: notice.actionPath })),
    { id: "issue-updated", at: issue.updatedAt, title: `Issue #${issue.number} 当前状态`, body: issue.state === "open" ? "Issue 保持打开。" : `Issue 已关闭：${issue.closeReason}`, to: `/issues/${issue.id}` },
  ].sort((a, b) => b.at.localeCompare(a.at));
  return <div className="relative space-y-0 pl-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-border">{events.map((event) => <Link to={event.to} key={`${event.id}-${event.at}`} className="relative block border-b py-3 last:border-0 before:absolute before:-left-5 before:top-[18px] before:size-2.5 before:rounded-full before:border-2 before:border-background before:bg-info"><p className="text-xs font-semibold">{event.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{event.body}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(event.at).toLocaleString("zh-CN")}</p></Link>)}</div>;
}

function CompactFlow({ issueId }: { issueId: string }) {
  const { issues } = useFactory();
  const issue = issues.find((item) => item.id === issueId)!;
  const parent = issues.find((item) => item.id === issue.parentId);
  const blockers = issue.blockedByIds.map((id) => issues.find((item) => item.id === id)).filter(Boolean);
  const downstream = issues.filter((item) => item.blockedByIds.includes(issue.id));
  const group = (label: string, items: Array<(typeof issues)[number] | undefined>) => <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p><div className="space-y-2">{items.length ? items.map((item) => item ? <Link key={item.id} to={`/issues/${item.id}`} className="block rounded-lg border bg-card p-3 hover:border-info/40"><span className="font-mono text-[10px] text-muted-foreground">#{item.number}</span><span className="mt-1 block text-xs font-semibold">{item.title}</span></Link> : null) : <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">无</p>}</div></div>;
  return <Card className="min-w-0 p-4"><SectionTitle eyebrow="Selected path" title="当前执行路径" /><div className="space-y-4">{group("前置", blockers)}<div className="rounded-xl border-2 border-info bg-info-soft/30 p-4"><span className="font-mono text-[10px] text-info">当前 #{issue.number}</span><p className="mt-1 font-semibold">{issue.title}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{issue.body}</p></div>{group("下游", downstream)}{parent ? group("汇总到 Parent", [parent]) : null}</div></Card>;
}

export function IssueDetailPage() {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const variant = usePrototypeVariant();
  const { issues, pullRequests, runs, startRun, setAgentAllowed, closeIssue, reopenIssue } = useFactory();
  const issue = issues.find((item) => item.id === issueId);
  const [error, setError] = useState("");
  if (!issue) return <p>Issue 不存在。</p>;
  const readiness = issueReadiness(issue, issues, runs);
  const selectedPr = pullRequests.find((pr) => pr.id === issue.selectedPullRequestId);
  const issueRuns = runs.filter((run) => run.issueId === issue.id);
  const activeRun = issueRuns.find((run) => run.state !== "completed");
  const relatedIds = new Set([issue.id, issue.parentId, ...issue.blockedByIds, ...issues.filter((item) => item.parentId === issue.id || item.blockedByIds.includes(issue.id)).map((item) => item.id)].filter(Boolean));
  const related = issues.filter((item) => relatedIds.has(item.id));
  function run(purpose: "implement" | "split") { try { const id = startRun(issue!.id, purpose); navigate(`/runs/${id}`); } catch (reason) { setError(reason instanceof Error ? reason.message : "无法启动"); } }
  function finish(reason: "completed" | "not_planned") { try { closeIssue(issue!.id, reason); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "无法关闭 Issue"); } }
  const canComplete = readiness.checks.filter((check) => check.key === "children" || check.key === "dependencies" || check.key === "run").every((check) => check.met);
  const header = <><Button asChild variant="ghost" size="sm"><Link to="/issues"><ArrowLeft />返回 Issue 图</Link></Button><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm text-muted-foreground">#{issue.number}</span><IssueBadge issue={issue} />{readiness.ready ? <Badge tone="success">可接手</Badge> : issue.state === "open" ? <Badge tone="warning">未就绪</Badge> : null}</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">{issue.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{issue.body}</p></div><div className="flex flex-wrap gap-2">{issue.state === "open" ? <><Button variant="outline" onClick={() => run("split")} disabled={!readiness.ready}><Split />拆分 Issue</Button><Button onClick={() => run("implement")} disabled={!readiness.ready}><Bot />Agent 接手</Button><Button variant="ghost" disabled={Boolean(activeRun)} onClick={() => finish("not_planned")}><XCircle />不再处理</Button><Button variant="outline" disabled={!canComplete} onClick={() => finish("completed")}>标记完成</Button></> : <Button variant="outline" onClick={() => reopenIssue(issue.id)}><RotateCcw />重新打开</Button>}<Button asChild variant="ghost"><a href={issue.url} target="_blank" rel="noreferrer">GitHub<ExternalLink /></a></Button></div></div>{error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p> : null}</>;
  const prCard = <Card className="p-4"><SectionTitle eyebrow="Pull Request" title={selectedPr ? `PR #${selectedPr.number}` : "尚未创建 PR"} action={selectedPr ? <PullRequestBadge state={selectedPr.state} /> : null} />{selectedPr ? <><p className="text-sm font-medium">{selectedPr.title}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">head {selectedPr.headSha.slice(0, 7)} · {selectedPr.commits.length} commits</p><div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm"><Link to={`/pulls/${selectedPr.id}`}><GitPullRequest />查看 Review</Link></Button><Button asChild size="sm" variant="outline"><a href={selectedPr.url} target="_blank" rel="noreferrer">GitHub<ExternalLink /></a></Button></div></> : <p className="text-xs leading-5 text-muted-foreground">Agent 产生代码后，会为这个 Issue 建立明确的目标 PR 关联。</p>}</Card>;
  const runsCard = <Card className="p-4"><SectionTitle eyebrow="Factory" title="Agent 运行" action={<Button asChild size="sm" variant="ghost"><Link to="/runs">全部运行</Link></Button>} /><div className="space-y-2">{issueRuns.length ? issueRuns.map((run) => <Link key={run.id} to={`/runs/${run.id}`} className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted"><span><span className="block font-mono text-xs font-semibold">{run.id}</span><span className="text-[11px] text-muted-foreground">{run.trigger === "request_changes" ? "处理 Review 意见" : run.purpose === "split" ? "拆分 Issue" : "实现 Issue"}</span></span><RunBadge run={run} /></Link>) : <p className="text-xs text-muted-foreground">还没有 Run。</p>}</div></Card>;
  return <div className="space-y-5 pb-16">{header}{variant === "A" ? <><IssueGraph issues={related} runs={runs} selectedId={issue.id} /><ReadinessChecklist checks={readiness.checks} /><div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"><RelationshipPanel issueId={issue.id} /><div className="space-y-4">{prCard}{runsCard}</div></div></> : variant === "B" ? <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr_0.9fr]"><div className="space-y-4"><Card className="p-4"><SectionTitle eyebrow="Readiness" title="接手条件" /><ReadinessChecklist checks={readiness.checks} compact />{!issue.agentAllowed ? <Button className="mt-3 w-full" onClick={() => setAgentAllowed(issue.id, true)}>授权 Agent 接手</Button> : null}</Card><RelationshipPanel issueId={issue.id} /></div><CompactFlow issueId={issue.id} /><div className="space-y-4">{activeRun ? <Card className="border-info/30 bg-info-soft/30 p-4"><SectionTitle eyebrow="Active Run" title={activeRun.id} action={<RunBadge run={activeRun} />} /><p className="text-xs leading-5 text-muted-foreground">{activeRun.logSummary}</p><Button asChild className="mt-3" size="sm"><Link to={`/runs/${activeRun.id}`}>查看运行</Link></Button></Card> : null}{prCard}{runsCard}</div></div> : <div className="grid gap-4 lg:grid-cols-[1fr_360px]"><Card className="p-5"><SectionTitle eyebrow="Timeline" title="Issue 事件" /><ActivityList issueId={issue.id} /></Card><div className="space-y-4"><Card className="p-4"><SectionTitle eyebrow="Current state" title="当前推进条件" /><ReadinessChecklist checks={readiness.checks} compact /></Card>{prCard}<RelationshipPanel issueId={issue.id} /></div></div>}<PrototypeSwitcher /></div>;
}
