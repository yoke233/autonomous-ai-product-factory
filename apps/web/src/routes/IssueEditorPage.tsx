import { ArrowLeft, GitBranch } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFactory } from "@/factory-store";

export function IssueEditorPage() {
  const { issues, repositories, createIssue } = useFactory();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [parentId, setParentId] = useState(params.get("parent") ?? "");
  const [blockedByIds, setBlockedByIds] = useState<string[]>([]);
  const [agentAllowed, setAgentAllowed] = useState(true);
  const [error, setError] = useState("");

  function submit() {
    if (!title.trim() || !body.trim()) {
      setError("请填写标题和说明");
      return;
    }

    try {
      const id = createIssue({
        repositoryId: repositories[0]!.id,
        title,
        body,
        parentId: parentId || undefined,
        blockedByIds,
        agentAllowed,
      });
      navigate(`/issues/${id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法创建 Issue");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/issues">
          <ArrowLeft />返回 Issue 图
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold">新建 Issue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          新建普通 Issue 或某个 Parent 下的 Sub-issue；后续修改仍属于同一个 Issue。
        </p>
      </div>
      <Card className="space-y-5 p-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">标题</span>
          <Input name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="清晰描述一件可完成的工作" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">说明</span>
          <Textarea name="body" rows={7} value={body} onChange={(event) => setBody(event.target.value)} placeholder="目标、约束和验收方式" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Parent（可选）</span>
          <select
            name="parentIssue"
            className="h-8 w-full rounded-md border bg-card px-2.5 text-[13px]"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">没有 Parent</option>
            {issues.filter((issue) => issue.state === "open").map((issue) => (
              <option key={issue.id} value={issue.id}>#{issue.number} {issue.title}</option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">Sub-issue → Parent 会形成隐式完成边。</span>
        </label>
        <fieldset>
          <legend className="mb-2 text-xs font-medium">Blocked by（可选）</legend>
          <div className="max-h-40 space-y-1 overflow-auto rounded-lg border p-2">
            {issues.filter((issue) => issue.id !== parentId).map((issue) => (
              <label key={issue.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted">
                <input
                  name="blockedByIssue"
                  type="checkbox"
                  checked={blockedByIds.includes(issue.id)}
                  onChange={(event) => setBlockedByIds(event.target.checked
                    ? [...blockedByIds, issue.id]
                    : blockedByIds.filter((id) => id !== issue.id))}
                />
                <span className="font-mono text-muted-foreground">#{issue.number}</span>{issue.title}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center justify-between rounded-lg border px-3 py-3">
          <span>
            <span className="block text-xs font-medium">允许 Agent 接手</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">关闭后 Issue 会保持阻塞，直到用户授权。</span>
          </span>
          <input name="agentAllowed" type="checkbox" checked={agentAllowed} onChange={(event) => setAgentAllowed(event.target.checked)} />
        </label>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline"><Link to="/issues">取消</Link></Button>
          <Button onClick={submit}><GitBranch />创建 Issue</Button>
        </div>
      </Card>
    </div>
  );
}
