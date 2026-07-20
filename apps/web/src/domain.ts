import type { Goal } from "@/api/client";

/* ---------------- 领域映射 ---------------- */

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "已受理",
  RUNNING: "生产中",
  AWAITING_APPROVAL: "待批准",
  DELIVERED: "已交付",
  NO_SAFE_DELIVERY: "无安全交付",
  CANCELLED: "已取消",
  SYSTEM_FAULT: "系统故障",
};

export type Tone = "warning" | "success" | "info" | "danger" | "muted";

const STATUS_TONE: Record<string, Tone> = {
  RECEIVED: "info",
  RUNNING: "info",
  AWAITING_APPROVAL: "warning",
  DELIVERED: "success",
  NO_SAFE_DELIVERY: "danger",
  CANCELLED: "muted",
  SYSTEM_FAULT: "danger",
};

/** 需要人介入 / 已终态但值得留在收件箱的状态。 */
export const ATTENTION = ["AWAITING_APPROVAL", "NO_SAFE_DELIVERY", "SYSTEM_FAULT"];

export const GROUPS: { label: string; tone: Tone; statuses: string[] }[] = [
  { label: "待批准", tone: "warning", statuses: ["AWAITING_APPROVAL"] },
  { label: "生产中", tone: "info", statuses: ["RECEIVED", "RUNNING"] },
  { label: "已交付", tone: "success", statuses: ["DELIVERED"] },
  { label: "未交付", tone: "danger", statuses: ["NO_SAFE_DELIVERY", "SYSTEM_FAULT", "CANCELLED"] },
];

export function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s;
}

export function statusTone(s: string): Tone {
  return STATUS_TONE[s] ?? "muted";
}

export function projectName(repoPath: string): string {
  const parts = repoPath.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || repoPath;
}

export function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "刚刚";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天`;
  return new Date(iso).toLocaleDateString();
}

export function diffSummary(stat: string): { files?: string; add?: string; del?: string } {
  const line =
    stat
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .reverse()
      .find((l) => /changed/.test(l)) ?? "";
  return {
    files: line.match(/(\d+)\s+files?\s+changed/)?.[1],
    add: line.match(/(\d+)\s+insertions?/)?.[1],
    del: line.match(/(\d+)\s+deletions?/)?.[1],
  };
}

export function outcomeReason(goal: Goal): string | null {
  const r = goal.outcome?.["reason"];
  return typeof r === "string" ? r : null;
}
