import { Bell, CheckCheck, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/domain";
import { useFactory } from "@/factory-store";

export function NotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useFactory();
  return <div className="space-y-5"><div className="flex items-end justify-between"><div><h1 className="text-2xl font-semibold">通知</h1><p className="mt-1 text-sm text-muted-foreground">Run、PR 和 Issue 的事件分别通知，不使用一个笼统的“任务完成”。</p></div><Button variant="outline" onClick={markAllNotificationsRead}><CheckCheck />全部已读</Button></div><div className="overflow-hidden rounded-xl border bg-card">{notifications.map((notice) => <Link key={notice.id} to={notice.actionPath} onClick={() => markNotificationRead(notice.id)} className={`flex gap-3 border-b p-4 last:border-0 hover:bg-muted/40 ${notice.read ? "opacity-65" : ""}`}><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${notice.read ? "bg-muted text-muted-foreground" : "bg-info-soft text-info"}`}><Bell className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{notice.title}</p>{!notice.read ? <span className="size-1.5 rounded-full bg-info" /> : null}<Badge tone={notice.delivery === "sent" ? "success" : "warning"}>{notice.delivery === "sent" ? "已投递" : <><RotateCcw />重试中</>}</Badge></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{notice.body}</p><p className="mt-1 text-[10px] text-muted-foreground">{formatTime(notice.createdAt)}</p></div></Link>)}</div></div>;
}
