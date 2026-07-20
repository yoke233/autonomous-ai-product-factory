# 上下文与可信状态

## 1. 要解决的问题

新 Agent 启动时既不能从零扫描整个项目，也不能盲信上一个 Agent 的总结。正确做法是：

> 不继承 Agent 记忆；基于版本化项目状态，为当前 Task 编译一次性 Context View。

## 2. Baseline Snapshot 不是全局事务快照

代码、配置中心、schema、外部 API、环境和授权不可能在同一时刻原子冻结。Baseline Snapshot 是一组不可变引用，加一组带时效的观察：

```text
goal_revision
git_commit / dependency_lock_digest / image_digest
schema_revision / product_revision
doc_snapshot        ref, content_digest, version, resolved_at
remote_config       value_digest, etag, observed_at, expires_at
external_api        capability_digest, observed_at, expires_at
policy_revision / protected_gate_revision
capability_grant_ref, expires_at
```

Baseline 不声称这些来源来自同一个全局瞬间；它记录每个来源的版本、观察时间、有效期和兼容策略。无法枚举、拒绝访问、输出截断或过期的来源必须进入 Unknown，搜索结果不能冒充项目全集。

`doc_snapshot` 是一次性固化的只读输入（内容 + version/hash，见 [04 §7](04-integrations.md#7-project-注册表intake-与文档-provider)）。固化时点唯一：经 Intake 的 Goal 继承澄清期间固化的快照——保证人确认的草稿与执行依据一致，Goal 编译不重新 resolve；无 Intake 的入口（如 Connector `revise`）在 Goal 编译时 resolve 固化；Rebase 产生的新 Baseline 继承同一 Goal Revision 的快照。它属不可变引用而非动态观察，不带 `expires_at`：执行期间不重新 resolve，外部文档变化不触发 stale，只有新 Goal Revision 才更新快照。编译新 Goal Revision 时 resolve 失败的引用按本节规则进入 Unknown，不静默省略；provider 不可达不影响已冻结快照的执行。

控制器在以下位置重新检查兼容性：

```text
Run 开始 → Resume → Candidate seal → Assessment
          → Product promotion → Effect dispatch → Release → DELIVERED
```

- Goal 或 Git 基线不兼容：旧 Candidate 禁止晋升，基于新 Baseline 创建执行 rebase 的 BUILD/REPAIR Task，并重新 VERIFY；
- 动态观察到期：重新观察并按依赖选择性失效；影响不清时扩大重验范围；
- Gate Policy 或受保护 Gate 实现改变：重新 Assessment；
- Capability 过期或撤销：重新授权，不能从 checkpoint 继承；
- 目标环境改变：重新计算 Release 兼容性。

## 3. Context Compiler 与 Manifest

Compiler 输入 Goal、Task、Baseline、直接 Source 引用、仍适用的 Evidence、当前 Delta、Coverage 要求以及 token、时间和权限预算，输出一次性 Context View：

```text
任务、Task Oracle、停止条件和硬约束
最相关的直接来源与当前 Delta
已有 Evidence 及其 scope
Unknown、冲突和 Coverage gap
被省略类别与按需查询入口
```

大段源码、日志和历史候选按需 Pull；Goal、硬约束、Unknown 和验证义务始终 Push。Context View 属于可删除运行 payload，不进入长期记忆。

Context 记录采用不可变的“计划—回执—封存”时序，并按关联 Run/Assessment 的策略回收：

```text
planned_manifest:
  compiler_version / goal_revision / task_id / run_id / baseline_id
  required_inputs / materialized_inputs / input_refs_and_digests
  source_manifest / omission_manifest / policy_revision / capability_scope_ref

delivery_receipt:
  run_id / planned_manifest_ref / sequence / previous_receipt_digest
  input_ref / digest / delivered_at / channel / result

sealed_manifest:
  planned_manifest_ref / run_id / delivery_receipt_refs
  receipt_count / chain_head_digest / final_context_digest
```

控制器创建 Run 后，Compiler 为该 `run_id` 写 planned manifest；Runtime 每次 Push 或按需 Pull 都追加独立 delivery receipt。Run 结束后，控制器只接受 `run_id` 与 planned manifest 一致的 receipt，校验 manifest 引用、sequence、receipt count 和 digest 链，并把同一 `run_id` 与 chain head 写入 sealed manifest，不原地改写记录。它只证明系统计划、物化和交付了什么，不证明 Agent 已理解。Secret、长期 token 和原始大 payload 永不进入这些记录、日志或 Evidence。

## 4. Evidence、Claim 与 Assessment

不建设描述整个世界的知识图谱，只保存任务需要且能失效的结论链：

- Evidence：来源、采集过程、结果摘要、环境、时间、scope 和 Baseline；它是观察，不是裁决；
- Claim：Agent 或规则提出的待判断结论，包含 `scope / baseline_id`、supporting/refuting Evidence 和 invalidation rule；
- Assessment：控制器依据版本化 Assessment Policy 对 Candidate 或 Claim 做出的正式判断；Candidate 使用 Gate Policy。

Assessment 可以判断 Candidate 或单个 Claim，至少包含：

```text
subject_type        CANDIDATE / CLAIM
subject_ref / goal_revision / baseline_id / assessment_policy_revision
verdict             PASS / FAIL / INCONCLUSIVE
evidence_refs
acceptance_results[] Candidate subject 时记录 acceptance_ref、verdict、evidence_refs、unknown_refs
blocking_unknowns
findings
assessed_at
```

Candidate 只有在 Goal/Baseline/Policy 当前有效、每条硬 Acceptance Contract 都映射到充分 Evidence、且没有 `BLOCKING` Unknown 时才能 PASS。Finding 是经 Claim-subject `PASS` Assessment 验证成立的缺陷 Claim，并可成为 Candidate Assessment `FAIL/INCONCLUSIVE` 的结构化原因，不必成为独立服务。Assessment verdict 不因后续变化被改写；控制器只计算其 applicability。Claim 的 `verified / refuted / stale` 由以该 Claim 为 subject 的 Assessment 派生，Agent 无权直接设置。

只有由当前适用 PASS Assessment 支持、scope 覆盖当前 Task 且没有阻塞冲突的 Claim，才能作为 Context 中的可用事实。

## 5. 风险驱动 Coverage 与 Unknown

Coverage 要求由 Risk Policy 生成，Agent 不能自行缩减：

```text
risk_class
enumerator_version / source_snapshot
required_surfaces
access_observed_surfaces
excluded_surfaces    surface, reason, policy_revision, expires_at
blocking_gaps
evidence_refs
```

`excluded_surfaces` 只能由 Risk Policy 或 Boundary Controller 产生；属于 Acceptance Contract 的信息面不能靠排除项消失。过期或无 policy 引用的排除项按 gap 处理。

不同变更至少覆盖不同信息面：

| 变更 | 强制信息面 |
|---|---|
| 文案或局部展示 | 引用、构建和相关快照测试 |
| API 行为 | 路由、调用链、schema、消费者和兼容路径 |
| 数据库 | migration、读写路径、数据兼容和回滚 |
| 鉴权 | 所有入口、角色矩阵、拒绝路径和审计 |
| 订单/支付 | 幂等、并发、事务、重复消费、故障恢复和运行指标 |

输入送达、访问遥测和事实判断必须分开：

```text
required → materialized → delivered
                         → access_observed

Source observation → Evidence → Assessment → verified/refuted Claim
```

`materialized/delivered` 来自 Compiler 和 Runtime 回执；工具遥测只能证明发生过访问，不能证明 Agent 理解或检查正确。`verified` 必须由 Evidence 和 Assessment 导出。负面结论只能表述为“在快照 X、枚举器 Y、规则 Z 和排除项 E 的范围内未发现”。

Unknown 分类为：

- `BLOCKING`：阻止 Candidate 晋升或交付；
- `TOLERATED_BY_POLICY`：必须引用明确 Policy Revision、适用范围和失效条件，Agent 不能自行降级；
- `DEFERRED`：必须绑定 successor Task 或明确的 Goal scope exclusion；只要仍属于 Acceptance Contract，就继续按 `BLOCKING` 处理；
- `RESOLVED`：引用真正解决它的 Evidence；新 Goal Revision 只有明确移除该义务并将旧 Goal 标为 superseded 时才能结束追踪，这不等于旧 Goal 已验证或可 DELIVERED。

Coverage 长期只保留集合摘要、缺口和 Evidence 引用；逐次 read/search 事件短期保存，避免 Coverage 本身形成数据洪水。

## 6. 交接与结构性独立验证

普通 Agent 交接只传：

```text
Goal + Baseline + Task + Context Manifest
Artifact/Evidence refs + Branch Delta
Coverage gaps + Unknown/Finding + Required reverification
```

Verifier 首轮 Context Manifest 必须过滤 Producer Claim、Finding 和解释，只保留原始 Goal、Baseline、只读 Candidate、公开验收条件和独立 Source；形成自己的 finding claim 后，第二轮才开放差异材料。盲审只能减少锚定，真正的独立性还要求：

- Acceptance Contract、Task Oracle 和 Coverage requirement 对 Producer 公开；受保护 Gate 的测试夹具、生成器、秘密反例和预期值位于 Producer 不可读、不可写的隔离存储（实证：评分函数对模型可见时作弊率高 43 倍；隐藏 holdout 测试可把作弊压到近零）；
- 只读不等于安全：作弊手段包括对测试输入硬编码返回值、运算符重载欺骗断言、从 git 历史挖出既有修复照抄。因此 VERIFY 环境必须同时移除答案泄漏面（如原仓库完整 git 历史），并用行为差分而非仅断言相等来判定；
- 受保护 Gate 材料自身先过质量 Assessment 才能生效（INV-13）：mutation 分数达阈值、已知正确 Patch 必须通过、已知错误 Patch 必须被拒——错误的 Gate 会同时拒真放假（SWE-bench 原始题目深审 >60% 不可解的教训）；校验测试优先锚定 spec 派生的性质与不变量，而非 Producer 同源的样例断言；
- 验证环境与开发环境隔离，Candidate 不能修改 Gate 配置；
- Verifier 使用独立检索路径，并默认只有 Candidate 只读权限；
- 硬 Gate 至少包含一个确定性检查、属性/差分测试、故障注入、外部回读或运行指标；
- 高风险策略可以升级到不同模型或提供方，但模型差异不能代替独立行为信号。

验证信号的可信层级固定为：**隔离的确定性检查 > 独立行为信号（差分/故障注入/外部回读/运行指标） > 执行过程结构信号（如盲目重试、缺失验证步骤的轨迹降权） > LLM 评审**。LLM 评审只能产生 Claim 和 Evidence，永不直接构成 PASS；多数投票在相同输入下不提升期望正确率，且会在约 1/4 的分歧中压制正确答案。

## 7. 失效

源码、动态观察、Goal、Product、Gate Policy、受保护 Gate 实现或环境版本变化时，依赖它们的 Context、Claim 和 Assessment applicability 进入 stale。Evidence 仍作为历史观察保留，但不能跨不兼容 Baseline 继续充当事实。

影响关系不完整时保守扩大检查范围，不能因为依赖图没有找到路径就断言不受影响。`BLOCKING` Unknown 不会因过期自动消失；它只能被 Evidence 解决，或继续阻止晋升和交付。
