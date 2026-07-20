# Agent 运行、恢复与验证循环

## 1. Task 是不可变执行契约

每个 Task 至少包含：

```text
task_type       DISCOVER / BUILD / VERIFY / RELEASE / REPAIR
goal_revision / baseline_id
objective / inputs / expected_delta
task_oracle
coverage_requirement
requires / produces / invalidates / derived_from_finding
risk_class / capability_scope    capability_scope 可含粗粒度写作用域（可选，Broker 强制）
executor_profile / trust_domain
allowed_effects
budget          时间、token、并行、分支和产物预算
stop            成功、失败和终止条件
```

| 类型 | 产出与 Task Oracle |
|---|---|
| DISCOVER | 覆盖要求的信息面，产生可复现 Evidence，并把剩余 Unknown 正确分类 |
| BUILD | 产生满足结构约束且可封存的 Candidate |
| VERIFY | 通过受信采集路径产生独立 Evidence，并提出反例和 finding claim；不能自行给出正式 Finding 或 PASS |
| RELEASE | 准备或观察交付；真实写操作仍由 Release Controller 和 Effect Dispatcher 执行 |
| REPAIR | 针对一个已去重 Finding 产生新 Candidate 或消除阻塞 Unknown |

每种 Task 都必须有适合其类型的 Task Oracle。Task `SUCCEEDED` 只表示当前执行契约完成，不表示 Candidate 已通过 Gate，也不表示 Release 健康。AI 生成的 Oracle、测试或图结构仍是提议，受保护部分必须由策略或独立信号确认。

## 2. 动态 Task Graph

Planner 或任意 Agent 可以提议 Task 和依赖，只有确定性控制器能够接受并写入权威图。每次扩图至少检查：

- `requires` 无环且引用同一有效 Goal/Baseline；
- 总预算、并行度、分支数和产物预算不超限；
- capability 和 Effect 没有越过 Boundary；
- 并行 BUILD/REPAIR 的写作用域尽量不重叠（**降低冲突频率的优化，非正确性前提**——正确性由单写者串行合并保证）：分解时按目录/模块声明**粗粒度**写作用域（不要求精确到文件、不要求开工前预知全部改动），控制器发现声明作用域相交就不并行、退回串行；切不干净时直接串行即可，串行是安全缺省而非失败。热点文件（路由、config、DI、schema、i18n）显式归单一 owner，或用接口/注册表先行的前置 BUILD Task 收口；
- Risk Policy 要求的 VERIFY 和结构性独立性已经存在；
- 受保护 VERIFY 绑定可信 executor profile，普通 Agent Runner 无权 claim；
- RELEASE 之前存在当前适用的 PASS Assessment；
- 相同 Finding、Candidate 和修复策略没有超过次数与 fan-out 上限。

正式 Finding 只能在 finding claim 获得 Claim-subject `PASS` Assessment 后产生，再形成新的 DISCOVER/REPAIR Task。该 Finding 可作为 Candidate Assessment `FAIL/INCONCLUSIVE` 的原因。Verifier、Planner 和发布控制器都不能绕过 Task、Context、预算、权限和状态机直接命令 Agent。Task 是不可变契约；Baseline 改变时创建执行 rebase 的 BUILD/REPAIR Task 并重新 VERIFY，而不是原地修改旧 Task。

## 3. 权威状态机

所有转换由控制器用 `expected_revision` 做 CAS；Agent 只能提交转换请求和输入引用。

```text
Task:
  WAITING → READY → RUNNING
  RUNNING → READY（新 Run 重试）| SUCCEEDED | FAILED | BLOCKED
  任意非终态 → CANCELLED | STALE

Run:
  QUEUED → CLAIMED → RUNNING → SUCCEEDED | FAILED
  任意非终态 → CANCELLED；CLAIMED/RUNNING lease 到期 → EXPIRED

Candidate:
  DRAFT → SEALED → PROMOTED | REJECTED | STALE

Assessment:
  PENDING → RUNNING → PASS | FAIL | INCONCLUSIVE

Effect:
  PREPARED → REJECTED | DISPATCHED → CONFIRMED | FAILED | UNKNOWN
  UNKNOWN --reconcile--> CONFIRMED | FAILED | PREPARED
  FAILED --证明未执行且策略允许重试--> PREPARED
  CONFIRMED → COMPENSATING → COMPENSATED | COMPENSATION_FAILED

Release:
  PREPARED → DEPLOYING → OBSERVING → HEALTHY | FAILED | UNKNOWN
  HEALTHY | FAILED → ROLLING_BACK → ROLLED_BACK | ROLLBACK_FAILED | UNKNOWN
  UNKNOWN --按 previous_phase 对账--> 对应阶段的合法状态
  PREPARED → CANCELLED
```

