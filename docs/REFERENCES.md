# 冷参考索引

本文件不进入默认 Agent Context，只在验证设计依据时读取。

## 2026-07-20 深度研究（v0.6 修订依据）

完整报告与证据链：`C:\Users\xyad\Documents\AI_Product_Factory_Research_20260720\`（report.md/html + sources/evidence/claims.jsonl，50 来源、44 条证据、15 条已裁决主张）。

**采纳的裁决**：(1) 信任模型骨架与 12 条不变量全部保留，无一被证据否定；(2) “编译一次冻结 + 歧义即拒”改为版本化活契约 + 分级歧义门——Spec Kit/Kiro/Tessl 一线实测一致判定冻结式规格为瀑布回潮，且 LLM 歧义检测高召回低精度、“知而不问”（澄清率 ≤5%）；(3) “正常路径无人参与部署”降为按证据解锁的 M3 目标——2026 年无任何公开生产系统实现无人部署；(4) 新增 INV-13（受保护 Gate 自身质检）——SWE-bench 深审 >60% 问题题不可解、只读测试挡不住硬编码/运算符重载；(5) MVP 实现“买内核建语义层”：单进程 + Postgres 承载全部并发语义，Effect Ledger 按 Stripe/Brandur + Outbox/Inbox 落地。

**关键新来源**：
- [METR: Recent Frontier Models Are Reward Hacking](https://metr.org/blog/2025-06-05-recent-reward-hacking/)（评分函数可见→作弊率 43×）
- [ImpossibleBench](https://arxiv.org/html/2510.20270v1)（只测试作 gate 时前沿模型作弊率约 50%；组合防御实证）
- [Anthropic: Natural Emergent Misalignment from Reward Hacking](https://arxiv.org/pdf/2511.18397)（作弊泛化为广义失准）
- [Multi-LLM Debate 是鞅（ICLR Blogposts 2025）](https://d2jud02ci9yv69.cloudfront.net/2025-04-28-mad-159/blog/mad/)（投票不制造真相的数学依据）
- [Böckeler: Understanding Spec-Driven-Development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) / [Scott Logic: Spec Kit 实测](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html)（冻结式规格证否）
- [Knowing but Not Showing](https://arxiv.org/html/2605.25284)（LLM 知而不问）+ [ICSME 2025 工业歧义检测](https://www.ipr.mdu.se/pdf_publications/7221.pdf)（高召回低精度）
- [Cognition: Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents) / [Multi-Agents: What's Actually Working](https://cognition.com/blog/multi-agents-working)（单写者原则）
- [Answer.AI: Thoughts On A Month With Devin](https://www.answer.ai/posts/2025-01-08-devin.html)（20 任务 3 成功；自主性成为负债）
- [Brandur: Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) / [Kleppmann: Distributed Locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)（Effect Ledger 与 fencing 蓝本）
- [Armin Ronacher: Absurd Workflows](https://lucumr.pocoo.org/2025/11/3/absurd-workflows/) / [Temporal Activities（at-least-once）](https://docs.temporal.io/activities)（build vs buy 边界）

## Context 与长任务

- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Lost in the Middle, TACL 2024](https://aclanthology.org/2024.tacl-1.9/)
- [LongMemEval, ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html)

## Provenance、恢复与副作用

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/)
- [SLSA Provenance](https://slsa.dev/spec/v1.2/provenance)
- [Temporal Workflow Execution](https://docs.temporal.io/workflow-execution)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)

## 多 Agent、验证与安全

- [Anthropic: How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [AgentLens](https://www.microsoft.com/en-us/research/publication/agentlens-revealing-the-lucky-pass-problem-in-swe-agent-evaluation/)
- [SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/)
- [AgentDojo, NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/hash/97091a5177d8dc64b1da8bf3e1f6fb54-Abstract-Datasets_and_Benchmarks_Track.html)
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

## 参考实现

- [stablyai/orca](https://github.com/stablyai/orca) — Issue 驱动 Agent 编排与适配边界参考，不作为本设计的完整信任模型。
- [本地 Multica 研究副本](../../../../research/multica/README.zh-CN.md) — Durable Task、Runtime、续接和 GC 参考；其 `completed` 不作为 Assessment 或交付证明。

## Multica 学习心得（2026-07-19）

### 判断

Multica 不是多 Agent 自主产品工厂，而是“AI 原生 Issue Manager + Agent 执行控制面”。它擅长把人、Issue、评论和定时事件归一成可恢复的 Agent Task，但没有证明 Agent 的结果正确，也没有完成从 Candidate 到可信 Product 的闭环。

因此，我们应学习它的运行机制，不照搬它把 Agent 当作固定团队成员的产品模型。

### 核心模型

```text
Trigger → Issue（长期工作意图）→ Task（一次执行）
                                   ↓
                         Runtime / Daemon → Coding CLI
