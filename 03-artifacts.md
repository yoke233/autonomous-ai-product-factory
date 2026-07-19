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

所有生成物先进入 request、goal 或 branch 级临时空间。Agent 自己声称“以后有用”不构成保留理由。

## 3. 四层生命周期

| 层 | 内容 | 默认行为 |
|---|---|---|
| Scratch | 对话、草稿、工具输出、中间候选 | 短 TTL，不进入共享检索 |
| Active | 被活跃 Task、checkpoint 或验证直接引用 | 有租约；按 branch 隔离 |
| Canonical | 当前 Goal、Product、必要 Evidence 和回滚点 | 版本化保留 |
| Cold | 最小审计、严重失败复现和外部 Effect 回执 | 默认不进入 Agent Context |

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

- 最终 Candidate Delta 或已发布 Product；
- 直接支持 Gate 的 Evidence；
- 最小可复现反例；
- 尚未确认的 Effect 和回执；
- 一条结构化失败类别，前提是它能防止未来重复探索。

删除：

- Agent 对话和推理草稿；
- 重复源码副本；
- 被淘汰候选的普通中间版本；
- 可重新运行得到的大型日志；
- summary-of-summary；
- 没有消费者的 checkpoint。

失败总结也是 AI 输出，默认仍是 Candidate。只有可复现、去重且真的被后续规则消费，才进入 Cold 或 Canonical。

## 5. GC 与 provenance

GC Roots 只有：

- 当前 Goal 和 Product；
- 活跃 Task、Run 和安全 checkpoint；
- Gate 必需 Evidence 和回滚点；
- 未完成 Effect；
- 安全或合规明确要求的记录。

只沿“运行或证明所必需”的强引用保留 payload。`generated-by` 等 provenance 默认是弱引用，只留 ID、digest 和最小元数据；否则一个 Product 会反向保留所有 Run、对话和工具输出，使 GC 失效。

删除 payload 后可以保留 tombstone，说明对象 ID、摘要和删除原因，不保留大内容。

## 6. 索引规则

- 全局索引只放当前 Canonical 和经过验证的复用模式；
- Active Candidate 只在自己的 branch namespace 中检索；
- Cold 默认不可检索；
- 向量命中只是发现线索，必须再按版本、scope、状态和权限过滤；
- 索引未追平当前 revision 时，Context Compiler 回退权威状态库，不能静默漏数据。

## 7. 每个 Goal 的硬预算

- 最大并行 branch 数；
- Scratch、Active 和索引的大小；
- checkpoint 数量和密度；
- 候选 TTL；
- 中间字节相对正式 Delta 的放大倍数；
- 无消费者持久对象比例；
- stale 检索率和分支清理延迟。

预算耗尽时先停止低价值分支、压缩或删除中间产物；不能通过减少正式验证来腾预算。

## 8. 文档也适用

设计稿、审查意见和研究摘要同样是产物。活跃文档有固定数量预算；新观点优先替换旧表述，而不是追加一个文件。被否定的模型若没有运行、审计或复用价值，直接删除，不为“也许以后有用”长期归档。