`BLOCKED` 只有原因消除且 Task 契约仍兼容时才能回到 READY。Assessment verdict 保持不可变，输入失效只令 applicability 为 STALE。`UNKNOWN` 必须先 reconcile；只有回读证明副作用未发生，Effect 才能回到 PREPARED。

控制器用 Task revision 原子地将 READY 占位为 RUNNING 并创建唯一 QUEUED Run；`(task_id, active)` 最多一个，显式并行只能创建 Fork child Task。Runner 先取得本地容量，再原子 claim 与自身 attestation、executor profile 和 trust domain 匹配的 Run，并获得 lease 与单调 fencing token；只有可信 VERIFY executor 才挂载受保护材料。数据库记录是事实源，WebSocket、消息通知和轮询只负责唤醒。Task 可以顺序拥有多个 Run，一个 Product Revision 可以有多个环境 Release。

**实现注记（M1/M2）**：单仓单团队规模不需要分布式引擎。单进程控制面 + Postgres 即可承载全部语义——`SELECT … FOR UPDATE SKIP LOCKED` 作 Run 队列，单调 revision 列 + 条件 UPDATE 实现 CAS、lease 与 fencing（先例：Absurd 5 张表对 Temporal 37 张表）。fencing 校验必须发生在**被写目标侧**（State Core 每个写入口和 Effect Dispatcher），仅在签发侧生成 token 不构成保护。若后续 Runner 规模化，可用 durable execution 引擎（Temporal/DBOS，OpenAI Codex 生产运行于 Temporal）替换 Run 编排、恢复与认领层；但引擎 Activity 只有 at-least-once 语义，Effect Ledger、领域状态机和语义 GC 不可外购。

## 4. Sandboxed Runner 与 Capability Broker

每个 Run 使用隔离 workspace、最小 Context View 和 Task 级短期 Capability Grant。Broker 必须把纯读取/隔离本地操作与真实外部写入分流：

```text
typed tool request
  → capability + policy + fencing 检查
      ├─ read / isolated local write
      │    → 必要时注入短期 Secret → sandbox → 脱敏观察 → Evidence/Coverage
      └─ shared or external write
           → 只生成 Effect intent → Controller 创建 Effect
           → Effect Dispatcher 执行 → receipt
```

任何会改变 Git 远端、Issue Manager、配置、部署环境或其他共享系统的工具都属于第二条路径，不能以“同步工具调用”绕过 Effect Ledger。隔离 worktree 内的 Candidate 修改不属于外部 Effect。可选地，Broker 可按 Task 声明的粗粒度写作用域拒绝域外写入：Agent 越域写入即作为信号（该 Task 需扩域或退回串行），而非让并行 Task 静默相撞；此项把声明的所有权从建议变为强制，但非必需——缺省下仍由单写者串行合并兜底。

Broker 是 Agent Runtime 内部安全边界，不是新顶层组件：

- 网络默认拒绝，按 tool、action、target、audience、有效期和预算放行；
- Agent 只得到不透明工具句柄，拿不到长期 token；
- 外部文本、评论、Skill 和 Candidate 不能扩张 capability；
- Producer 能看到 Acceptance Contract、Task Oracle 和 Coverage requirement，但看不到受保护 Gate 的测试夹具、生成器、秘密反例和预期值；Verifier 默认只读 Candidate；
- 每次工具请求和 Effect dispatch 都重新检查授权；
- Transcript 只是短期可观测数据，不是可靠 checkpoint 或权威状态。

不同 provider 只是 Runner adapter。产品、架构、开发和 Review 是按需能力模板；一个 Agent 可以执行相邻能力，只要 Assurance 仍保持结构性独立。

## 5. Continue、Resume、Retry、Rerun 与 Fork

续接必须指向确切来源，永不按“最近一次会话”猜测：

