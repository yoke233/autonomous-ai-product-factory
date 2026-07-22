# builderz-labs/mission-control 与本项目对比研究

> 研究日期：2026-07-21  
> 上游快照：[`builderz-labs/mission-control@914e44f`](https://github.com/builderz-labs/mission-control/tree/914e44fcbce1a4527ce90433a0b884864ffa129d)  
> 方法：将上游默认分支克隆到临时目录，阅读 README、架构/部署/编排文档、API 路由、调度器、数据迁移、权限与测试配置；所有上游结论固定到该 commit。  
> 本地对照：设计 v0.7 与当前实现状态；本报告不把设计目标误写成已实现能力。

## 1. 结论

Mission Control 不是本项目的同类完整替代品。它是一个已经做出大量产品面的**自托管 Agent 运维控制台**：把多种 runtime、任务、会话、成本、安全信号和管理功能集中到一个 Next.js + SQLite 应用中。它明确位于 Agent runtime 之上，不负责 Agent 的推理与工具循环，也不以“从 Goal 到可信 Product/Release”为产品边界（[README L5-L8](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/README.md#L5-L8)、[L67-L85](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/README.md#L67-L85)）。

本项目的目标更窄也更深：从 Intake/Goal Revision 开始，经 Task/Run、Candidate、受保护 Assessment、Product Revision、Effect/Release 到最终 Outcome；核心问题不是“如何看见和调度 Agent”，而是“什么结果在什么证据、版本和授权下可以被系统正式采纳与交付”（[设计总纲](../docs/README.md)，尤其 `§1–§8`）。

因此最合适的判断是：

- **Mission Control 领先于我们当前实现**：控制台完整度、runtime 接入、认证/RBAC、运维可观测性、部署包装、OpenAPI/CLI/MCP 等产品化表面。
- **我们的设计语义强于 Mission Control**：Goal/Task/Run 分层、不可变 revision、lease/fencing、Candidate 与 Product 分离、逐 Acceptance Evidence、受保护 Gate、Effect Ledger、Release SLO、语义 GC。
- **但后一项主要仍是设计优势，不是已经兑现的工程优势**。本仓库 README 已明确：权威 Task Graph、lease/fencing、受保护验证、Effect Ledger、就绪条件调度和并发执行尚未实现（[本地 README](../README.md)）。
- Mission Control 最值得借鉴的是**产品壳、接入体验和运营视图**；最不应照搬的是它把 Task 状态、执行结果、质量审批和完成压在同一条可变状态链上的语义。

## 2. Mission Control 实际是什么

### 2.1 产品与技术形态

它是 Next.js 全栈单体，主要状态保存在 `better-sqlite3`/WAL 中，通过 Web UI、CLI、MCP、REST/OpenAPI、WebSocket 和 SSE 暴露能力；官方仍明确标记为 alpha（[README L18-L20](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/README.md#L18-L20)、[L216-L233](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/README.md#L216-L233)）。

它覆盖的产品面很宽：Tasks、Agents、Operations、Knowledge、Governance，以及 OpenClaw、Claude Code、Codex、CrewAI、LangGraph、AutoGen、Claude SDK 等 runtime 的不同深度适配；官方也提醒 adapter 不具备功能对等性（[README L72-L85](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/README.md#L72-L85)、[L97-L112](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/README.md#L97-L112)）。实际 adapter 接口主要是 `register / heartbeat / reportTask / getAssignments / disconnect`，属于统一接入 seam，不等于每种 framework 的深层原生编排（[`FrameworkAdapter`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/lib/adapters/adapter.ts#L29-L66)）。

### 2.2 任务与调度闭环

最短工作流是：注册 Agent → 创建/指派任务 → Agent 轮询队列原子领取 → 回报执行 → heartbeat 后继续。它可以不依赖 gateway；OpenClaw gateway 主要增加自动派发和实时 session 能力（[Quickstart L1-L9](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/docs/quickstart.md#L1-L9)、[L89-L159](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/docs/quickstart.md#L89-L159)）。

队列领取用单条 `UPDATE ... RETURNING` 消除 SELECT/UPDATE 竞争，这是一个简单有效的单实例原子 claim 实现（[`tasks/queue` L84-L129](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/app/api/tasks/queue/route.ts#L84-L129)）。但它不是带 lease/fencing 的 Run claim：任务本身直接变成 `in_progress`，离线或陈旧任务再由定时器重排。

调度器是应用进程内 `Map + setInterval`：heartbeat 每 5 分钟检查，dispatch、Aegis review、周期任务和 stale requeue 每 60 秒运行（[`scheduler.ts L300-L344`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/lib/scheduler.ts#L300-L344)、[L391-L429](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/lib/scheduler.ts#L391-L429)）。部署文档要求同一 `.data` 目录只运行一个实例（[`deployment.md L533-L535`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/docs/deployment.md#L533-L535)）。

一个可验证的实现缺口是：API 接受 `max_capacity > 1`，但只要 Agent 已有一个 `in_progress` 任务就提前返回 `continue_current`，后面的容量计数不会允许它再领取第二项（[`queue route L84-L114`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/app/api/tasks/queue/route.ts#L84-L114)；对照[文档 L93-L101](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/docs/orchestration.md#L93-L101)）。这说明其队列适合借鉴交互与 API 形状，不应直接作为我们的并发语义实现。

### 2.3 Aegis 的真实信任强度

Mission Control 的公开文案称：任务进入 `done` 前必须存在 Aegis approval record（[README L168-L174](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/README.md#L168-L174)）。代码确实在普通任务更新入口检查最新 `reviewer='aegis'` 的记录是否为 `approved`（[`tasks/[id] L30-L41`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/app/api/tasks/%5Bid%5D/route.ts#L30-L41)、[L190-L198](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/app/api/tasks/%5Bid%5D/route.ts#L190-L198)）。

但这**不是硬人审门，也不是受保护的独立验证边界**：

- scheduler 会自动调用一个 reviewer Agent、解析文本 verdict、写入 `quality_reviews`，批准时直接把任务改成 `done`（[`task-dispatch.ts L1270-L1313`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/lib/task-dispatch.ts#L1270-L1313)）。
- 任意 `operator` 都能调用 quality-review API；`reviewer` 是客户端字符串，默认值只是 `aegis`，提交 `approved` 后 API 直接把任务推进到 `done`（[`quality-review route L70-L121`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/app/api/quality-review/route.ts#L70-L121)、[`qualityReviewSchema`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/lib/validation.ts#L271-L276)）。
- approval 绑定的是 `task_id + reviewer label + status`，没有绑定 Goal Revision、Baseline、Candidate digest、Gate Policy、逐条 Acceptance Coverage 或不可伪造的 reviewer 身份。
- 官方 2.2.0 说明也承认声明式 approval-policy engine 仍在路线图，workspace isolation 本身不授予执行权（[`releases/2.2.0.md L21-L29`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/docs/releases/2.2.0.md#L21-L29)）。

所以 Aegis 更准确的定义是：**RBAC 下可自动或人工写入的流程门和审计记录**。它能减少无记录的直接完成，但不能证明结果正确，也不能抵抗 operator 或同一信任域内的伪造。

### 2.4 产品化成熟度

虽然仍是 alpha，Mission Control 已有明显的产品工程积累：

- `2.2.0` 版本；`quality:gate` 串联 lint、typecheck、Vitest、build 和 Playwright，另提供独立的 API contract parity 脚本（[`package.json L1-L31`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/package.json#L1-L31)）。
- Docker 默认采用只读根文件系统、`tmpfs`、drop capabilities、`no-new-privileges` 和资源限制（[`docker-compose.yml L42-L57`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/docker-compose.yml#L42-L57)）。
- UI 已形成 Core / Observe / Automate / Admin 信息架构，并提供 Essential 模式（[`nav-rail.tsx L14-L84`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/components/layout/nav-rail.tsx#L14-L84)）。
- 首次使用的黄金路径很清楚：安装 runtime → 创建 Agent → 创建 Task（[`empty-state-launchpad.tsx L76-L86`](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/components/dashboard/empty-state-launchpad.tsx#L76-L86)、[L97-L207](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/src/components/dashboard/empty-state-launchpad.tsx#L97-L207)）。

同时，代码与文档已有漂移信号，例如 Quickstart 仍示范直接把 task 更新为 `done`，与当前 Aegis 检查冲突（[Quickstart L123-L135](https://github.com/builderz-labs/mission-control/blob/914e44fcbce1a4527ce90433a0b884864ffa129d/docs/quickstart.md#L123-L135)）。这与仓库自称 alpha 一致：功能面宽、迭代快，但契约尚未完全收紧。

## 3. 与本项目的核心差异

| 维度 | Mission Control | 本项目 v0.7 | 判断 |
|---|---|---|---|
| 产品边界 | 操作和治理多个 Agent/runtime | `人 → AI → 产品`，直到正式 Product/Release/Outcome | 不是同一终点；MC 更像 Operator Plane + Runtime 管理面 |
| 输入模型 | 人工/API 创建可变 Task | Intake → 不可变 Goal Revision + Acceptance Contract + Boundary | 我们更强调“先确定交付契约” |
| 执行模型 | Task 状态直接 `assigned → in_progress → review → done` | Task 是不可变契约；Run 是独立 attempt；Candidate/Assessment/Release 各有状态机 | MC 把多个生命周期压在 Task 上 |
| claim/recovery | SQLite 原子 claim + heartbeat + stale requeue；单实例 scheduler | Postgres `SKIP LOCKED` + CAS + lease + fencing；被写目标拒绝 stale token | 我们设计更强，但 M1a 尚未实现 |
| Agent/runtime | 多 runtime、CLI、gateway、adapter 已落地 | 当前真实切片主要是 Claude CLI；未来 Worker/RunnerPort | MC 是可直接学习的工程样本 |
| 正确性判定 | Aegis/quality review record 推进 task done | Task Oracle、Candidate Assessment、Acceptance Coverage、Gate Policy、Release SLO 四层分离 | 这是两者最大的语义差异 |
| 受保护验证 | 没有 Producer 不可读 Gate 与 Gate 自体质量验证 | INV-07/INV-13 + GatePolicyV1 | 我们的核心差异化，但要等 M1d 兑现 |
| 外部副作用 | 各集成/调度路径直接执行并记录结果 | 统一 Effect intent、幂等键、UNKNOWN 先回读、补偿 | MC 不能替代 Effect Ledger 设计 |
| 版本与失效 | 任务/运行有记录，但完成门不绑定完整 Goal/Baseline/Candidate/Policy 链 | Revision、Baseline compatibility、stale applicability 是核心不变量 | 我们更适合长期自治与迟到结果防护 |
| Context/记忆 | Memory、Skills、Chat、session 观察是产品面 | 每 Run 编译 Context View/Manifest；Agent memory 不是事实；语义 GC | 两者目标不同，不应合并成同一种“Memory” |
| 部署 | 本地/单实例/SQLite，Docker 与 standalone 已完成 | 控制面可上云，Worker 跟随代码、仅出站 claim；v1 Linux/WSL2 + 容器 | MC 当前更易部署；我们的拓扑更适合远程可信执行 |
| UI | 大型运维控制台，功能面非常广 | 当前 Console 聚焦 Intake、Goal、批准 | 借鉴信息架构，但不应把宽度当 M1 目标 |

本地依据主要见：

- Goal/Boundary、四组件、领域记录、13 条不变量与 M1a–M1d：[docs/README.md](../docs/README.md)（特别是 `§1、§2、§4、§6、§8`）。
- Context Manifest、Evidence/Claim/Assessment、GatePolicyV1：[docs/01-context-and-trust.md](../docs/01-context-and-trust.md)（`§3–§6`）。
- claim/lease/fencing、FactoryKernel、Effect Ledger、部署拓扑：[docs/02-runtime.md](../docs/02-runtime.md)（`§3、§6、§7、§9`）。
- Agent 无永久保存权与语义 GC：[docs/03-artifacts.md](../docs/03-artifacts.md)。
- Intake、外部 Runtime `done` 只代表执行结束、外部写必须走 Effect：[docs/04-integrations.md](../docs/04-integrations.md)（`§7–§9`）。

## 4. 值得吸收的部分

### 4.1 现在就可以吸收：产品与运维设计

1. **把黄金路径做成显式状态。** 我们可以把 MC 的“runtime → Agent → Task”改写为“注册 Project/Worker → 完成 Intake → 创建首个 Goal → 取得首个 Product Revision”，让用户知道下一步而不是面对空看板。
2. **Essential / Full 渐进披露。** M1 默认只展示 Goal、Runs、Candidates、Assessments 和系统健康；Effect、Release、成本、安全审计在相应阶段出现。这样可以复用其信息架构思想，又不引入无需求的功能面。
3. **统一的 runtime adapter seam。** 借鉴接口形状和能力发现，但 adapter 必须返回我们自己的 typed Run result/Candidate/receipt，并由 Factory Core 校验 fence、Baseline 和 Context digest；不能让 adapter 自报 `done` 直接晋升。
4. **运维视图的优先级。** Activity、运行时健康、失败聚类、token/cost、审批积压值得在 M1/M2 逐步加入；它们是 Operator Plane 的读模型，不是新的权威状态。
5. **部署硬化默认值。** 只读 rootfs、drop capabilities、资源限制、非 root 运行、明确的网络边界，可直接作为我们 Worker 容器验收清单的输入。

### 4.2 只吸收形状，不吸收语义

1. **轮询队列 API**适合低门槛 Worker 接入，但后端必须是 `Run claim + lease + fencing`，不是把 Task 直接改成 `in_progress`。
2. **Aegis reviewer**可以作为独立 LLM reviewer，产出 finding Claim/Evidence；不能成为 Assessment authority，更不能靠一个 `reviewer='aegis'` 字段满足 GatePolicyV1。
3. **completion receipt**可以作为 UI/审计投影，但真正交付仍必须引用 Product Revision、适用 PASS Assessment，以及按 Delivery Mode 要求的 Effect/Release。
4. **workspace / tenant**只有出现真实隔离需求时再落地；当前 Project + Worker routing 足以支撑 M1，不应因 MC 已有多租户表就提前扩张领域模型。

## 5. 不应照搬的部分

- 不把 Task 当成 Goal、执行 attempt、Candidate、Review 和 Delivery 的共同容器。
- 不使用任意 API 路由直接更新权威状态；继续坚持 FactoryKernel 深接口，不暴露通用 `setStatus`/CRUD。
- 不用进程内 `setInterval` 与内存 `running` 标志承担必须崩溃恢复的工作。
- 不用“自动重排 stale task”替代 lease 到期和 stale fencing token 的目标侧拒绝。
- 不把 reviewer 名称、trust score、签名回执或 dashboard 标签描述成超出其实际信任边界的保证。
- 不一次建设 Mission Control 当前所有 Core/Observe/Automate/Admin 页面。其广度是成熟产品积累，不是我们的 M1 验收条件。
- 不复制表面统一、实则深度不一致的多 runtime 宣称；M1b 应先把一种真实 Runner 的取消、超时、进程树清理、Candidate 封存和可复现构建做硬。

## 6. 对 M1 路线的具体影响

| 阶段 | 从 Mission Control 学什么 | 仍必须按本设计实现什么 |
|---|---|---|
| M1a Kernel | 原子 claim API 的简洁性、事件/活动读模型 | Postgres 并发双 claim、lease、fencing、CAS、唯一 active Run；不能采用 SQLite Task 状态替代 |
| M1b Real Runner | runtime discovery、CLI 接入、健康状态、安装/部署 UX | Linux/WSL2 + 容器、取消/超时进程树清理、隔离 worktree、Candidate seal/reproducibility |
| M1c Fleet | Task board、fleet/queue/activity/cost 运营视图 | 就绪条件、粗粒度写作用域、单写者集成、集成态 Assessment；不能依赖 `max_capacity` 式软约定 |
| M1d Verification | reviewer 反馈回路和最多若干次修复的 UX | Producer/Gate 隔离、Gate 材料质量 Assessment、逐 Acceptance Coverage、失败样本不得误交付 |
| M2 以后 | Essential/Full、Approvals、webhook/cron/OpenAPI/MCP 产品面 | Effect Ledger、Release SLO、监督式 Staging 与指标解锁 |

优先级建议：**不要 Fork 或嵌入 Mission Control**。把它作为三个独立参考样本使用：

1. Console 信息架构与 onboarding；
2. Agent/runtime 接入与运维读模型；
3. Docker/发布工程检查表。

内核状态机、可信验证和 Effect/Release 继续自建。两者的状态语义差异太大，深度复用会迫使我们增加兼容层，正好重演前身项目“旧轨 + 新轨长期并存”的失败模式。

## 7. 对现有研究笔记的纠正

[`research/2026-07-21-similar-systems.md`](2026-07-21-similar-systems.md) 本轮研究前把 Mission Control 描述为“硬人审门”“人批 + 留证据”。固定 commit 的代码不支持这个表述：Aegis 可以由 scheduler 自动执行，且任意 operator 可以用客户端提供的 `reviewer='aegis'` 写入 approval 并推进 `done`。该综述中的 TL;DR、矩阵、项目条目和最终论证已同步修正。

统一后的表述是：

> Aegis 是 RBAC 下的任务完成流程门：`done` 前要求一条 reviewer 标记为 `aegis` 的 approved record；该记录可由自动 reviewer 或 operator API 写入。它提供流程约束与审计，不构成人工强制审批、独立身份 attestation、受保护 Gate 或 Candidate 正确性证明。

这不会推翻旧报告“Mission Control 与确定性控制面方向一致”的大结论，但会降低它对本项目监督式交付与受保护验证的相似度评级。

## 8. 最终裁决

Mission Control 证明了用户确实需要一个把任务、Agent、session、成本、失败和审批集中起来的控制面，也证明简单的 SQLite + 原子 claim + 轮询足以很快做出单实例产品。它对我们的最大价值是告诉我们**控制面应该怎样被用户操作**。

它没有证明 Agent 结果为何可信、旧结果为何不能迟到覆盖、外部副作用为何不会重复、Candidate 何时能成为 Product、Release 何时算健康。那些仍是本项目必须自行兑现的核心。短期应借它的壳和运营经验，加速 M1 的可用性；不能为了快速获得功能宽度而削平 FactoryKernel、fencing、GatePolicyV1 与 Effect Ledger。
