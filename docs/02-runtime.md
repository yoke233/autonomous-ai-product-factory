# Issue DAG、Agent Run 与通知

术语和不变量以 [CONTEXT.md](../CONTEXT.md) 为准。

## 1. DAG 的节点是 Issue

任务图由 Provider 中的 Issue 组成：

```text
Sub-issue A ──→ Sub-issue B ──→ Sub-issue C
      │               │               │
      └───────────────┴───────────────┴──→ Parent

显式依赖：A → B → C
隐式完成边：每个 Sub-issue → Parent
```

Parent / Sub-issue 表达分解，Dependency 表达顺序。Factory 从 Provider 读取并管理这些关系，不在 Run 内复制一套 Workflow、Job 或 Task Graph。

Factory 内部统一使用 `prerequisite → blocked issue` 的边方向：

- Provider 的 “B blocked by A” 映射为 `A → B`；
- 每个 Sub-issue 向 Parent 派生一条隐式完成边；
- Issue 只有在全部入边都已满足时才可能就绪；
- 只有前置 Issue 以 `completed` 关闭才满足边，`not planned` 不满足。

新增关系前必须验证整个相关图仍然无环。图发生变化后重新计算哪些 Issue 已就绪，但不改写已经发生的 Run、Commit、Review 或 Merge。

## 2. Issue 调度

调度器只接手满足以下条件的 Issue：

- Issue 为 `open`；
- 所有 Sub-issues 均以 `completed` 关闭；没有 Sub-issues 时自然满足；
- 所有 `blocked by` Issue 均以 `completed` 关闭；
- Issue 没有有效的进行中 Run；
- 用户允许 Agent 接手该 Issue。

同级 Sub-issues 默认可以并行。需要先后顺序时添加 Dependency，不能依赖列表顺序。一个前置 Issue 完成后，Factory 重新计算直接下游；刚解除阻塞的 Issue 进入可调度状态并发送通知。

Agent 可以把过大的 Issue 拆成 Sub-issues 并建立 Dependencies。完成拆分的 Run 只说明规划动作结束，父 Issue 仍保持打开，之后由调度器接手已就绪的子 Issue。

## 3. Run 是接手一个 Issue 的一轮执行

每次启动、重试或处理 `Request changes` 都创建一个新 Run。Run 至少记录：

```text
Provider / repository / issue / 可选的目标 pull request
触发者和触发原因
提供给 Agent 的 Issue、评论与 Review 输入摘要
启动时的父子关系与 Dependencies 摘要
base SHA；如果已有目标 PR，则记录其 ID 与 head SHA
开始、结束、等待、取消和失败信息
ACP 协议版本、session ID 与按接收顺序保存的 JSON-RPC 事件
耗时与成本
新建的 Sub-issues / Dependencies
最终推送的 commit SHA（如果产生）
```

ACP 是 Run 内部的执行协议，不是新的领域模型。Factory 保存原始事件，并由它们投影用户看到的聊天记录：

- `session/new` 的请求与响应建立会话；session ID 来自 Agent 的响应，不能由 Client 自行宣称；
- `session/prompt` 是本轮交给 Agent 的用户消息；
- `session/update` 中的 `agent_message_chunk`、`agent_thought_chunk`、`plan`、`tool_call`、`tool_call_update` 和 `usage_update` 形成实时执行过程；
- `session/request_permission` 形成需要用户处理的权限卡片；
- `session/prompt` 的响应以 `stopReason` 结束当前 prompt turn。

JSON-RPC 响应必须按 request ID 的类型和值与原请求关联，数字 `1` 和字符串 `"1"` 是不同身份，不能根据响应字段猜测类型。相同 `messageId` 的消息分片在聊天展示时可以合并，但原始 JSON 事件保持接收顺序，不被覆盖；事件流和 JSON 检查器直接逐条显示原始事件。工具调用以 `toolCallId` 关联创建和后续更新；`tool_call_update.content` 按 ACP v1 语义替换当前内容集合。聊天列表、命令结果、diff 和计划清单都从 ACP 事件生成，不再单独维护一组手写的 Run steps。

Run 可以处于 `queued`、`in_progress`、`waiting` 或 `completed`。`waiting` 只用于等待继续当前 Run 所必需的用户输入或权限；等待 Review 是 PR 状态。完成结论区分 `success`、`failure`、`cancelled` 和 `timed_out`。

一轮执行的最短路径：

1. 重新读取并验证 Issue 当前仍可调度；
2. 记录本次校验所基于的 Provider 更新时间和 DAG 摘要，然后原子地声明接手；
3. 再次读取 Issue 和关系图；若版本或 DAG 摘要变化，释放接手并重新排队；
4. 读取 Repository 和目标 PR；
5. 通过 `session/new` 创建或恢复 ACP session，通过 `session/prompt` 交给 Agent，并持续保存 `session/update` 与权限请求；
6. Agent 选择拆分 Issue 或在隔离 worktree 中实现；
7. 拆分时通过 Provider 创建 Sub-issues / Dependencies；实现时创建或更新 PR；
8. 有具体 Commit 且检查确实针对它运行时，才发布 Check；
9. 保存 ACP stop reason、Run 结论和 Notification，再释放 Issue 的执行占用；
10. 重新计算受影响的上游 Parent 和下游 Dependencies。

