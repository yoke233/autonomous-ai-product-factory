import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Folder,
  Inbox,
  MessagesSquare,
  Bot,
  Search,
  Settings,
  SquarePen,
  Ticket,
  CircleUser,
} from "lucide-react";

import { useGoals } from "@/api/queries";
import type { Section } from "@/components/TopBar";
import { ATTENTION } from "@/domain";
import { cn } from "@/lib/utils";

function NavItem({
  to,
  icon,
  label,
  count,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  /** 覆盖 NavLink 默认的路径匹配（用于按 query 区分同路径的两个入口）。 */
  active?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          (active ?? isActive) && "bg-accent text-accent-foreground [&_svg]:text-foreground",
        )
      }
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count != null && count > 0 && (
        <span className="rounded bg-warning-soft px-1.5 text-xs font-semibold text-warning">
          {count}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar({ section }: { section: Section }) {
  void section;
  const navigate = useNavigate();
  const loc = useLocation();
  const goals = useGoals();
  const inboxCount = (goals.data ?? []).filter((g) => ATTENTION.includes(g.status)).length;

  const onTickets = loc.pathname.startsWith("/tickets");
  const mineActive = onTickets && new URLSearchParams(loc.search).get("scope") === "mine";
  const allTicketsActive = onTickets && !mineActive;
  const mineCount = (goals.data ?? []).filter((g) =>
    ["RECEIVED", "RUNNING", "AWAITING_APPROVAL"].includes(g.status),
  ).length;

  return (
    <aside className="flex min-h-0 flex-col gap-1 border-r border-border bg-background px-2 pb-3 pt-2">
      <div className="mb-1 flex items-center gap-2 px-1.5 py-1">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
          涌
        </div>
        <div className="flex-1 truncate text-[13.5px] font-semibold">自主产品工厂</div>
      </div>

      <button
        type="button"
        disabled
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground [&_svg]:size-4"
      >
        <Search />
        <span className="flex-1 text-left">搜索…</span>
        <span className="flex gap-0.5 text-[10px] text-muted-foreground/70">
          <kbd className="rounded border border-border px-1">Ctrl</kbd>
          <kbd className="rounded border border-border px-1">K</kbd>
        </span>
      </button>

      <button
        type="button"
        onClick={() => navigate("/chat")}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors hover:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground"
      >
        <SquarePen />
        <span className="flex-1 text-left">新建工单</span>
        <kbd className="rounded border border-border px-1 text-[10px] text-muted-foreground/70">C</kbd>
      </button>

      <nav className="mt-2 flex flex-col gap-0.5">
        <NavItem to="/inbox" icon={<Inbox />} label="收件箱" count={inboxCount} />
        <NavItem to="/chat" icon={<MessagesSquare />} label="对话" />
        <NavItem
          to="/tickets?scope=mine"
          icon={<CircleUser />}
          label="我的工单"
          active={mineActive}
          count={mineCount}
        />
      </nav>

      <div className="mt-3 flex flex-col gap-0.5">
        <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          工作区
        </div>
        <NavItem to="/tickets" icon={<Ticket />} label="工单" active={allTicketsActive} />
        <NavItem to="/projects" icon={<Folder />} label="项目" />
        <NavItem to="/workers" icon={<Bot />} label="Worker" />
      </div>

      <div className="mt-3 flex flex-col gap-0.5">
        <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          配置
        </div>
        <NavItem to="/settings" icon={<Settings />} label="设置" />
      </div>
    </aside>
  );
}
