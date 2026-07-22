# 同类开源实践对比调研：自主 AI 产品工厂形态校准

> 调研日期：2026-07-21 · 方法：仅一手来源（GitHub 仓库 README/docs/源码、项目官方文档、厂商工程博客）· 星标与活跃度为当日 `gh api` 实读
> 对比轴取自本仓库 `docs/README.md`、`docs/02-runtime.md` §2/§3/§5、`docs/04-integrations.md` §12
> 标注约定：**[事实]** 有一手来源；**[推断]** 基于本次调研范围的判断，可能被范围外系统推翻

---

## 1. TL;DR 校准结论

1. **主流分裂成两大阵营。** 一是**确定性引擎持久编排**（Hatchet / Temporal / DBOS / Inngest）：权威状态落在 Postgres 或事件溯源历史，由确定性引擎推进，LLM 只是被包成可重试的一步。二是**LLM 路由的 Agent 框架**（Claude Agent SDK、AutoGen SelectorGroupChat、crewAI 分级、MetaGPT、LangGraph supervisor）：由 LLM 决定下一步跑什么。
2. **编码 Agent 编排这条细分赛道，几乎全是"worktree + 人审"的手动看板**（vibe-kanban / crystal / claude-squad）：git worktree 隔离是标配，合并回主干**一律交给人**，没有一个自动合并。
3. **本仓库坐在两个阵营的交叉点上**：把确定性引擎的底座（Postgres CAS/fencing/outbox，`02 §3` 实现注记明确对标 Hatchet/Temporal/DBOS/Absurd）用到编码 Agent 编排上——而后者的成熟实现里没有一个用确定性权威状态核。这个融合本身是**少有人走的路**。
4. **被多方印证的选择**（可放心）：权威状态入库 + 确定性控制器持迁移权（`README §2`、`02 §3`）；git worktree 隔离；单写者/merge queue 串行合并（`02 §2/§8`）；会话复用作为可弃缓存（`02 §5`）；外部写走幂等 Effect（`INV-04`，对应 Temporal/Hatchet at-least-once 需幂等）；交付前一次人工批准（`README §1` M2）。新样本 `builderz-labs/mission-control` 进一步印证了确定性 Agent 运维控制面与流程审计的产品需求，但其 Aegis 是自动或人工可写的任务流程门，不是本设计监督式交付环的独立复现。
5. **无人走过的路**（点名章节，需自证）：依赖表达为**对权威记录重求值的就绪条件**而非 DAG 边（`02 §2`、`04 §12`，"外部终态永远只是投影，不反向驱动内部状态"）——主流全是 DAG 边或 LLM 推理；**集成态行为验证**防"某已交付行为被并入他人后静默删除"（`02 §8`、故障演练表）——无一系统做；**受保护 Gate 与 Producer 隔离 + Gate 自体质量校验**（`INV-07/INV-13`、M1d）——编码 Agent 圈无人做反作弊门；**四层判定语义分离**（`README §5`）与**拒绝"Git 无冲突+测试通过=PASS"**（`02 §8`）；**不用 LLM 投票制造真相**（`README §6`）——直接否掉 crewAI/AutoGen/MetaGPT 的多 Agent 共识路线。
6. **诚实的风险**：M3 无人 Staging 是真正无人验证过的领域——公开编码 Agent 系统普遍止于沙箱自主 + 人工审/批；mission-control 虽可自动 Aegis review 并推进任务完成，但不形成可信 Product/Release 或无人部署证据。本仓库 `README §1` 自己也承认没有公开无人部署先例，其"用零容忍指标解锁"的对冲姿态是对的；就绪条件替代 DAG 边在 M1 阶段（闭合谓词集）实际收敛到与 DAG 等价，额外复杂度要到 M2 动态扩图才回本；集成态行为验证价值高但实现昂贵、尚无先例可抄。

---

## 2. 对比矩阵（系统 × 8 轴）

轴：①权威状态 / 迁移权 ②依赖表达 ③调度触发 ④隔离 + 冲突合并 ⑤会话复用 ⑥编排者 ⑦完成判定 / 门禁 ⑧成熟度（星标 @2026-07-21 / 活跃度）

