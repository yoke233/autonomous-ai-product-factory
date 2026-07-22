# Autonomous AI Product Factory

自主 AI 产品工厂：把用户确认的目标转换成经过构建和测试的代码产物。

系统只负责需求澄清、隔离执行、验证和产物交付。部署、上线、回滚和 CI/CD 全部交给专业系统，本项目不集成也不复刻这些能力。

- 设计总纲：[docs/README.md](docs/README.md)
- 专题文档：[上下文与判断](docs/01-context-and-trust.md) · [运行与恢复](docs/02-runtime.md) · [产物保留](docs/03-artifacts.md) · [外部边界](docs/04-integrations.md)

## 当前状态

第一个垂直闭环已经可运行：

```text
Web Console 中澄清需求
  → 确认 Goal
  → 隔离 worktree 内调用 Claude
  → 执行仓库声明的构建和测试
  → 保存 Candidate 与 Assessment
  → 用户确认接收代码产物
```

当前 Worker 是单进程轮询实现，PGlite 是本地原型存储。Hatchet、可靠重试、防迟到 attempt token、完整 worktree/进程树清理和子进程环境白名单都尚未实现。后续可以用 Hatchet 接管排队、重试、超时和 Worker 调度，但 Hatchet 不成为业务状态库。

## 结构

```text
apps/server   控制面与本地 Worker：Fastify + PGlite
apps/web      Web Console：React + Vite
docs/         当前设计及少量专题说明
```

## 开发

TypeScript / Node >= 22 / pnpm。

```powershell
pnpm install
pnpm dev
pnpm typecheck
pnpm test
```

`FACTORY_RUNNER=stub` 使用桩执行器；真实执行需要本机可用的 `claude` CLI。`FACTORY_PORT` 和 `FACTORY_DATA_DIR` 可覆盖默认配置。
