import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { Intake } from "@/api/client";

/** 对话（Intake）是纯客户端会话态：服务端没有列表接口，只能按 id 取。
 *  提升到外壳层，避免路由切换时卸载丢失；深链未命中时按 id 拉取补齐。 */
interface IntakesCtx {
  intakes: Intake[];
  upsert: (i: Intake) => void;
}

const Ctx = createContext<IntakesCtx | null>(null);

export function IntakesProvider({ children }: { children: ReactNode }) {
  const [intakes, setIntakes] = useState<Intake[]>([]);

  const upsert = useCallback((i: Intake) => {
    setIntakes((prev) => {
      const idx = prev.findIndex((x) => x.id === i.id);
      if (idx === -1) return [i, ...prev];
      const next = prev.slice();
      next[idx] = i;
      return next;
    });
  }, []);

  const value = useMemo(() => ({ intakes, upsert }), [intakes, upsert]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIntakes(): IntakesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIntakes 必须在 IntakesProvider 内使用");
  return ctx;
}
