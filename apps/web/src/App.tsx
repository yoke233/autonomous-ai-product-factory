import { Outlet, useLocation } from "react-router-dom";

import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { IntakesProvider } from "@/intakes";

import type { Section } from "@/components/TopBar";

function sectionOf(pathname: string): Section {
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/tickets")) return "tickets";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/workers")) return "workers";
  if (pathname.startsWith("/settings")) return "settings";
  return "inbox";
}

export default function App() {
  const section = sectionOf(useLocation().pathname);
  return (
    <div className="grid h-screen grid-cols-[240px_1fr] grid-rows-[minmax(0,1fr)] overflow-hidden">
      <Sidebar section={section} />
      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <TopBar section={section} />
        <IntakesProvider>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </div>
        </IntakesProvider>
      </main>
    </div>
  );
}