| 操作 | 语义与继承规则 |
|---|---|
| Continue | 同一有效 lease 下继续当前 Run 和短期会话 |
| Resume | 旧 Run 已停止；从确切 checkpoint 创建带新 lease/fence 的 Run，复用前重新检查 Baseline 和 Capability |
| Retry | 针对可重试基础设施失败创建新 Run，记录 `retry_of_run_id`；workdir 可复用，session 仅在未污染且 provider 支持时复用 |
| Rerun | 显式重新执行，记录 `rerun_of_run_id`；默认使用新 session 和新 workdir |
| Re-enter | 换 Agent 接手同一有效 branch，不继承旧聊天；新建 Run |
| Fork | 从确切不可变 checkpoint/Candidate 创建 child Task 和隔离 branch，记录 `fork_of_*`，拥有独立预算与 namespace |
| Rebase | 基于新 Baseline 创建新 Task 和 branch generation，记录 `rebased_from_task_id`；不改写旧 checkpoint |
| Merge | 单写者串行合入 Candidate Delta（一次一个）；在**集成后的合并结果**上、绑定**集成后 Baseline** 重新 Assessment 后才可能晋升 Product Revision，不复用各 Candidate 孤立 VERIFY 的结论 |

`session_id` 与 `work_dir` 是两个独立引用。原目录丢失、运行时不同或会话污染时，只能显式降级；provider resume 失败可在同一新 Run 中 fresh fallback，但必须留下事件，不能伪装成成功续接。

Rerun 和 Fork 默认既不继承也不自动重放 Effect。它们再次提出同一 intent 时，控制器先按 `intent_hash + idempotency scope` 查询既有 Effect，再决定复用、拒绝或创建新 Effect；Fork 在 Candidate 被选中并通过 Assessment 前禁止真实外部副作用。

Checkpoint 只保存：

```text
task/run/source ids + baseline revision
branch generation + sealed delta ref
execution cursor + provider continuation ref
Coverage summary + unresolved Unknown
Effect ids/states + context manifest ref
```

它不保存完整聊天或推理文本，也不提高任何 Claim 的可信度。

## 6. Lease、fencing 与失效

所有可变记录都有 revision。Run claim 产生单调 fencing token；heartbeat、checkpoint、result、Candidate seal 以及 Run 来源的 Effect intent 都必须携带当前 token。lease 到期后旧 worker 写入被拒绝，控制器按策略创建新 Run。Release、Projection 和 Operator 来源的 Effect 不复用 Producer fence，而校验各自控制聚合的 revision 与 Dispatcher lease/fence。

