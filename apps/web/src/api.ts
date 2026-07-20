export interface Goal {
  id: string;
  revision: number;
  repo_path: string;
  goal_text: string;
  boundary: { deliveryMode: string; repoProfile: { buildCommand?: string; testCommand?: string } };
  status: string;
  outcome: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GoalDetail {
  goal: Goal;
  runs: { id: string; status: string; branch: string | null; worktree_path: string | null; error: string | null }[];
  candidate: { branch: string; diff_stat: string; patch: string; head_commit: string } | null;
  assessment: { verdict: string; evidence: { checks: { name: string; command: string; exitCode: number; outputTail: string }[]; notes?: string } } | null;
  events: { id: number; kind: string; message: string; created_at: string }[];
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  listGoals: () => fetch("/api/goals").then((r) => j<Goal[]>(r)),
  getGoal: (id: string) => fetch(`/api/goals/${id}`).then((r) => j<GoalDetail>(r)),
  createGoal: (body: { repoPath: string; goalText: string; repoProfile: { buildCommand?: string; testCommand?: string } }) =>
    fetch("/api/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => j<Goal>(r)),
  approve: (id: string) => fetch(`/api/goals/${id}/approve`, { method: "POST" }).then((r) => j<Goal>(r)),
  reject: (id: string) => fetch(`/api/goals/${id}/reject`, { method: "POST" }).then((r) => j<Goal>(r)),
  cancel: (id: string) => fetch(`/api/goals/${id}/cancel`, { method: "POST" }).then((r) => j<Goal>(r)),
};