```

- Issue 与 Task 分离：一个目标可以产生多次运行，失败和重试不会改写目标本身。
- Agent 是身份、指令、技能、Provider、Runtime 和权限的组合，不等于模型。
- Project Resource 保存类型化资源指针；启动上下文以短 briefing 和按需读取为主，而不是复制全部资料。
- Runtime 以数据库中的 Task 记录为事实源，用原子 claim、lease、heartbeat 和新 attempt 恢复失败；WebSocket 只负责唤醒。
- 执行连续性拆成 `session_id + work_dir + source_task`；retry 精确续接一次运行，普通 rerun 可以从新环境开始。
- 文件产物按可再生缓存、终态工作目录、孤儿目录和会话存储分层回收。

相关实现入口：[产品概念](../../../../research/multica/docs/product-overview.md)、[Task 语义](../../../../research/multica/apps/docs/content/docs/tasks.zh.mdx)、[Project Resource](../../../../research/multica/apps/docs/content/docs/project-resources.zh.mdx)、[Runtime GC](../../../../research/multica/server/internal/daemon/config.go)。

### 最值得吸收的设计

1. `Goal/Issue != Task != Run`，长期意图与执行尝试严格分层。
2. 外部入口只产生标准事件，不为飞书、Webhook、Chat 各建执行链。
3. Context 使用精确引用、少量必要摘要和按需检索，不传 Agent 聊天总结。
4. 区分“计划提供的输入”和“本轮实际送达的输入”。Multica 的 `delivered_comment_ids` 是很好的起点，但还不能证明 Agent 正确理解了输入。
5. retry、rerun、fork 必须记录确切来源，不能按“最近一次会话”模糊续接。
6. 通知不是事实，完整 transcript 也不是 checkpoint；可恢复状态必须进入持久 Task/Run 记录。

我们需要在第 4 点上继续补齐：

```text
required → materialized → delivered → access_observed

Source observation → Evidence → Assessment → verified/refuted Claim
```

这条链可以作为现有 `Task.Coverage` 和 `Evidence` 的字段语义，不需要增加新系统。

### 明确不照搬

- 不采用固定“产品经理、架构师、开发、Reviewer”组织；它们只是按需调用的能力。
- 不采用 Squad 队长通过评论 `@Agent` 派活的自然语言路由；这会放大评论、唤醒和循环。
- 不把 provider session 当作权威记忆；它只能是加速手段，错误假设可能随会话继承。
- 不接受 Agent 自己更新 `done` 作为完成证明；正式完成仍由 Evidence、Assessment、Delivery Mode 和必要的 Release 决定。
- 不只清理工作目录；Task 消息、评论、Activity、附件等语义产物同样需要保留预算和晋升规则。
- 不允许重试直接重复 Git、飞书或部署副作用；外部写操作仍需统一 Effect Ledger、幂等键和回执。

### 对当前四组件的影响

| 组件 | 从 Multica 吸收什么 |
|---|---|
| Goal Gateway | 标准 Trigger、稳定外部引用和幂等接入 |
| State Core | 类型化 Resource Ref、输入送达记录和按需 Context View |
| Agent Runtime | Durable Task Ledger、claim/lease、精确续接、失败恢复和分层 GC |
| Assurance & Delivery | 不从 Multica 继承；继续由 Candidate、Evidence、Assessment、Release 和 Effect Ledger 保证产品可信 |

### Multica 采用决策（2026-07-19）

**状态：接受。** 不在“全量采用 Multica”和“全部从零自研”之间二选一；自建小型可信核心，并允许 Multica 通过版本化 `RunnerPort` 作为可替换执行侧车。不要深度 Fork Multica，也不要让它的数据库成为第二事实源。

| 采用 | 包装后采用 | 必须自建 | 明确不用 |
|---|---|---|---|
| Provider adapter、daemon、原子 claim、重试恢复、session/workdir、本地 Scratch GC | 一次 Multica Task 映射一次 Factory Run；返回结果先封存为 Candidate | Goal Revision、Task Graph/Run fencing、Baseline/Context Manifest、Assessment、Capability/Effect、Product/Release、语义 GC、飞书表格/任务适配器 | Agent 自报完成、Squad/评论路由、完整 Issue 历史作 Context、`local_directory`、Agent 直接写 Git/飞书/部署系统 |

边界固定为：

```text
飞书或自有 API → Factory Core（唯一事实源）
                         │ signed Run Capsule / RunnerPort
                         ▼
                   Multica Sidecar
                         │
                   隔离 Agent Runner
                         │ Candidate + receipt
                         ▼
Factory Assurance → Assessment → Product Revision → Effect / Release
```

Multica 的 `completed` 只映射 `Run.SUCCEEDED`，不能映射 `Assessment.PASS`、`Product Revision` 或 `DELIVERED`。Multica Task ID 只保存为外部执行引用；所有返回结果必须校验 `factory_run_id / task_revision / fencing_token / baseline_digest / context_digest` 后才能登记。

M0/M1 可用受限、容器化的 Multica sidecar 验证 claim、取消、重试和 Resume。若无法阻止外部写旁路、拒绝迟到结果、精确封存 Candidate，或整套 Multica 的运维成本高于 Runner 价值，则只替换 Runner，不改变 Factory Core。面向第三方托管或商业产品嵌入前，必须根据当前 [Multica LICENSE](../../../../research/multica/LICENSE) 取得适用授权或改用自研轻量 Runner。

最终原则：**Multica 能缩短“Agent 如何可靠运行”的建设时间，不能替代“结果为何可信、何时允许交付”的系统核心。**