## 4. 并发、取消与恢复

- 同一 Issue 同时只有一个有效 Run；
- Provider 重复事件使用稳定事件 ID 去重，GitHub Adapter 使用 delivery ID；
- 推送前校验目标 PR head SHA，旧 Run 不能覆盖新 Commit；
- Agent、构建和测试分别设置超时，并在结束时清理完整进程树和 worktree；
- 服务重启后，未结束 Run 必须能恢复或明确失败；
- 没有 Commit 的失败、取消、超时、拆分或无变更 Run 不向旧 Commit 发布 Check；
- 取消 Run 只停止这一轮执行，不关闭 Issue，也不删除已创建的 Sub-issues。
- `session/cancel` 只是 Client 发出的取消通知；Run 继续接收 Agent 的最终 `session/update`，直到原 `session/prompt` 返回 `cancelled` 才结束，Client 不得伪造该响应。

Hatchet 可以负责 Run 的排队、超时、内部重试和 Worker 调度，但 Hatchet Task 只是实现记录，不能成为 Issue DAG 的节点。

## 5. 通知

内部 Run 状态变化与 Factory Notification 在同一事务中保存。对于 GitHub 等 Provider 中发生的变化，Factory 在同一事务中保存“已观察的 Provider 事件或状态快照”、推进消费位置并创建 Notification，之后异步投递。外部状态本身不可能参加本地事务。

| 事件 | 通知内容 |
|---|---|
| Issue 已就绪 | 前置依赖已经完成，可以接手 |
| Run 等待用户 | 所需输入、权限和继续入口 |
| Run 进入完成结论 | success、failure、cancelled 或 timed_out，附日志入口 |
| Run 拆分了 Issue | 新 Sub-issues、Dependencies 和当前可执行节点 |
| PR 等待 Review | PR、Commit 和 Checks |
| Review 要求修改 | 需要继续处理的意见 |
| Issue 以 `completed` 关闭 | Issue 完成、父 Issue 进度和新解除阻塞的下游 |
| Issue 以 `not planned` 关闭 | Issue 已终止，以及仍被阻塞的下游 |
| 已完成的 Issue 被重新打开 | 受影响的父 Issue、下游和正在执行的 Run |

每个通知使用“事件身份 + 接收者”形成唯一键，Factory 通知中心只展示一条。渠道发送失败保留并重试；GitHub 评论等外部渠道只尽力抑制重复，不能反过来定义 Issue 是否完成。

第一阶段通知 Run 发起人和 Issue 订阅者，并在相关 Issue 或 PR 时间线发布简短状态。Webhook 用于及时处理；定期对账所有 Factory 正在跟踪、但尚未确认最新终态事件的 Issue，以及近期关闭或重新打开的 Issue。对账游标在观察记录和 Notification 保存后才能推进，不能只扫描开放图。

## 6. 最小失败矩阵

| 场景 | 必须保持的结果 |
|---|---|
| 新关系形成依赖环 | 拒绝该关系，不破坏现有 DAG |
| 同一 Issue 被同时接手 | 至多一个 Run 获得执行权 |
| 前置 Issue 完成 | 只调度真正解除全部阻塞的下游 |
| 前置 Issue `not planned` | 下游继续阻塞并通知人 |
| 前置 Issue 被重新打开 | 阻止尚未开始的下游；已发生工作不回滚 |
| Parent 完成后 Sub-issue 被重新打开 | 标记不一致并通知，不自动重新打开 Parent |
| Run 只拆分 Issue、没有代码 | 正常结束并通知，不创建空 PR 或 Check |
| Run 失败但已创建部分 Sub-issues | 保留已创建事实，通知部分成功并重新计算图 |
| PR head 被其他 Run 更新 | 当前 Run 停止推送并重新读取 |
| Run 已结束但通知失败 | 保留通知并重试，不重新执行 Run |
| Webhook 丢失 | 定期对账恢复 Issue、PR 和通知状态 |

## 7. 实现顺序

1. GitHub Issue、Sub-issue 和 Dependency 的读取与无环校验；
2. 就绪 Issue 计算、单 Issue 接手和单 Run 执行；
3. PR、Review 与 `Request changes` 返工闭环；
4. Run、Issue 完成和解除阻塞通知；
5. 恢复、对账和 Hatchet 调度。

没有真实需求前，不实现 Run 内 DAG、跨 Provider 图同步、通用 Planner、多 Agent 组织或复杂 Worker affinity。
