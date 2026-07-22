import { Check, ExternalLink, GitBranch, RefreshCcw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatTime } from "@/domain";
import { useFactory } from "@/factory-store";

export function ProviderPage() {
  const { repositories } = useFactory();
  const repo = repositories[0]!;
  const permissions = ["Metadata · 读取", "Issues · 管理 Issue、Sub-issues 与 Dependencies", "Contents · 读取并推送 Agent 分支", "Pull requests · 创建、更新和请求 Review", "Checks · 发布 Agent Check"];
  return <div className="mx-auto max-w-4xl space-y-5"><div><h1 className="text-2xl font-semibold">GitHub 接入</h1><p className="mt-1 text-sm text-muted-foreground">GitHub 是第一套 Provider，不是写死在应用层里的领域模型。</p></div><Card className="p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-xl bg-foreground text-background"><GitBranch className="size-5" /></span><div><div className="flex items-center gap-2"><h2 className="font-semibold">{repo.fullName}</h2><Badge tone="success"><Check />已连接</Badge></div><p className="mt-1 text-xs text-muted-foreground">GitHub App installation · 默认分支 {repo.defaultBranch}</p></div></div><Button asChild variant="outline"><a href={repo.url} target="_blank" rel="noreferrer">打开仓库<ExternalLink /></a></Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">最近同步</p><p className="mt-1 font-medium">{formatTime(repo.syncedAt)}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-success"><RefreshCcw className="size-3" />Webhook 与对账正常</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">事实边界</p><p className="mt-1 text-xs leading-5">Issue / PR 来自 GitHub；Run / 日志 / 通知由 Factory 保存。</p></div></div></Card><Card className="p-5"><h2 className="text-sm font-semibold">最小仓库权限</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{permissions.map((permission) => <div key={permission} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs"><ShieldCheck className="size-4 text-success" />{permission}</div>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">不会申请 Administration、Deployments、Environments、Actions 管理或仓库规则修改权限。CI/CD 和部署仍由专业系统负责。</p></Card></div>;
}
