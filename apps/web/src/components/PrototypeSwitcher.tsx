import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const variants = [
  { key: "A", label: "图谱优先" },
  { key: "B", label: "开发面板" },
  { key: "C", label: "事件时间线" },
] as const;

export function usePrototypeVariant() {
  const [params] = useSearchParams();
  const value = params.get("variant")?.toUpperCase();
  return variants.some((item) => item.key === value) ? value as "A" | "B" | "C" : "A";
}

export function PrototypeSwitcher({ labels }: { labels?: Record<"A" | "B" | "C", string> }) {
  const [params, setParams] = useSearchParams();
  const current = usePrototypeVariant();
  const index = variants.findIndex((item) => item.key === current);
  function move(offset: number) {
    const next = variants[(index + offset + variants.length) % variants.length]!;
    const updated = new URLSearchParams(params);
    updated.set("variant", next.key);
    setParams(updated, { replace: true });
  }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (import.meta.env.PROD) return null;
  const meta = variants[index]!;
  const label = labels?.[meta.key] ?? meta.label;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center rounded-full bg-foreground p-1 text-background shadow-2xl ring-1 ring-background/20">
      <button className="grid size-8 place-items-center rounded-full hover:bg-background/15" onClick={() => move(-1)} aria-label="上一种布局"><ChevronLeft className="size-4" /></button>
      <span className="min-w-32 px-3 text-center text-xs font-semibold">{meta.key} · {label}</span>
      <button className="grid size-8 place-items-center rounded-full hover:bg-background/15" onClick={() => move(1)} aria-label="下一种布局"><ChevronRight className="size-4" /></button>
    </div>
  );
}