| 系统 | ①状态/迁移权 | ②依赖 | ③触发 | ④隔离/合并 | ⑤会话 | ⑥编排者 | ⑦完成门禁 | ⑧成熟度 |
|---|---|---|---|---|---|---|---|---|
| **本仓库（设计）** | Postgres 权威 / **确定性控制器**（CAS+fence） | **就绪条件**重求值（非边） | Worker 出站 claim + 迁移即事件 | worktree+容器 / **单写者串行+集成态行为验证** | 一等但**非权威**，可从状态重建 | **确定性控制器** + 可选 LLM 主管（只提议） | **四层判定** + 受保护独立验证 + 一次人批 | 设计 v0.7，M0/M1 未落地 |
| OpenHands（深读） | 追加式 EventLog / **确定性 Conversation 控制器**（Agent 无状态） | 自由推理（对话树 HEAD） | 控制器 run 循环 + 回调/webhook | 容器/会话 / 单写者 FIFOLock；子代理返回结果 | 可恢复（FileStore 持久化+fork） | 确定性控制器 + LLM 委派 | 自报 FinishAction → 规则 critic（非空 patch）→ 可选 LLM judge | 81.5k / 日更 |
| AutoGen（深读） | 运行时托管的 Agent 对象内 / Agent 处理消息 | 自由 or **GraphFlow DAG** | **消息 pub/sub 订阅** | 无 Agent 隔离；代码执行走扩展沙箱 | 显式 save/load state | RoundRobin(定) or Selector(LLM) | 终止条件（文本/轮数/外部/人） | 59.9k / **维护模式**（继任 MAF） |
| LangGraph（深读） | checkpointer(SQLite/PG/内存) / **框架 reducer**（非 LLM） | **图边**（super-step 顺序） | 图遍历 + interrupt 等 resume | 无 worktree；同一 super-step 并行，reducer 解冲突 | 强：checkpointer + thread_id | **LLM supervisor**（工具 handoff 路由） | interrupt() 人审为一等；测试门须自建 | 37.8k / 日更 |
| task-master（深读） | **JSON 文件 tasks.json** / 确定性命令写（`set-status`） | **依赖数组**(task ID) 成 DAG | 手动 `next` 算最近可执行 | **无执行、无隔离**；tagged list 分上下文 | 无会话概念；外部 Agent 每次新起 | **无自主编排**（人+外部编辑器驱动） | 自报 `set-status done`；无独立验证 | 27.9k / 活跃 |
| vibe-kanban（深读） | 本地 DB(app-data, sqlx) / 确定性 Rust 后端 | 看板列 + 父子子任务（**无 DAG/阻塞**） | **手动**（建 workspace 即跑） | **worktree/仓** / 人触发 PR 或本地 merge，无队列 | 会话续自身线程；**新会话上下文清零** | 人在环看板 + 确定后端 | **人**审 diff 反馈循环"直到满意" | 27.5k / **母公司 bloop 关停**(Apr 2026) |
| crystal（深读） | SQLite(~/.crystal, 单一真相) / Electron 主进程 | 无（独立会话） | 手动（从 prompt 建会话） | **worktree/会话** / 手动"Rebase to main"，无 PR | 可恢复（conversation_messages） | 人在环桌面应用 | **人**审 diff viewer 后点合并 | 3.1k / **已弃**(继任 Nimbalyst) |
| claude-squad（速览） | ~/.claude-squad/config.json + tmux/worktree / Go TUI | 无（独立实例） | 手动（TUI 键起实例） | **tmux+worktree** / 人 commit+push，GitHub 上合 | tmux 持久，暂停/恢复 | 人驱动 TUI（`--autoyes` 只自动应答不合并） | **人**审后 push | 8.2k / 活跃(v1.0.19) |
| Hatchet（深读） | **Postgres + 持久事件日志** / 确定性引擎 | **DAG 父子边** + 事件触发 + 持久 wait | **事件订阅** / SDK push / cron | Worker，wait 即驱逐让槽；replay 安全；近 exactly-once（需幂等缓存） | checkpoint/replay | **确定性引擎**（无 LLM 路由） | 每步持久化，缓存正确即近 exactly-once | 7.5k / 日更 |
| Inngest AgentKit（深读） | Network State(消息+KV)，跑在 Inngest 持久函数 / 引擎推进但路由可 LLM | 无静态 DAG；路由逻辑对 state | Network while 循环，模型调用为持久步 | Inngest 提供重试/并行工具/并发多租 | step.ai 结果缓存 + step 记忆 | **可配**：代码路由/LLM 路由 agent/混合（缺省 LLM） | 路由返回 undefined 或 maxIter 止；at-least-once | 915 / 较陈(Apr 2026) |
| Temporal（深读） | **事件溯源工作流历史**（外部集群）/ 确定性引擎 | 命令式持久代码（非声明 DAG） | signal/schedule/手动 | **at-least-once Activity → 副作用须幂等** | 历史 replay | 确定性引擎（LLM 是被重试的一步） | 持久代码返回即完成 | 21.8k / 日更；**OpenAI Codex 核心控制流跑在其上**(一手) |
| DBOS（深读） | **checkpoint 进你自己的 Postgres**（进程内库）/ 确定性引擎 | step 函数式 | 函数调用 | at-least-once step → 须幂等 | 从最后完成步恢复 | 确定性引擎 | 持久代码返回即完成 | 1.5k / 日更；Pydantic-AI/OpenAI Agents 集成 |
| Claude Agent SDK（深读） | **磁盘 .jsonl 对话** / **LLM**（agent 循环）推进 | 无 DAG；LLM 按 description 涌现分派 | LLM 循环内 Agent 工具 + 手动 resume | 每子代理**上下文清零**；并发后台子代理；无幂等机制 | **resume/continue/fork**；子代理转录可独立恢复 | **LLM 路由**（父 Claude） | agent 循环结束/结果消息；无交付保证 | Py 7.7k / TS 1.6k / 日更（Anthropic 官方） |
| Backlog.md（速览） | **markdown 文件**(git 内) / 无 LLM 控制器 | 里程碑 + 依赖（执行顺序可审） | CLI/MCP，人指派（非轮询） | 一 task=一上下文=一 PR（无并发合并机制） | 无 | 无 LLM 编排 | 验收标准 + DoD 清单（人/agent 勾） | 6.2k / 活跃 |
| MetaGPT（速览） | 发布订阅消息池(Environment) / LLM 角色 | 角色 SOP 流水线 | **消息订阅**(`_watch` on `cause_by`) | 无隔离 | 共享对话态 | **LLM 角色团队**(PM/架构/工程) | **LLM 角色自审**（QA 也是 LLM，无独立门） | 69.5k / **停滞**(last push 2026-01-21) |
| crewAI（速览） | 进程内 / LLM | 顺序(静态) or 分级(经理运行时分派) | 顺序执行 or 经理决定 | 无隔离 | — | **LLM 经理**(`manager_llm`) | **LLM 经理自评完成**（无自动测试/人门） | 55.9k / 极活跃 |
| plandex（速览） | 服务端 DB(未一手证) / 混合 | 计划步骤 | 可全自主或分步 | **累积 diff 沙箱**（非 worktree/容器） | 计划版本控制 + 分支 | 可配自主度 | **人**审 diff 为门 | 15.5k / **陈旧**(2025-10) |
| gpt-pilot（速览） | 项目状态持久 / 混合 | 角色流水线拆 dev task | 分步 | 无强隔离 | 可列项目/从步恢复 | **LLM 角色**(Spec→架构→Tech Lead→Dev→审) | **人**审为门（"95% AI + 5% 人"） | 33.7k / 中活跃 |
| **mission-control**（新2026） | **SQLite 控制面 DB(WAL)** / **确定性任务状态链** | inbox→分派→执行→审→Aegis 流程门→done | REST/CLI/MCP + **cron** + agent **轮询**领取 | 多 runtime 控制面（不管代码隔离） | — | 确定性控制面 | `done` 前须有 `aegis` approved record；可由自动 reviewer 或 operator 写入，不证明正确性 | 5.8k / 日更（运维控制面参考） |
| **agent-orchestrator**（新2026） | 本地守护进程监控态 / **确定性 orchestrator**（"agent 只写码，AO 提供 harness"） | orchestrator 规划任务 | 守护进程观测 session/PR/CI/review | **每会话 git worktree** / **冲突回路到属主会话**（非队列） | 会话态 | **确定性代码**（非 LLM） | 多因子(CI/PR/review 真值)+看板监督 | 8.4k / 日更 |
| **omnigent**（新2026） | 元 harness / 混合 | LLM 分级 | — | **最强隔离**：云沙箱(Modal/Daytona/E2B/K8s)+OS 沙箱(bubblewrap/seatbelt)+L7 出口代理+3 级策略引擎 | 会话跨设备持久同步 | **LLM 分级编排**（并行 worktree 子代理→路由给 reviewer） | 交给 harness（无系统级门） | 7.6k / 日更（6 月上线，年轻） |
| **herdr**（新2026） | 会话态（socket）/ — | socket API 让 agent 互相 wait（原语非调度） | — | **无 worktree/合并/任务库**（刻意不做编排） | **会话持久是核心**：detach 后继续跑、ssh 重连、重启存活 | 非编排器 | 无 | 19.0k / 日更（最高热度，但只是会话层） |

