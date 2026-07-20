# Autonomous AI Product Factory

自主 AI 产品工厂：`人 → AI → 产品`。确定性控制面拥有状态、权限、判断和发布权；Agent 只执行非权威 Task 并提交类型化结果。

- 设计总纲：[docs/README.md](docs/README.md)（v0.6，含专题导航与 MVP 阶段）
- 研究依据：[docs/REFERENCES.md](docs/REFERENCES.md)（2026-07-20 深度研究裁决与来源）

## 状态

设计冻结于 v0.6。第一个垂直切片已可用：Web Console 提交 Goal → 隔离 worktree 内 claude 执行 → Candidate 封存 → Repo Profile 验证 → Assessment → 一次批准交付（`ARTIFACT_ONLY`）。

## 结构

```text
apps/server   控制面：PGlite(进程内 Postgres) + Fastify + Worker（Goal/Run 状态机、Runner、验证）
apps/web      Web Console：React + Vite（Goal 列表/新建/详情/批准）
docs/         设计文档（总纲 + 4 专题 + 冷参考）
```

## 开发

TypeScript / Node ≥22 / pnpm。

```bash
pnpm install
pnpm dev         # 同时起 server(:3400) 与 web console(:3401)
pnpm typecheck
pnpm test
```

环境变量：`FACTORY_RUNNER=stub` 用桩 Producer（不调模型）；`FACTORY_PORT`、`FACTORY_DATA_DIR` 可覆盖默认。执行真实 Goal 需要本机可用的 `claude` CLI。
