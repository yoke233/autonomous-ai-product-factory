# Result、Artifact Ref 与保留策略

术语和不变量以 [CONTEXT.md](../CONTEXT.md) 为准。

## 1. Result 是内容记录，不是裁决

Result 保存 Work、Effect 或外部观察实际带回的不可变内容。它至少需要能够回答：

- 谁在什么 Attempt 或外部来源中产生了它；
- 它归属哪份精确 Mandate revision、Work 或 Effect；
- 可判定的内容是什么；
- 支持材料在哪里，摘要是什么；
- 它与前序 Results 有什么来源关系。

Result 可以承载代码、方案、测试报告、日志摘要、断言或外部回执，但不拥有 `accepted`、`rejected`、`stale` 或 `delivered` 状态。同一个 Result 可以成为某项 Work 的候选、某次 Judgment 的对象或支持材料；这些关系不会产生新的核心对象。

Result 的可采性、充分性和意义由 [Judgment](01-context-and-trust.md) 给出。

## 2. Artifact Ref 是稳定材料引用

patch、提交、制品、完整日志和报告等大体积材料通过 Artifact Ref 引用。引用必须包含足以固定内容的信息，例如：

```text
kind
immutable locator
content digest
size / media type        可选
producer / created_at
```

可变 branch、无摘要 URL 或“最新构建”不能单独作为 Artifact Ref。材料本身没有裁决权；同一材料可以支持多个 Results 和 Judgments。

初始实现可以使用 Git commit、数据库和本地文件目录承载材料。只有真实大小、权限或生命周期超过这些载体时，才增加对象存储或独立材料服务。

## 3. 保留层级

### 长期保留

- Mandate revisions 及其精确引用；
- Work、Attempt、Result、Judgment 和 Effect 的最小不可变记录；
- 被 Judgment 采用且为解释历史结论所必需的 Artifact Refs、摘要和材料；
- Effect 回执、回读观察和交付确认所依赖的材料。

### 按策略限期保留

- 未被 Judgment 采用的候选材料；
- 可由稳定源码和命令重新生成的详细构建输出；
- Agent 原始输出、冗长日志和临时工具结果；
- 为排错额外保存的上下文。

TTL 到期只能释放允许丢弃的材料，不能改写 Result 或 Judgment，也不能让仍需审计的结论失去必要依据。若材料被删除，稳定摘要和删除策略记录仍应保留。

### Attempt 结束后清理

- worktree 和临时分支；
- Agent、shell 及其子进程；
- 临时输入文件；
- 可重新生成的构建目录。

清理失败应可观察并重试，但不为此建设通用语义 GC、多层归档或向量索引。清理属于运行恢复，详见 [02-runtime.md](02-runtime.md)。

## 4. 外部系统的材料

CI/CD 和部署平台自行保存其制品与运行细节。Factory 只在需要判断时接收稳定引用、摘要、回执或观察 Result，不复制专业系统的制品仓库。边界见 [04-integrations.md](04-integrations.md)。
