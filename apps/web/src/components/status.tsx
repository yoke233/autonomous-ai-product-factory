import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone, type Tone } from "@/domain";

const DOT: Record<Tone, string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-muted-foreground",
};

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone], className)} />;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <Badge tone={tone}>
      <Dot tone={tone} />
      {statusLabel(status)}
    </Badge>
  );
}
