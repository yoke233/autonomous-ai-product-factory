import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";

import App from "./App";
import { InboxView } from "@/routes/InboxView";
import { ConversationView } from "@/routes/ConversationView";
import { TicketsView } from "@/routes/TicketsView";
import { TicketDetail } from "@/routes/TicketDetail";
import { ProjectsView } from "@/routes/ProjectsView";
import { WorkersView } from "@/routes/WorkersView";
import { SettingsView } from "@/routes/SettingsView";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: "inbox", element: <InboxView /> },
      { path: "inbox/:id", element: <InboxView /> },
      { path: "chat", element: <ConversationView /> },
      { path: "chat/:id", element: <ConversationView /> },
      { path: "tickets", element: <TicketsView /> },
      { path: "tickets/:id", element: <TicketDetail /> },
      { path: "projects", element: <ProjectsView /> },
      { path: "workers", element: <WorkersView /> },
      { path: "settings", element: <SettingsView /> },
      { path: "*", element: <Navigate to="/inbox" replace /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