---

## 3. 每系统档案

### 深读

**OpenHands（`OpenHands/OpenHands`，V1 核心已抽到 `OpenHands/software-agent-sdk`）** — 单一系统里与本设计最接近的分析。
- Agent 无状态，由**确定性 `Conversation` 控制器**拥有循环与状态：Agent 只 emit 事件，控制器 `append_event` 写入；权威状态 `ConversationState`（含 `execution_status`、`leaf_event_id` HEAD、`agent_state`、EventLog）持久化到 FileStore，`create()` 可重建恢复。[state.py](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/conversation/state.py) · [events 架构](https://docs.openhands.dev/sdk/arch/events)
- **单写者**由 state 上 `FIFOLock` 强制（每 step 加锁）。[local_conversation.py](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/conversation/impl/local_conversation.py)
- 运行时是 Docker 容器 client-server（REST 传 Action/Observation）。[runtime 文档](https://docs.openhands.dev/openhands/usage/architecture/runtime)
- **三层完成判定**：自报 `FinishAction` → 规则 `AgentFinishedCritic`（FinishAction + 非空 git patch）→ 可选 **LLM goal judge**（`GoalVerdict`）。[critic](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/critic/impl/agent_finished.py) · [judge](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/conversation/goal/judge.py)
- 子代理可用 Claude-Code 式 markdown + YAML frontmatter 定义。[subagent schema](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/subagent/schema.py)
- **差异**：其"权威状态"是单对话级别，非跨 Goal 的工厂；完成门是规则+可选 LLM judge，**没有**受保护/防篡改 Gate，也没有 Effect Ledger 与四层判定。81.5k★，日更。[repo](https://github.com/OpenHands/OpenHands)

**microsoft/autogen（autogen-core）** — 事件驱动 actor/pub-sub 框架的代表。
- 运行时托管 Agent 生命周期（首次投递消息时才实例化），路由靠 **topic + subscription** pub/sub 而非任务图。[agent-runtime](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/agent-and-agent-runtime.html) · [topic/subscription](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/core-concepts/topic-and-subscription.html)
- 编排预设：确定性 `RoundRobinGroupChat` / **LLM 驱动** `SelectorGroupChat`；另有显式 DAG `GraphFlow`(`DiGraphBuilder`，支持条件边)。[teams](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html) · [graph-flow](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/graph-flow.html)
- 状态靠显式 `save_state`/`load_state` 序列化；无 Agent 级 git/容器隔离。[state](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/state.html)
- **差异 + 信号**：完成靠终止条件（文本/轮数/外部），无独立验证；**README 已声明进入维护模式**，继任 Microsoft Agent Framework。59.9k★，last push 2026-04-15。[repo/README](https://github.com/microsoft/autogen)

**langchain-ai/langgraph** — 持久化 + HITL 的参考实现。
- 状态由 **checkpointer**（InMemory/SqliteSaver/PostgresSaver）按 **thread_id** 持久化；**框架 reducer 确定性合并**通道更新，非 LLM 写状态。[persistence](https://docs.langchain.com/oss/python/langgraph/persistence) · [graph-api](https://docs.langchain.com/oss/python/langgraph/graph-api)
- `interrupt()` 保存状态并等 `Command(resume=...)`，**resume 会重跑整个节点**（前置副作用须幂等）；HITL 审批/编辑/工具批准为一等。[interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- 依赖是**图边**（super-step 顺序），并行在同 super-step 内 fan-out，冲突靠 reducer（无则报错）；无 worktree/容器隔离。[graph-api](https://docs.langchain.com/oss/python/langgraph/graph-api)
- 预建 supervisor 是 **LLM 路由**（工具 handoff）。[langgraph-supervisor-py](https://github.com/langchain-ai/langgraph-supervisor-py)
- **差异**：本设计的"控制器"是领域交付控制器（Gate/Effect/Release），LangGraph 的"框架"只管图执行与状态持久，不做交付门。37.8k★，langgraph==1.2.9(2026-07-10)。[repo](https://github.com/langchain-ai/langgraph)

**eyaltoledano/claude-task-master** — PRD→任务 DAG 的追踪器。**关键事实：它不执行任务**，只为外部编码 Agent（Cursor/Claude/Windsurf，经 MCP）追踪；"系统不自主执行任务"。[README](https://github.com/eyaltoledano/claude-task-master/blob/main/README.md)
- 状态是 repo 内 **`tasks.json`**（tag 分区），字段含 `dependencies`(task ID 数组)、6 态 `pending/in-progress/done/review/deferred/cancelled`。[task-structure](https://github.com/eyaltoledano/claude-task-master/blob/main/docs/task-structure.md)
- `parse-prd` 用 LLM 生成初始任务；调度是手动 `next`（按依赖序算最近未阻塞）；状态靠显式 `set-status`。[command-reference](https://github.com/eyaltoledano/claude-task-master/blob/main/docs/command-reference.md)
- **差异**：与本设计的"就绪条件"对照——task-master 是**依赖数组 + 状态字段推断就绪**，完成靠**自报 `set-status done`，无独立验证**。27.9k★。

**hatchet-dev/hatchet** — Postgres 持久编排引擎，本设计 `02 §3` 的直接对标之一。
- "Hatchet uses Postgres for all persistence"，持久执行是"durable event log"每步 checkpoint，可从最后 checkpoint replay 不重跑已成步。[durable-execution](https://docs.hatchet.run/home/durable-execution)
- **DAG 父子边**（父成功子才跑，`ctx.task_output(parent)` 取上游输出），拓扑开工前声明；事件触发 `on-event`。[DAG](https://docs.hatchet.run/v1/directed-acyclic-graphs) · [event-trigger](https://docs.hatchet.run/home/features/triggering-runs/event-trigger)
- "近 exactly-once"**但须应用逻辑缓存正确、重试安全**——即副作用要幂等。[durable-execution](https://docs.hatchet.run/home/durable-execution)
- **差异**：印证了本设计的 Postgres 权威 + 确定性引擎 + at-least-once 需幂等（`INV-04` Effect Ledger）；但 Hatchet 依赖是**声明 DAG 边**，非就绪条件；无领域交付门（那由你自建）。7.5k★，日更。

**inngest/agent-kit** — "确定性路由 over 持久步"这一混合姿态，是现成方案里最接近监督式交付环的。
- Network = "带记忆(State)的 while 循环"，State = 消息 + KV 共享给 Agent 与 Router；`maxIter` 封顶。[networks](https://agentkit.inngest.com/concepts/networks)
- **路由三态**：代码路由(确定)、LLM routing agent(自主)、混合；缺省用 LLM Default Router。**官方推荐 state-based 确定性路由**（可靠可测）。[routers](https://agentkit.inngest.com/concepts/routers) · [routing 高级模式](https://agentkit.inngest.com/advanced-patterns/routing)
- 跑在 Inngest 持久函数上（`inngest` 为必需 peer dep），模型调用经 `step.ai` 自动重试+缓存。[quick-start](https://agentkit.inngest.com/getting-started/quick-start)
- **差异**：可换掉 LLM 路由改用确定性代码路由 over 共享 State，是本设计"确定性控制器 + Agent 只提议"的最近似成品，但 AgentKit 无 git 隔离、无 Effect Ledger、无受保护门。915★，last push 2026-04-29。

**Temporal + DBOS** — 持久执行底座；本设计 `02 §3` 点名"OpenAI Codex 生产运行于 Temporal"。
- **一手证据成立**：Temporal 官博引 OpenAI Codex 工程师 Will Wang——"Temporal is a critical part of the infrastructure powering Codex, responsible for executing our core control flows"。[temporal.io/blog Codex](https://temporal.io/blog/improving-java-sdk-codex-openai)
- **at-least-once Activity**："An Activity Execution can occur more than once"，故 Activity 须幂等（重试可能重复发邮件，用幂等键）。[activity-definition](https://docs.temporal.io/activity-definition)
- DBOS 是**进程内库**（非服务），"durable workflows built on Postgres"，失败重启从最后完成步恢复；显式面向多轮 Agent。[why-dbos](https://docs.dbos.dev/why-dbos) · [Pydantic-AI 集成](https://ai.pydantic.dev/durable_execution/dbos/)
- **差异**：印证权威状态入库/事件历史 + 确定性引擎 + 副作用幂等；但依赖是命令式持久代码，非声明依赖；LLM 是被重试的一步而非调度者——与本设计一致。Temporal 21.8k★ 日更；DBOS 1.5k★ 日更。

**Anthropic Claude Agent SDK** — 会话/子代理语义（与本设计 `02 §5` 会话复用直接对照）。
- 会话 = 磁盘 `.jsonl`（`~/.claude/projects/<cwd>/<session-id>.jsonl`），"persist the conversation, not the filesystem"；resume(指定 id)/continue(最近)/fork(拷贝历史后分叉)。[sessions](https://code.claude.com/docs/en/agent-sdk/sessions)
- **子代理上下文清零**："own fresh conversation"，只把最终消息返回父，不继承父历史/系统提示。[subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- 编排是 **LLM 路由**（父 Claude 按子代理 `description` 自动分派、可并发）；子代理转录持久、可独立 resume。[subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- **差异**：SDK 的**权威状态就是磁盘对话且由 LLM 推进**——与本设计正相反（本设计会话是缓存、权威在控制器）；SDK 无交付门、无 Effect 保证。Py 7.7k★ / TS 1.6k★，日更。

### 速览

**编码 Agent worktree 手动看板**（`vibe-kanban` 27.5k★ / `crystal` 3.1k★ / `claude-squad` 8.2k★）——共同形态：git worktree 隔离 + 人审 diff + **合并交人**（PR 或本地 rebase，无一自动合并/无 merge queue）。状态在本地 DB/文件由确定性应用（Rust/Electron/Go）写，非 LLM。[vibe-kanban git-operations](https://vibekanban.com/docs/workspaces/git-operations.md) · [crystal CLAUDE.md@v0.3.0](https://cdn.jsdelivr.net/gh/stravu/crystal@v0.3.0/CLAUDE.md) · [claude-squad README](https://github.com/smtg-ai/claude-squad)。风险信号：**vibe-kanban 母公司 bloop 已于 2026-04 宣布关停**（转社区维护、本地化）[shutdown](https://www.vibekanban.com/blog/shutdown)；**crystal 已弃**（继任闭源 Nimbalyst）。

**MrLesk/Backlog.md**（6.2k★，活跃）——**权威状态即 git 内 markdown 文件**（`backlog/task-*.md`），无 DB、无 LLM 控制器；含里程碑/依赖、验收标准 + DoD 清单；"一 task=一上下文=一 PR"。[README](https://raw.githubusercontent.com/MrLesk/Backlog.md/main/README.md)。是"markdown 当权威态给 agent 用"的干净样本——**与本设计明确否掉的 `README §11`"不保存所有对话/让 Issue Manager 兼任运行库"形成对照**。

**geekan/MetaGPT**（69.5k★，**last push 2026-01-21 停滞**）——"Code=SOP(Team)"，LLM 角色团队(PM/架构/工程)经 `Environment` 发布订阅消息池协作(`_watch` on `cause_by`)；**完成由 LLM 角色自审，QA 也是 LLM，无独立非 LLM 门**。[README](https://raw.githubusercontent.com/geekan/MetaGPT/main/README.md) · [通信](https://docs.deepwisdom.ai/main/en/guide/in_depth_guides/agent_communication.html)

**crewAIInc/crewAI**（55.9k★，极活跃）——分级 process 需 **LLM 经理**(`manager_llm`/`manager_agent`)做规划/分派/校验，"reviews outputs, and assesses task completion" 是 **LLM 自评，无自动测试/人门**。[processes](https://docs.crewai.com/concepts/processes)。MetaGPT/crewAI 共同印证本设计 `README §6` 要否掉的"多 Agent 投票/角色自审代替测试"路线。

**plandex-ai/plandex**（15.5k★，**陈旧 2025-10**）——累积 diff 审查沙箱把 AI 改动与项目文件隔离直到就绪 + 计划版本控制/分支；可全自主或分步，**人审 diff 为门**。[README](https://raw.githubusercontent.com/plandex-ai/plandex/main/README.md)

**Pythagora-io/gpt-pilot**（33.7k★，中活跃）——LLM 角色流水线(Spec→架构→Tech Lead→Dev→Code Monkey→审→调试)，**人是活跃门**（"95% AI + 5% 人"），可从步恢复。[README](https://raw.githubusercontent.com/Pythagora-io/gpt-pilot/main/README.md)

### 2026 H1 新项目（均经 `gh api` 一手核验存在，星标 @2026-07-21）

**builderz-labs/mission-control**（5.8k★，日更，创建 2026-02-13）——**与本设计的 Agent 运维控制面较像，但不等同于监督式交付环**。自托管控制面：权威态在 **SQLite 控制面 DB(WAL)**，任务走确定性状态链（inbox→分派→执行→审→**Aegis 流程门**→done）；混合调度（REST/CLI/MCP + cron + agent 轮询领取）。`done` 前要求一条 reviewer 标记为 `aegis` 的 approved record，但该记录既可由 scheduler 自动 reviewer 生成，也可由 operator API 写入，因此不是硬人审、独立身份 attestation 或正确性证明（固定 commit 证据见 [专项报告](2026-07-21-mission-control.md#23-aegis-的真实信任强度)）。**印证**：确定性控制面 + 流程门 + 运营审计；**未覆盖**：受保护防篡改 Gate、逐 Acceptance Coverage、就绪条件、集成态行为验证。

**AgentWrapper/agent-orchestrator**（8.4k★，日更，创建 2026-02-13；`ComposioHQ/agent-orchestrator` 重定向至此）——桌面 Agent IDE，**确定性 orchestrator（非 LLM）**："agents still do the coding, AO provides the harness"；每会话 git worktree，**冲突回路到属主会话**（"route CI failures, review comments, and merge conflicts back to the right session"）而非 merge queue；完成是多因子(CI/PR/review 真值)+看板监督。[README](https://raw.githubusercontent.com/AgentWrapper/agent-orchestrator/main/README.md)。印证"确定性 harness 包住 LLM"的姿态。

**omnigent-ai/omnigent**（7.6k★，日更，创建 2026-06-11，年轻）——元 harness 编排 Claude Code/Codex/Cursor 等，**隔离最强**：云沙箱(Modal/Daytona/E2B/K8s)+OS 沙箱(bubblewrap/seatbelt/Job Objects)+L7 出口代理 + 3 级策略引擎(server/agent/session，最严优先，含花费上限)；**LLM 分级编排**（并行 worktree 子代理→路由给 reviewer）；会话跨设备持久。[README](https://raw.githubusercontent.com/omnigent-ai/omnigent/main/README.md)。其策略引擎/出口代理与本设计 Broker(`02 §4`默认拒网、按能力放行)同向，但编排是 LLM 而非确定性。

**ogulcancelik/herdr**（19.0k★，日更，创建 2026-03-27，本组最高热度）——Rust 终端 agent 多路复用器，**会话持久是核心**（detach 后继续跑、ssh 重连、重启存活），socket API 让 agent 互相 `wait`（协调**原语**非调度器）；**刻意不做**worktree 隔离/合并/任务库/完成逻辑。[repo](https://github.com/ogulcancelik/herdr)。对照价值：会话多路复用 ≠ 编排；印证"会话层"与"编排层"应分开。

**荣誉提及（stance 对点但热度低/无，仅供参照）**：`open-multi-agent/open-multi-agent`（6.6k★）——"describe the goal, not the graph"，coordinator **运行时规划任务 DAG**，是 axis②动态 DAG 的样本，但通用非编码专用；`yongjip/mergetrain`（**仅 4★**，创建 2026-06-28）——"parallel coding-agent worktrees 的本地 merge queue，SQLite 队列 + gated trains + atomic push"，**正是本设计 `02 §2/§8` 单写者/merge queue 的靶心 stance，但零热度**，仅因主题精确命中而记录。[open-multi-agent](https://github.com/open-multi-agent/open-multi-agent) · [mergetrain](https://github.com/yongjip/mergetrain)

---

## 4. 与本仓库设计的差异清单

逐条：**我们的选择 / 主流做法 / 差异是否有意 · 风险**

1. **权威状态 = Postgres，迁移权归确定性控制器（`README §2`、`02 §3` CAS+fencing+outbox）**
   - 主流：确定性引擎阵营完全一致（Hatchet Postgres 持久、Temporal 事件历史、DBOS Postgres checkpoint、OpenHands 确定性控制器持事件日志、新样本 mission-control SQLite stage machine / agent-orchestrator 确定性守护进程）；LLM 框架阵营相反（Claude SDK 磁盘对话由 LLM 推进、MetaGPT/crewAI 进程内 LLM）。
   - **有意，低风险**。被最成熟的持久编排引擎多方印证；`02 §3` 明确对标 Absurd/Temporal 表数并主张单进程 Postgres 够用，判断稳。

2. **依赖 = 对权威记录重求值的就绪条件（`CANDIDATE_INTEGRATED`/`TASK_TERMINAL`），非 DAG 边；外部终态只是投影不反向驱动（`02 §2`、`04 §12`）**
   - 主流：**清一色 DAG 边或状态字段**——Hatchet 父子边、AutoGen GraphFlow、task-master 依赖数组、open-multi-agent 运行时 DAG。**未发现**任何系统把依赖建成"对内部权威记录求值的谓词、且外部终态永不驱动内部"。
   - **有意，中风险**。[推断] 这是本设计少有人走的路之一，正确性论证（失效可重算、无环、集成后物化 baseline）自洽；但**风险在收益兑现时点**：M1 闭合谓词集(`CANDIDATE_INTEGRATED`/`TASK_TERMINAL`)实际等价于 DAG，额外抽象成本要到 M2 动态扩图 + "外部结构变更走新 revision 重编译"时才回本。建议在 M1 明确此抽象是为 M2 预留，避免过早复杂度被误读为 M1 必需。

3. **隔离 = worktree + 容器（`02 §9` Linux/WSL2+容器为 v1）**
   - 主流：编码 Agent 圈 worktree 是标配（vibe-kanban/crystal/claude-squad/agent-orchestrator/omnigent）；omnigent 更进到云沙箱+OS 级 sandbox+出口代理。
   - **有意，低风险**。与赛道共识一致。omnigent 的多层沙箱是可选加强方向，但本设计 `README §11` 明确 v1 只认一种宿主+一种 sandbox、不并行维护多路径——克制得当。

4. **并行冲突 = 单写者串行合并 + 集成态行为验证（`02 §2/§8`、故障演练"某已交付行为被静默删除"）**
   - 主流：合并要么交人（vibe-kanban/crystal/claude-squad 全部人审、无自动合并）、要么回路到属主会话(agent-orchestrator)、要么本地 merge queue(mergetrain，但 4★)。**没有任何系统做"集成态行为验证防语义冲突静默删除"**；OpenHands 有单写者锁但只在单对话内。
   - **有意，高价值高风险**。[推断] "Git 无冲突+测试通过是危险假阳性"这一洞察在本次范围内**无先例**——既是最强差异化，也**最缺可抄实现**：集成态端到端/契约级重验的成本与"验哪些行为"的选择是未解工程问题。建议 M1c 把最小集成态 Assessment 的行为验证范围界定清楚（哪些是"已声明交付的行为"），否则易退化为"跑全量测试"而失去针对性。

5. **会话复用 = 一等能力但非权威通道，丢失全部会话仍可从权威状态重建（`02 §5`）**
   - 主流：Claude SDK(resume/continue/fork)、OpenHands(可恢复)、LangGraph(checkpointer+thread_id)、claude-squad(tmux 持久)、herdr(会话持久为核心)都有强会话；但**多数把会话当事实源**（尤其 Claude SDK 磁盘对话即权威）。
   - **有意，低风险**。本设计"会话是缓存不是事实源 + resume 失败显式降级留事件"比主流更严，方向正确。herdr 印证"会话层与编排层应分离"，恰是本设计把 AgentInstance 降为优化层的依据。

6. **编排 = 确定性控制器为主 + 可选 LLM 主管（只提议，指派经控制器校验，`02 §5`）**
   - 主流：两极——确定性引擎(Hatchet/Temporal/DBOS，无 LLM 路由) vs LLM 路由(Claude SDK、AutoGen Selector、crewAI 经理、MetaGPT、LangGraph supervisor)。AgentKit 的"可换确定性代码路由 over 持久步"是最近似的混合。
   - **有意，低风险**。"LLM 只提议、确定性代码持决定权"被 AgentKit 官方推荐(state-based 确定性路由更可靠可测)与 agent-orchestrator(确定性 harness)印证。

7. **完成判定 = 四层判定语义分离 + 受保护独立验证（Gate 与 Producer 隔离、Gate 自体质量校验，`README §5`、`INV-07/INV-13`、M1d）**
   - 主流：**普遍把"完成"塌缩成单一信号**——自报(task-master/MetaGPT/crewAI)、规则+可选 LLM judge(OpenHands)、人审 diff(vibe-kanban/crystal/plandex/gpt-pilot)、审批记录(mission-control Aegis 门)。**无一系统做"受保护 Gate 材料对 Producer 不可读 + Gate 自体先过 mutation/双向样本校验"的反作弊门**。
   - **有意，高价值高风险**。[推断] 四层分离(`Task Oracle≠Gate≠Release SLO≠Acceptance`)与防篡改 Gate 是本设计相对整个赛道最独特的护城河；mission-control 的审批门只到“自动或人工写入 approval record + 留审计”，未及独立身份、逐 Acceptance Evidence 或防作弊。风险：实现最重(受信 executor attestation、受保护材料挂载隔离、mutation 阈值)，是 M1d 的核心难点，须 M0 评测基线先证明 Gate 本身可信(`INV-13`)。

8. **不用 LLM 投票制造真相（`README §6` 单写者、Agent 只贡献智能不贡献动作/不投票）**
   - 主流：crewAI(LLM 经理评完成)、AutoGen(多 Agent 广播)、MetaGPT(角色团队)恰恰**依赖多 Agent 共识/角色自审**。
   - **有意，低风险**。本设计明确引"多数投票会在约 1/4 分歧压制正确答案"否掉这条路，与前身教训一致；是有依据的反主流选择。

9. **交付前一次人工批准，无人化由指标解锁不由架构删除（`README §1` M2/M3、无人化解锁标准）**
   - 主流编码 Agent：**止于人审/人批**——vibe-kanban/crystal/claude-squad 合并交人，gpt-pilot 仍有“5% 人”；mission-control 可自动 Aegis review 并推进 task `done`，但没有可信 Product/Release 或无人部署闭环。无一公开系统做无人部署（本设计自承 Devin/Codex 亦然）。
   - **有意，方向正确但 M3 无先例**。[推断] M3 无人 Staging 是真正无人验证过的领域，本设计"按变更风险类别、以误交付率置信上界解锁、指标恶化自动回退"的对冲是范围内最严谨的姿态；风险是**没有可参照的成功先例**，须靠自己的 M0/M1 零容忍指标买单——这与设计意图一致，非缺陷。

10. **外部系统只作输入源 + 投影目的地，不做双向同步、不当运行库（`04 §1/§7/§12`）**
    - 主流：反面教材充分——Backlog.md 把 markdown 当权威态、task-master 把 tasks.json 当态、MetaGPT 把消息池当态。本设计明确 `README §11` 否掉"让 Issue Manager 兼任项目记忆/运行库"。
    - **有意，低风险**。与前身项目 zhanggui/tuixiu 教训（文档/兼容层压过交付）一致，边界纪律清晰。

---

## 5. 来源清单

**本仓库设计**：`docs/README.md`、`docs/02-runtime.md`(§2/§3/§5/§8/§9/§10)、`docs/04-integrations.md`(§4/§7/§12)

**深读系统一手来源**
- OpenHands：[repo](https://github.com/OpenHands/OpenHands)、[events](https://docs.openhands.dev/sdk/arch/events)、[state.py](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/conversation/state.py)、[local_conversation.py](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/conversation/impl/local_conversation.py)、[runtime](https://docs.openhands.dev/openhands/usage/architecture/runtime)、[critic](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/critic/impl/agent_finished.py)、[judge](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/conversation/goal/judge.py)、[subagent schema](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/openhands-sdk/openhands/sdk/subagent/schema.py)
- AutoGen：[repo/README](https://github.com/microsoft/autogen)、[agent-runtime](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/agent-and-agent-runtime.html)、[topic/subscription](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/core-concepts/topic-and-subscription.html)、[teams](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html)、[graph-flow](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/graph-flow.html)、[state](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/state.html)
- LangGraph：[repo](https://github.com/langchain-ai/langgraph)、[persistence](https://docs.langchain.com/oss/python/langgraph/persistence)、[interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)、[graph-api](https://docs.langchain.com/oss/python/langgraph/graph-api)、[langgraph-supervisor-py](https://github.com/langchain-ai/langgraph-supervisor-py)
- task-master：[README](https://github.com/eyaltoledano/claude-task-master/blob/main/README.md)、[task-structure](https://github.com/eyaltoledano/claude-task-master/blob/main/docs/task-structure.md)、[command-reference](https://github.com/eyaltoledano/claude-task-master/blob/main/docs/command-reference.md)
- Hatchet：[repo](https://github.com/hatchet-dev/hatchet)、[durable-execution](https://docs.hatchet.run/home/durable-execution)、[DAG](https://docs.hatchet.run/v1/directed-acyclic-graphs)、[event-trigger](https://docs.hatchet.run/home/features/triggering-runs/event-trigger)
- Inngest AgentKit：[repo](https://github.com/inngest/agent-kit)、[networks](https://agentkit.inngest.com/concepts/networks)、[routers](https://agentkit.inngest.com/concepts/routers)、[routing](https://agentkit.inngest.com/advanced-patterns/routing)、[quick-start](https://agentkit.inngest.com/getting-started/quick-start)
- Temporal / DBOS：[Temporal repo](https://github.com/temporalio/temporal)、[Codex-on-Temporal 博客](https://temporal.io/blog/improving-java-sdk-codex-openai)、[activity-definition](https://docs.temporal.io/activity-definition)、[DBOS repo](https://github.com/dbos-inc/dbos-transact-py)、[why-dbos](https://docs.dbos.dev/why-dbos)、[Pydantic-AI DBOS](https://ai.pydantic.dev/durable_execution/dbos/)
- Claude Agent SDK：[sessions](https://code.claude.com/docs/en/agent-sdk/sessions)、[subagents](https://code.claude.com/docs/en/agent-sdk/subagents)、[Py repo](https://github.com/anthropics/claude-agent-sdk-python)、[TS repo](https://github.com/anthropics/claude-agent-sdk-typescript)

**速览系统一手来源**
- vibe-kanban：[repo](https://github.com/BloopAI/vibe-kanban)、[getting-started](https://vibekanban.com/docs/getting-started.md)、[git-operations](https://vibekanban.com/docs/workspaces/git-operations.md)、[sessions](https://vibekanban.com/docs/workspaces/sessions.md)、[issue-management](https://vibekanban.com/docs/issue-management.md)、[shutdown 公告](https://www.vibekanban.com/blog/shutdown)
- crystal：[repo](https://github.com/stravu/crystal)、[README@v0.3.0](https://cdn.jsdelivr.net/gh/stravu/crystal@v0.3.0/README.md)、[CLAUDE.md@v0.3.0](https://cdn.jsdelivr.net/gh/stravu/crystal@v0.3.0/CLAUDE.md)
- claude-squad：[repo/README](https://github.com/smtg-ai/claude-squad)
- Backlog.md：[README](https://raw.githubusercontent.com/MrLesk/Backlog.md/main/README.md)
- MetaGPT：[README](https://raw.githubusercontent.com/geekan/MetaGPT/main/README.md)、[通信文档](https://docs.deepwisdom.ai/main/en/guide/in_depth_guides/agent_communication.html)
- crewAI：[repo](https://github.com/crewAIInc/crewAI)、[processes](https://docs.crewai.com/concepts/processes)
- plandex：[README](https://raw.githubusercontent.com/plandex-ai/plandex/main/README.md)
- gpt-pilot：[README](https://raw.githubusercontent.com/Pythagora-io/gpt-pilot/main/README.md)

**2026 H1 新项目（`gh api` 一手核验）**
- [builderz-labs/mission-control](https://github.com/builderz-labs/mission-control)、[AgentWrapper/agent-orchestrator](https://github.com/AgentWrapper/agent-orchestrator)、[omnigent-ai/omnigent](https://github.com/omnigent-ai/omnigent)、[ogulcancelik/herdr](https://github.com/ogulcancelik/herdr)、[open-multi-agent/open-multi-agent](https://github.com/open-multi-agent/open-multi-agent)、[yongjip/mergetrain](https://github.com/yongjip/mergetrain)

**核验说明**：全部星标/最近推送/创建时间为 2026-07-21 经 `gh api repos/<owner>/<repo>` 实读；WebFetch 对 GitHub API 受限，故计数用 `gh` CLI（已认证一手）。子代理返回的搜索传闻中，"OpenClaw 382k★/Sam Altman 背书"、"SAM/Kiro 开源仓"等无法一手核验者已剔除。轴级事实取自各仓库自身文档，仅核验文档主张、未复核运行时行为。
