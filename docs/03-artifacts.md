# 中间产物预算与生命周期

## 1. 根问题

Agent 生成几乎没有摩擦。如果每次思考、搜索、总结、候选和 trace 都永久保存并进入检索，系统会形成：

```text
产物增加 → 索引变脏 → 上下文膨胀
         → 重复搜索和验证 → 产生更多产物
```

所以产物治理是正确性机制，不只是存储优化。

## 2. 唯一总原则

> Agent 有生成权，没有永久保存权。

所有由 Agent 生成且可重建的内容先进入 request、goal 或 branch 级临时空间。Effect Ledger、Evidence receipt、Inbox 去重和权威状态迁移按各自事务规则先持久化，不经过 Scratch。Agent 自己声称“以后有用”不构成保留理由。

## 3. 四层生命周期

| 层 | 内容 | 默认行为 |
|---|---|---|
| Scratch | Context View、对话、草稿、transcript、工具输出、临时日志和中间候选 | 短 TTL，不进入共享检索 |
| Active | 被活跃 Task、Run、checkpoint、Candidate、Assessment 或 Release 直接引用 | 有租约；按 branch/Goal 隔离 |
| Canonical | 当前 Goal/Product、适用 Assessment、必要 Evidence、当前 Release 和回滚点 | 版本化保留；按权限索引 |
| Cold | 最小审计、严重失败复现、历史 verdict 和必要 Effect 回执 | 默认不进入 Agent Context |

晋升必须同时满足：

```text
有一个系统确认的消费者
有明确目的和来源版本
内容不可由更小对象廉价重建，或重建风险不可接受
通过对应验证或审计策略
有失效条件和保留期限
```

## 4. 分支结束时保留什么

保留：

- Product Revision 的正式 Delta；Candidate Delta 只有被活跃修复/复现消费者引用时留在 Active，否则按短 TTL 回收；
- Assessment verdict 和直接支持它的必要 Evidence；
- 活跃 Release 的健康 Evidence、回滚点和环境引用；
- 最小可复现反例；
- 尚未确认的 Effect 和回执；
- 一条结构化失败类别，前提是它能防止未来重复探索。

删除：

- Agent 对话和推理草稿；
- 终态 Task 的完整消息、评论镜像、Activity 和逐工具 trace；
- 重复源码副本；
- 被淘汰候选的普通中间版本；
- 可重新运行得到的大型日志；
- summary-of-summary；
- 没有消费者的 checkpoint。

失败总结也是 AI 输出，默认只是未验证 Claim/Artifact。只有可复现、去重且经 Assessment、又确实被后续规则消费的 Claim，才进入 Cold；当前仍适用的复用规则才可进入 Canonical。

Intake 会话同样分层：未确认的 OPEN 会话按 Scratch/Active TTL 回收；确认 STARTED 后，Goal 草稿与固化文档快照随所编译 Goal 的审计期限保留（执行与审计依据），对话消息在短期复查窗口后回收，只留 tombstone。

## 5. Payload GC 与语义 GC

GC 分两层，不能因为数据仍在审计库就让它继续污染未来 Agent：

1. **语义 GC**：Goal 被替代、Candidate 被拒绝、Claim/Assessment stale 或 scope 不兼容时，立即退出共享索引、Context 编译和晋升路径；
2. **Payload GC**：按强引用和 TTL 删除文件、对象、数据库大字段、transcript、评论镜像和事件明细。

小型 Context Manifest 随 Run/Assessment 的审计期限保留。Task/Run/Assessment 的终态行、评论、Activity、附件和 stale Finding 不自动成为永久 GC root。

任何仍可 Resume/Retry/Replay 的 Task、Run 或 checkpoint 可能引用 Effect 时，其幂等键和最小回执不得 GC；保留窗口必须不短于最大恢复期。此后已确认 Effect 只保留到额外审计窗口，未确认或正在补偿的 Effect 始终保留。删除 payload 后可以保留 tombstone：

```text
object_id / kind / digest
revision / verdict_or_status
created_at / deleted_at / deletion_reason
```

## 6. GC Roots 与 provenance

GC Roots 只有：

- 当前 Goal 和 Product；
- 活跃 Task、Run、Candidate、Assessment、Release 和安全 checkpoint；
- 每个环境当前部署的 HEALTHY Release，以及 rollback policy 在窗口内仍引用的 Product Revision、Assessment 和必要 Evidence；
- 当前 PASS Assessment 必需 Evidence、受保护 Gate 实现引用和回滚点；
- 未完成 Effect；
- 安全或合规明确要求的记录。

只沿“运行或证明所必需”的强引用保留 payload。`generated-by` 等 provenance 默认是弱引用，只留 ID、digest 和最小元数据；否则一个 Product 会反向保留所有 Run、对话和工具输出，使 GC 失效。

## 7. 索引规则

- 全局索引只放当前 Canonical 和经过验证的复用模式；
- Active Candidate 只在自己的 branch namespace 中检索；
- Cold 默认不可检索；
- 受保护 Gate 的测试夹具、生成器、秘密反例和预期值永不进入 Agent 可见索引；
- 向量命中只是发现线索，必须再按版本、scope、状态和权限过滤；
- 索引未追平当前 revision 时，Context Compiler 回退权威状态库，不能静默漏数据。

## 8. 每个 Goal 的硬预算

- 最大并行 branch 数；
- Scratch、Active 和索引的大小；
- checkpoint 数量和密度；
- 候选 TTL；
- 中间字节相对正式 Delta 的放大倍数；
- 数据库 Task/Run/message/event 行数与写入速率；
- Canonical Claim/Finding/Assessment 数量和 Cold 元数据规模；
- 无消费者持久对象比例；
- stale 检索率和分支清理延迟。

预算耗尽时先停止低价值分支、压缩或删除中间产物；不能通过减少正式验证来腾预算。

大型 Evidence、Candidate 和日志 payload 放内容寻址存储；权威状态库只保存 digest、版本、scope、状态和引用。删除大内容不会破坏最小 lineage 和完整性标识，但会失去复现能力；当前 PASS Assessment 必需的 Evidence 在失效或审计策略允许前不得删除。

## 9. 文档也适用

设计稿、审查意见和研究摘要同样是产物。活跃文档有固定数量预算；新观点优先替换旧表述，而不是追加一个文件。被否定的模型若没有运行、审计或复用价值，直接删除，不为“也许以后有用”长期归档。
