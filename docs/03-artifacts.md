# Commit、日志与运行输出

术语和不变量以 [CONTEXT.md](../CONTEXT.md) 为准。

## 1. 输出放回已有对象

Factory 不建立通用 Result 或 Artifact 领域对象。不同输出回到最适合承载它的现有位置：

| 输出 | 保存位置 |
|---|---|
| 代码修改 | Git Commit / Pull Request |
| 代码 diff | Provider Pull Request；第一阶段为 GitHub Pull Request |
| Factory 发布的自动检查结论 | Provider Check；第一阶段只写 GitHub Check Run |
| 外部 CI 检查结论 | 通过 Provider 只读；GitHub 中可能是 Check Run 或 Commit Status |
| Review 意见 | Provider Review；GitHub 中为 Pull Request Review |
| Agent 消息、计划、工具调用和权限请求 | Run 的 ACP JSON-RPC 事件流 |
| Agent 最终摘要 | Run 记录，必要时附 Provider 评论链接 |
| Issue 父子关系与 Dependencies | Provider；Factory 只保存关联和必要快照 |
| 通知内容、接收者与渠道投递状态 | Factory 通知记录；必要时写入 Provider 时间线 |
| 已观察的 Provider 事件与对账游标 | Factory 事件记录，与对应 Notification 原子保存 |
| 完整执行日志 | Factory 日志存储，由 Run 链接 |
| 本地临时文件 | Run worktree，结束后清理 |

Provider 已经保存的代码、评论和 Review 不在 Factory 中复制一份可变副本。

## 2. 精确引用

Factory 引用 Provider 内容时至少保存稳定标识：

```text
provider id / repository id
issue id / number
pull request id / number（如果已经创建）
commit SHA（如果已经产生）
check run id / review id（需要时）
Provider URL（仅用于导航）
```

URL、branch 名称和“最新提交”都是可变引用，不能单独用于判断一次 Run 对应哪份代码。代码相关记录必须包含 commit SHA。

## 3. ACP transcript、日志与摘要

Run 页面以聊天列表为主，从按接收顺序保存的 ACP JSON-RPC 事件渲染：

- 用户输入显示为用户消息；
- `agent_message_chunk` 按 `messageId` 合并为 Agent 消息；
- `agent_thought_chunk` 使用可折叠的弱化样式，不能冒充最终回答；
- `plan` 显示为当前计划清单，后一次完整替换前一次计划投影；
- `tool_call` 与同 `toolCallId` 的 `tool_call_update` 合并为工具卡片，展示 pending、in_progress、completed 或 failed；
- tool content 中的 text、diff 和 terminal 分别用适合开发者的方式展示；
- `session/request_permission` 显示允许或拒绝选项，并按 JSON-RPC request ID 将用户响应合并回同一权限卡片；
- `usage_update` 和 prompt response 的 `stopReason` 显示为轻量会话状态。
- 图片、音频和资源等非文本 ContentBlock 至少显示类型与引用，不能被静默渲染为空消息。

聊天中的聚合卡片可以展开查看与它关联的原始 JSON；“事件流”和“JSON 检查器”必须直接按接收顺序逐条显示原始事件，不能用聚合卡片冒充协议时序。聊天投影不能反过来改写原始事件，也不额外保存另一套 steps 或 commands 数组。

页面旁边只需补充：

- 触发者、触发原因和关联 Issue/PR；
- 错误、取消或超时原因；
- 产生的 commit SHA；
- 耗时、资源和成本。
- Run 启动时的 Issue DAG 摘要和本轮创建的关系；
- 已发送或等待重试的通知。

Provider Check 保持简短，给出结论、必要注释和 Run 链接。完整原始日志留在 Factory，避免把 PR 时间线变成日志仓库。

## 4. 保留与清理

长期保留 Run 的最小审计信息、commit SHA、结论和必要日志。冗长 Agent 输出、详细命令输出和临时诊断材料可以按策略过期。

Run 结束后清理：

- worktree 和临时分支；
- Agent、shell 及其子进程；
- 临时输入文件；
- 可重新生成的构建目录。

Secret 不进入 Issue、PR、评论、Check 输出或持久化日志。日志中的凭证和敏感环境变量必须在写入前遮蔽。

CI/CD 制品和部署日志继续由对应专业系统保存，Factory 只链接到它们，不复制制品仓库。
