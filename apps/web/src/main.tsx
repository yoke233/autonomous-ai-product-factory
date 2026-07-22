import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";

import App from "@/App";
import { FactoryProvider } from "@/factory-store";
import { IssueDetailPage } from "@/routes/IssueDetailPage";
import { IssueEditorPage } from "@/routes/IssueEditorPage";
import { IssuesPage } from "@/routes/IssuesPage";
import { NotificationsPage } from "@/routes/NotificationsPage";
import { ProviderPage } from "@/routes/ProviderPage";
import { PullRequestDetailPage } from "@/routes/PullRequestDetailPage";
import { PullRequestsPage } from "@/routes/PullRequestsPage";
import { RunDetailPage } from "@/routes/RunDetailPage";
import { RunsPage } from "@/routes/RunsPage";
import "@/index.css";

const router = createBrowserRouter([{ path: "/", element: <App />, children: [
  { index: true, element: <Navigate to="/issues" replace /> },
  { path: "issues", element: <IssuesPage /> },
  { path: "issues/new", element: <IssueEditorPage /> },
  { path: "issues/:issueId", element: <IssueDetailPage /> },
  { path: "pulls", element: <PullRequestsPage /> },
  { path: "pulls/:pullRequestId", element: <PullRequestDetailPage /> },
  { path: "runs", element: <RunsPage /> },
  { path: "runs/:runId", element: <RunDetailPage /> },
  { path: "notifications", element: <NotificationsPage /> },
  { path: "settings/provider", element: <ProviderPage /> },
  { path: "*", element: <Navigate to="/issues" replace /> },
] }]);

createRoot(document.getElementById("root")!).render(<React.StrictMode><FactoryProvider><RouterProvider router={router} /></FactoryProvider></React.StrictMode>);
