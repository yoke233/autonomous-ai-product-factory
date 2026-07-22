import { Bell, Bot, GitPullRequest, Menu, Network, PlugZap, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useFactory } from "@/factory-store";
import { cn } from "@/lib/utils";

const navigation = [
  { to: "/issues", label: "Issue 图", icon: Network },
  { to: "/pulls", label: "Pull Requests", icon: GitPullRequest },
  { to: "/runs", label: "Agent 运行", icon: Bot },
  { to: "/notifications", label: "通知", icon: Bell },
  { to: "/settings/provider", label: "GitHub 接入", icon: PlugZap },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { unreadCount, resetDemo } = useFactory();
  return (
    <>
      <div className="px-4 pb-5 pt-5">
        <Link to="/issues" onClick={onNavigate} className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-foreground text-[11px] font-bold text-background shadow-sm">AF</span>
          <span>
            <span className="block text-sm font-semibold tracking-tight">Agent Factory</span>
            <span className="block text-[11px] text-muted-foreground">Issue 驱动开发</span>
          </span>
        </Link>
      </div>
      <div className="px-3">
        <Button asChild className="w-full justify-start shadow-sm"><Link to="/issues/new" onClick={onNavigate}><Plus />新建 Issue</Link></Button>
      </div>
      <nav className="mt-6 space-y-1 px-3" aria-label="主导航">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive && "bg-card text-foreground shadow-sm ring-1 ring-border",
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {item.to === "/notifications" && unreadCount ? <span className="grid min-w-5 place-items-center rounded-full bg-danger-soft px-1.5 text-[11px] font-semibold text-danger">{unreadCount}</span> : null}
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto border-t p-3">
        <button type="button" onClick={resetDemo} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><RotateCcw className="size-3.5" />重置演示数据</button>
        <div className="mt-2 rounded-lg bg-muted/70 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
          <span className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><span className="size-1.5 rounded-full bg-success" />GitHub 已连接</span>
          Issue / PR 来自 GitHub；Run 与通知来自 Factory。
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuDialogRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const section = navigation.find((item) => location.pathname.startsWith(item.to));

  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuDialogRef.current?.querySelector<HTMLElement>("[data-nav-close]")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [menuOpen]);

  function keepFocusInMenu(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(menuDialogRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? []);
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-muted/35 lg:flex"><Navigation /></aside>
      {menuOpen ? (
        <div ref={menuDialogRef} role="dialog" aria-modal="true" aria-label="主导航" onKeyDown={keepFocusInMenu} className="fixed inset-0 z-50 lg:hidden">
          <button tabIndex={-1} aria-label="关闭导航" className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex h-full w-[min(82vw,300px)] flex-col border-r bg-background shadow-2xl">
            <button data-nav-close className="absolute right-3 top-3 grid size-8 place-items-center rounded-md hover:bg-muted" onClick={() => setMenuOpen(false)} aria-label="关闭导航"><X className="size-4" /></button>
            <Navigation onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6">
          <button className="mr-3 grid size-8 place-items-center rounded-md hover:bg-muted lg:hidden" onClick={() => setMenuOpen(true)} aria-label="打开导航"><Menu className="size-4" /></button>
          <div>
            <p className="text-sm font-semibold">{section?.label ?? "Issue"}</p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">Issue、PR 与 Agent 运行保持独立状态</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden sm:inline">GitHub App</span><span className="rounded-full border bg-card px-2.5 py-1 font-medium text-success">已连接</span></div>
        </header>
        <main className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-9">{children}</main>
      </div>
    </div>
  );
}
