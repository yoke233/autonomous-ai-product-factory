import { useNavigate } from "react-router-dom";
import { ChevronRight, Folder } from "lucide-react";

import { useGoals } from "@/api/queries";
import type { Goal } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dot } from "@/components/status";
import { GROUPS, projectName, relTime } from "@/domain";

interface Project {
  path: string;
  name: string;
  total: number;
  updatedAt: string;
  groups: { label: string; tone: (typeof GROUPS)[number]["tone"]; count: number }[];
}

function summarize(goals: Goal[]): Project[] {
  const map = new Map<string, Goal[]>();
  for (const g of goals) {
    const arr = map.get(g.repo_path) ?? [];
    arr.push(g);
    map.set(g.repo_path, arr);
  }
  return Array.from(map.entries())
    .map(([path, gs]) => ({
      path,
      name: projectName(path),
      total: gs.length,
      updatedAt: gs.reduce((a, g) => (g.updated_at > a ? g.updated_at : a), gs[0]!.updated_at),
      groups: GROUPS.map((grp) => ({
        label: grp.label,
        tone: grp.tone,
        count: gs.filter((g) => grp.statuses.includes(g.status)).length,
      })),
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function ProjectsView() {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useGoals();
  const projects = summarize(data ?? []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
        <h2 className="text-[13px] font-semibold">项目</h2>
        <span className="text-xs text-muted-foreground">{projects.length} 个仓库</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isError && <p className="text-xs text-danger">加载失败：{String(error)}</p>}
        {isPending && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {!isPending && !isError && projects.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground [&_svg]:size-8">
            <Folder />
            <p className="text-[13px]">还没有项目，去「对话」发起第一个工单</p>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {projects.map((p) => (
            <Card
              key={p.path}
              className="cursor-pointer p-4 transition-colors hover:border-input"
              onClick={() => navigate(`/tickets?repo=${encodeURIComponent(p.path)}`)}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
                  <Folder />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{p.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{p.path}</div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                {p.groups
                  .filter((g) => g.count > 0)
                  .map((g) => (
                    <span key={g.label} className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Dot tone={g.tone} />
                      {g.label}
                      <span className="font-medium text-foreground">{g.count}</span>
                    </span>
                  ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                <span>共 {p.total} 个工单</span>
                <span>更新于 {relTime(p.updatedAt)}前</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
