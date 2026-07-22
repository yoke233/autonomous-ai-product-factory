import { ArrowLeft, Ban, GitCommit, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AcpConversationVariant, AcpInspectorVariant, AcpStreamVariant } from "@/components/AcpTranscriptPrototype";
import { projectAcpSession } from "@/acp-transcript";
import { Fact, RunBadge, SectionTitle } from "@/components/DomainUI";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/PrototypeSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatTime, issueReadiness } from "@/domain";
import { useFactory } from "@/factory-store";

const transcriptLabels = {
  A: "聊天记录",
  B: "事件流",
  C: "JSON 检查器",
} as const;

export function RunDetailPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const variant = usePrototypeVariant();
  const { runs, issues, pullRequests, notifications, cancelRun, retryRun } = useFactory();
  const [error, setError] = useState("");
  const run = runs.find((item) => item.id === runId);

  if (!run) return <p>Run 不存在。</p>;

  const issue = issues.find((item) => item.id === run.issueId)!;
  const pr = pullRequests.find((item) => item.id === run.pullRequestId);
  const notices = notifications.filter((notice) => notice.runId === run.id);
  const retryReadiness = issueReadiness(issue, issues, runs);
  const acpSession = projectAcpSession(run.acpEvents);

  function retry() {
    try {
      navigate(`/runs/${retryRun(run!.id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法重新运行");
    }
  }

  return (
    <div className="space-y-5 pb-16">
      <Button asChild variant="ghost" size="sm"><Link to="/runs"><ArrowLeft />返回运行列表</Link></Button>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{run.id}</span>
            <RunBadge run={run} />
            <Badge>{run.purpose === "split" ? "拆分 Issue" : "实现 Issue"}</Badge>
            <Badge tone="info">ACP v{run.acpProtocolVersion}</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Issue #{issue.number} · {issue.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{run.executor} · {run.triggeredBy} 触发 · session <span className="font-mono">{acpSession.sessionId ?? "未建立"}</span></p>
        </div>
        <div className="flex gap-2">
          {run.state !== "completed" ? (
            <Button variant="destructive" disabled={Boolean(run.cancelRequestedAt)} onClick={() => cancelRun(run.id)}><Ban />{run.cancelRequestedAt ? "取消中" : "取消本轮"}</Button>
          ) : (
            <Button variant="outline" disabled={!retryReadiness.ready} onClick={retry}><RotateCcw />重新运行</Button>
          )}
          <Button asChild variant="outline"><Link to={`/issues/${issue.id}`}>查看 Issue</Link></Button>
        </div>
      </div>
      {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p> : null}
      {run.state === "completed" && !retryReadiness.ready ? <p className="text-xs text-muted-foreground">当前不可重试：{retryReadiness.checks.find((check) => !check.met)?.detail}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="ACP 会话" value={acpSession.sessionId ?? (acpSession.status === "failed" ? acpSession.error ?? "建立失败" : acpSession.status === "pending" ? "建立中" : "未建立")} state={acpSession.status === "completed" && acpSession.sessionId === run.acpSessionId ? "yes" : acpSession.status === "failed" || (acpSession.status === "completed" && acpSession.sessionId !== run.acpSessionId) ? "no" : acpSession.status === "pending" ? "running" : "unknown"} />
        <Fact label="协议事件" value={`${run.acpEvents.length} 条 JSON`} state={run.state === "completed" ? "yes" : "running"} />
        <Fact label="目标 PR" value={pr ? `#${pr.number}` : "本轮无 PR"} state={pr ? "yes" : "unknown"} />
        <Fact label="最终 Commit" value={run.finalCommitSha?.slice(0, 7) ?? "尚未产生"} state={run.finalCommitSha ? "yes" : run.state === "completed" ? "unknown" : "running"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-info">ACP 协议记录</p>
              <h2 className="mt-1 text-lg font-semibold">Agent 执行会话</h2>
              <p className="mt-1 text-xs text-muted-foreground">聊天、工具和计划均从收到的 JSON-RPC 事件即时投影。</p>
            </div>
            <Badge>{transcriptLabels[variant]}</Badge>
          </div>
          {variant === "A" ? <AcpConversationVariant events={run.acpEvents} /> : variant === "B" ? <AcpStreamVariant events={run.acpEvents} /> : <AcpInspectorVariant events={run.acpEvents} />}
        </section>

        <aside className="space-y-4">
          <Card className="p-4">
            <SectionTitle eyebrow="运行上下文" title="本轮输入" />
            <dl className="space-y-3 text-xs">
              <div><dt className="text-muted-foreground">Issue / 评论 / Review</dt><dd className="mt-1 leading-5">{run.inputSummary}</dd></div>
              <div><dt className="text-muted-foreground">Issue DAG</dt><dd className="mt-1 leading-5">{run.graphSummary}</dd></div>
              <div><dt className="text-muted-foreground">Base SHA</dt><dd className="mt-1 font-mono">{run.baseSha}</dd></div>
              {run.startingHeadSha ? <div><dt className="text-muted-foreground">启动时 PR head</dt><dd className="mt-1 font-mono">{run.startingHeadSha}</dd></div> : null}
              <div><dt className="text-muted-foreground">开始时间</dt><dd className="mt-1">{run.startedAt ? formatTime(run.startedAt) : "尚未开始"}</dd></div>
              {run.finishedAt ? <div><dt className="text-muted-foreground">结束时间</dt><dd className="mt-1">{formatTime(run.finishedAt)} · {run.durationMinutes ?? 0} 分钟 · ${run.costUsd?.toFixed(2) ?? "0.00"}</dd></div> : null}
            </dl>
          </Card>
          <Card className="p-4">
            <SectionTitle eyebrow="本轮输出" title="本轮产生的事实" />
            <div className="space-y-2 text-xs">
              {run.finalCommitSha ? <p className="flex items-center gap-2"><GitCommit className="size-4" /><span className="font-mono">{run.finalCommitSha}</span></p> : null}
              {run.createdIssueIds.map((id) => {
                const child = issues.find((item) => item.id === id);
                return <Link key={id} className="block text-info" to={`/issues/${id}`}>新建 Sub-issue #{child?.number}</Link>;
              })}
              {!run.finalCommitSha && !run.createdIssueIds.length ? <p className="text-muted-foreground">尚未产生 Commit 或 Sub-issue。</p> : null}
            </div>
          </Card>
          <Card className="p-4">
            <SectionTitle eyebrow="通知" title="通知投递" />
            <div className="space-y-2">
              {notices.length ? notices.map((notice) => (
                <div key={notice.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                  <span>{notice.title}</span>
                  <Badge tone={notice.delivery === "sent" ? "success" : "warning"}>{notice.delivery === "sent" ? "已发送" : "重试中"}</Badge>
                </div>
              )) : <p className="text-xs text-muted-foreground">暂无通知。</p>}
            </div>
          </Card>
        </aside>
      </div>
      <PrototypeSwitcher labels={transcriptLabels} />
    </div>
  );
}
