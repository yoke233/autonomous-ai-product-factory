import { Database, Palette, ShieldCheck, Truck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MOCK = import.meta.env.VITE_MOCK === "1";

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-[13px] font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </div>
      <dl className="divide-y divide-border">{children}</dl>
    </Card>
  );
}

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-[13px] text-muted-foreground">
        {label}
        {hint && <div className="mt-0.5 text-xs text-muted-foreground/70">{hint}</div>}
      </dt>
      <dd className="text-right text-[13px]">{children}</dd>
    </div>
  );
}

export function SettingsView() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
        <h2 className="text-[13px] font-semibold">设置</h2>
        <span className="text-xs text-muted-foreground">当前生效配置</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Section icon={<Database />} title="数据源">
            <Row label="运行模式" hint={MOCK ? "内存态 mock 数据，脱离后端" : "连接真实控制平面"}>
              <Badge tone={MOCK ? "warning" : "success"}>{MOCK ? "MOCK" : "LIVE"}</Badge>
            </Row>
            <Row label="API 端点">
              <span className="font-mono">/api</span>
            </Row>
            <Row label="轮询间隔" hint="工单列表与详情的后台刷新周期">
              <span className="font-mono">2 秒</span>
            </Row>
          </Section>

          <Section icon={<Truck />} title="交付边界（默认）">
            <Row label="交付方式" hint="仅交付产物，不触碰远端">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">ARTIFACT_ONLY</span>
            </Row>
            <Row label="封存策略" hint="候选变更封存为不可变 branch@commit">
              <span className="text-muted-foreground">批准后封存</span>
            </Row>
          </Section>

          <Section icon={<ShieldCheck />} title="验证">
            <Row label="默认构建命令">
              <span className="text-muted-foreground">未配置</span>
            </Row>
            <Row label="默认测试命令">
              <span className="text-muted-foreground">未配置</span>
            </Row>
            <Row label="无命令时判定" hint="缺少可执行验证时的 Assessment 结论">
              <Badge tone="warning">INCONCLUSIVE</Badge>
            </Row>
          </Section>

          <Section icon={<Palette />} title="外观">
            <Row label="主题" hint="跟随操作系统的浅色 / 深色偏好">
              <span className="text-muted-foreground">跟随系统</span>
            </Row>
          </Section>

          <p className="px-1 text-xs text-muted-foreground/70">
            以上为当前生效的只读配置。编辑默认交付边界与验证命令需后端配置接口支持。
          </p>
        </div>
      </div>
    </div>
  );
}
