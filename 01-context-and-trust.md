# 上下文与可信状态

## 1. 要解决的问题

新 Agent 启动时既不能从零扫描整个项目，也不能盲信上一个 Agent 的总结。正确做法是：

> 不继承 Agent 记忆；基于版本化项目状态，为当前 Task 编译一次性 Context View。

## 2. Baseline

每个 Task 固定一个 Baseline：

```text
goal_revision
source_revision       代码、依赖、配置、schema
dynamic_observations 配置中心、外部 API、运行环境的观察时间和有效期
product_revision
policy_and_capability_revision
```

系统同时保存 Source Manifest：哪些来源可枚举、实际访问了什么、哪些被 ignore、拒绝、截断或不可达。搜索结果不是项目全集；无法枚举的远端配置必须显式成为 Unknown。

## 3. Context Compiler

输入：

- Goal、Task 和 Baseline；
- 与 Task 直接相关的源码和配置引用；
- 已有 Evidence、失败反例和仍有效的结论；
- 当前 branch Delta；
- 必须完成的 Coverage；
- token、时间和权限预算。

输出：

```text
任务、停止条件和硬约束
最相关的直接来源
当前 Delta
已有 Evidence 及其范围
Unknown、冲突和覆盖缺口
被省略内容的类别与按需查询入口
```

Context View 可随时删除和重建。大段源码、日志和历史候选按需 Pull；Goal、硬约束、未知项和验证义务始终 Push。

## 4. 可信状态的最小规则

不建设一个试图描述整个世界的知识图谱。第一版只保存任务真正需要的结论记录：

```text
assertion
supporting_or_refuting_evidence
scope
baseline_revision
status              candidate / verified / refuted / stale
invalidation_rule
```

Evidence 至少包含来源、采集过程、输入/结果摘要、环境、时间和适用范围。同一 Evidence 可以支持或反驳多个结论，不复制原始 payload。

只有状态为 `verified`、scope 覆盖当前 Task、Baseline 仍兼容且没有阻塞冲突的结论，才能作为上下文中的可用事实。

## 5. 防止“漏看一段代码”

Coverage 由运行时自动采集，不由 Agent 自报：

- 可枚举的文件、符号、配置、接口和环境；
- 实际 read/search/test 的范围；
- 查询条件、输出截断和工具错误；
- 入口、调用关系、配置消费和运行路径；
- 每条验收条件对应的 Evidence。

负面结论必须写成“在快照 X、枚举器 Y 和规则 Z 的范围内未发现”，不能直接写“系统中不存在”。

Coverage 的长期记录只保留集合摘要、缺口和 Evidence 引用；逐次 read/search 事件短期保存，避免 Coverage 自己变成数据洪水。

## 6. Agent 交接与独立验证

交接只传：

```text
Goal + Baseline + Task
Artifact/Evidence refs
Branch Delta
Coverage gaps
Unknown / Finding
Required reverification
```

验证 Agent 首次只看原始目标、Baseline、候选产品和独立 Source 访问，先形成自己的 Finding，再读取 Producer 的解释做差异检查。这样降低锚定，但不假设 Reviewer 天然正确。

## 7. 失效

源码、配置、目标、策略或产品版本变化时，依赖它们的结论、Context View 和验证结果进入 stale。影响关系不完整时保守扩大重新检查范围，不能因为“依赖图没找到”就断言不受影响。

阻塞 Unknown 不会因为过期而自动消失；过期表示需要重新探索或停止发布。