[Baseline 兼容策略](01-context-and-trust.md#2-baseline-snapshot-不是全局事务快照)在 Run start、Resume、Candidate seal、Assessment、Product promotion、Effect dispatch、Release 和 `DELIVERED` 前执行。四类判定不能混用：Acceptance Contract 改变产生新 Goal Revision；Task Oracle 或输入改变产生新 Task；Gate Policy/受保护 Gate 实现改变触发新 Assessment；Release SLO、环境或 rollout policy 改变触发 Release 重验或新 Release。checkpoint 永不携带授权。

取消同样是带 revision 的状态转换。Runner 收到取消后终止进程树并丢弃迟到结果；仅依赖协作式 Prompt 停止不构成取消机制。

## 7. Effect Ledger

Agent 只能提出 Effect intent，控制器验证后才创建；Release、Outcome Projection 和 Operator 也可以成为 Effect 来源：

```text
effect_id / goal_revision
origin_type          RUN / RELEASE / PROJECTION / OPERATOR
origin_ref
control_ref / controlling_revision
intent_hash / idempotency_key / target
authorization_basis_ref
PREPARED / REJECTED / DISPATCHED / CONFIRMED / FAILED / UNKNOWN
COMPENSATING / COMPENSATED / COMPENSATION_FAILED
dispatch_attempt_refs
receipt / read_back / compensation_ref
```

- Run 来源在创建 intent 时校验 Run fence；其他来源校验控制聚合 revision 或 Operator command ID；
- Effect 保存授权依据，不保存一个永不过期的执行 Grant；每次 dispatch 在 attempt 中记录新签发的短期 Grant、Dispatcher lease/fence 和结果；
- 撤销原写权限会阻止新写，但已 DISPATCHED 的 Effect 可以获得独立、只读且仅限原 target 的 reconcile Grant；若策略不允许安全回读则保持 UNKNOWN 并进入 Operator 对账；
- Resume、Retry 和 Projection Outbox 唤醒复用原 Effect 与幂等键；只有 Effect Dispatcher 调用外部 API、决定重试并迁移状态；
- dispatch 前授权失败进入 `REJECTED`；外部明确失败进入 `FAILED`，只有回执证明副作用未发生且策略标记 retryable 时才能回到 PREPARED；
- `UNKNOWN` 先查询外部状态，再确认、补偿或决定是否重发；
- 补偿是拥有独立 intent、幂等键、授权和 attempts 的 child Effect；原 Effect 的 `COMPENSATING/COMPENSATED` 由 `compensation_ref` 指向的 child 状态派生；
- Replay 默认禁止真实副作用；
- 无法幂等、回读或补偿的高影响操作不自动执行；
- Git、PR、飞书、配置和部署都遵守同一状态机，不把 API 调用散落到 Agent prompt。

该状态机不是新发明：它是“客户端生成幂等键 + 外部调用前先落本地 intent（Stripe/Brandur 模式）+ transactional outbox/inbox 去重 + 超时先回读”的成熟组合，Postgres 单表加事务即可实现，实现时应对照这些先例而不是自创协议。

## 8. Assessment、Delivery 与自愈

Release 至少记录：

```text
release_id / product_revision_id / environment_revision
delivery_mode / release_policy_revision / rollout_strategy
status / health_evidence / rollback_target
previous_phase        UNKNOWN 时用于对账
```

受保护检查和独立 Verifier 也必须由 VERIFY Task 产生受信 executor Run，因此同样受预算、lease、fencing 和审计约束。Gate Controller 不直接执行隐形工作；它只消费这些 Run 通过 Broker/Assurance 记录的 Evidence，并创建 Assessment。

```text
SEALED Candidate
  → VERIFY Runs: build/schema/static checks
  → VERIFY Runs: protected tests + independent verification
  → VERIFY Runs: counterexample/fault search when policy requires
  → Gate Controller → Assessment
```

以 Claim 为 subject 的 Assessment 只派生该 Claim 的 `verified/refuted` 状态，不晋升 Product。Candidate Assessment 必须绑定当前 Goal Revision、Baseline 和 Gate Policy，以 Evidence 逐条覆盖硬 Acceptance Contract，且没有 `BLOCKING` Unknown，PASS 后才可晋升 Product Revision；随后按 Delivery Mode 收束：

- `ARTIFACT_ONLY`：由当前 PASS Assessment 晋升并封存的 Product Revision 已可获取；
- `PULL_REQUEST`：创建 PR 的 Effect 已 CONFIRMED；
- `STAGING/PRODUCTION`：Release 经过 DEPLOYING、OBSERVING 并满足 Release SLO，状态为 HEALTHY。

多个 Candidate 并入同一 Product Revision 时按单写者串行合入，每并一个即在集成态重验一次：Assessment 必须以行为化 Evidence（端到端/契约）确认没有某 Candidate 已声明交付的行为被并入其它 Candidate 后**静默删除**——语义冲突不产生文本冲突，单靠孤立 VERIFY 与构建/类型通过无法发现，"Git 无冲突且测试通过"是危险的假阳性。任一 Candidate 使集成态失败则出队转 REPAIR，不阻塞其余（同 merge queue 踢出失败项）。

运行偏差先形成 Evidence 和 finding claim；该 Claim 获得 Claim-subject `PASS` Assessment 后才成为正式 Finding，再经去重生成有界 DISCOVER/REPAIR Task。系统设置最大连续修复次数、策略升级次数、冷却期和风险预算；无改进、预算耗尽或关键来源不可达时返回 `NO_SAFE_DELIVERY`，不能降低 Gate 伪造完成。

回滚也是 Release/Effect。执行前必须检查当前 schema、配置和环境兼容性，不能因为某版本过去安全就盲目回滚。

## 9. 部署拓扑：控制面上云，执行面跟随代码

控制面（权威状态库、队列、通知投影）可托管云端；代码仓库与模型凭据所在的机器运行 **Worker 守护进程**，只用出站长连接/轮询认领工作，无入站端口要求。仓库检出、长期密钥和模型凭据不进入控制面；控制面持有权威记录及其必要 payload——需求文本、Goal 草稿、固化文档快照（含 `file://` 内容，为审计与跨 Worker 一致性所需）、diff、Evidence 和回执。

Worker 认领两类工作，共用同一套 claim/lease/fencing 协议（§3）：

| 工作域 | 内容 | 权限 |
|---|---|---|
| Gateway 域 | Intake 澄清会话的单轮 clarify job：读仓库与引用文档，产出回复或 Goal 草稿 | 只读工具，无 Bash/写文件，不产生 Effect |
| Task 域 | Goal 下的 Run（DISCOVER/BUILD/VERIFY/…） | 按 Task 声明的 capability |

clarify job 挂在 Intake 而非 Goal 下，不进入 §3 的 Task/Run 状态机（后者只编排 Goal 下的执行）：它是单轮无副作用作业，只读取仓库与文档快照、产出一条回复或 Goal 草稿，不产生 Candidate、Evidence 或 Effect。claim/lease/fencing 协议同样适用：控制器按 Intake 会话轮次签发 lease 与单调 token，Intake 写入口在被写目标侧校验当前 token（同 §3 实现注记），旧 Worker 迟到的回复被拒；失败、超时或 Worker 离线后本轮可被另一匹配 Worker 重认领，clarify job 无需 checkpoint，重认领即重跑当前轮。对话消息不进入 Goal Context——执行者只消费草稿文本与固化文档快照（[04 §7](04-integrations.md#7-project-注册表intake-与文档-provider)）。Gateway 域不产生 Context View，INV-08 的 manifest 义务只覆盖 Task 域 Run；工具白名单仍由 Worker 侧 Broker（§4 同一边界，此处仅授予只读工具）强制执行，Agent 同样不获得长期凭证（INV-02）。

受保护材料随执行面驻留：受保护 Gate 的测试夹具、生成器、秘密反例和预期值存在持有仓库的 Worker 机器上，不进入控制面。单机模式（Producer Run 与受保护 VERIFY 同机）不豁免 INV-07——两者必须文件系统隔离：受保护材料挂载在 Producer Run 不可读、不可写的路径（独立 OS 用户或容器 + 独立工作目录），只有通过 attestation 的可信 VERIFY executor 才获得挂载。合并部署是同一隔离要求的本地实现，不是放宽隔离的理由。多 Worker 时，材料持有并入 attestation 声明：材料由 Operator 经受信通道预置（不经控制面分发），受信 VERIFY executor 注册时携带所持材料的 digest，控制器只把受保护 VERIFY 派给 digest 与 Baseline `protected_gate_revision` 匹配的 executor，无匹配则显式排队（同下文降级行为），不降级到 Producer 可读路径。

路由复用既有 attestation/executor profile 机制：Project 注册表声明路由标签，Worker 注册时携带自身标签与持有仓库声明，控制器只把 job 派给标签匹配的 Worker。同一 Project 的仓库由哪台机器持有对用户透明。

客户端（Web Console 或后续桌面壳）与 Worker 一样只出站接入；通知（待批准、需澄清、交付完成）经 Outcome/事件投影推送（WebSocket/SSE，飞书 IM 卡片是后置连接器）。

降级行为：Worker 离线时 job 停留在队列并按 lease 语义可被其他匹配 Worker 认领（无匹配 Worker 则显式排队，不静默丢弃）；控制面不可达时 Worker 不得自行开工新 job，进行中的 Run 可完成本地执行但结果上报按幂等重试，lease 过期后旧 token 写入照常被拒。单机模式（控制面与 Worker 同进程或同机）是同一协议的合并部署，不是独立代码路径。

## 10. 必须通过的故障演练

| 场景 | 必须保持的结果 |
|---|---|
| Verify 后主干或 Goal 改变 | Assessment applicability 变为 STALE，Release 被阻止并创建执行 rebase 的 BUILD/REPAIR Task 与后续 VERIFY |
| 外部写成功但响应丢失 | Effect 进入 UNKNOWN，先回读，不重复副作用 |
| Resume 时授权已撤销 | 可读取允许的恢复材料，但所有越权写入被 Broker 拒绝 |
| Producer 修改测试或 Gate | Assurance 使用隔离的受保护版本，篡改不能影响 Assessment |
| Context 索引落后 | 回退权威状态和 Source，不静默省略 |
| Runner 丢失 lease 后恢复 | 旧 fencing token 的 checkpoint、结果、Candidate seal 和 Run 来源 Effect intent 全部被拒绝 |
| 老 Goal 的 Run 晚于新 Goal 完成 | 保留历史 Evidence，但不能覆盖新 Outcome |
| 相同 Finding 连续出现 | 去重并升级验证/修复策略，达到上限后停止 |
| 多个 Candidate 合并后某已交付行为被静默删除 | 集成态行为验证发现语义冲突，该合并 Assessment 判 FAIL 并转 REPAIR；文本无冲突加构建通过不构成 PASS |
