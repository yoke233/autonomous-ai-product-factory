import { Bot, Folder, Inbox, MessagesSquare, PanelLeft, Settings, Ticket } from "lucide-react";

import { useGoals } from "@/api/queries";
import { cn } from "@/lib/utils";

export type Section = "inbox" | "chat" | "tickets" | "projects" | "workers" | "settings";

const SECTION: Record<Section, { icon: React.ReactNode; title: string }> = {
  inbox: { icon: <Inbox />, title: "收件箱" },
  chat: { icon: <MessagesSquare />, title: "对话" },
  tickets: { icon: <Ticket />, title: "工单" },
  projects: { icon: <Folder />, title: "项目" },
  workers: { icon: <Bot />, title: "Worker" },
  settings: { icon: <Settings />, title: "设置" },
};

function ConnectionIndicator() {
  const goals = useGoals();
  const state = goals.isError
    ? { tone: "bg-danger", text: "连接中断，正在重试…" }
    : goals.isPending
      ? { tone: "bg-warning", text: "连接中…" }
      : { tone: "bg-success", text: "已连接" };
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={goals.isError ? String(goals.error) : undefined}>
      <span className={cn("size-1.5 rounded-full", state.tone, goals.isFetching && "animate-pulse")} />
      {state.text}
    </div>
  );
}

export function TopBar({ section }: { section: Section }) {
  const { icon, title } = SECTION[section];
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2">
      <button
        type="button"
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent [&_svg]:size-4"
      >
        <PanelLeft />
      </button>
      <div className="mx-1 h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="flex-1" />
      <ConnectionIndicator />
      <div className="w-2" />
    </div>
  );
}
