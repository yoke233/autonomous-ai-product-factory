# Provider 边界与 GitHub Adapter

术语和不变量以 [CONTEXT.md](../CONTEXT.md) 为准。

## 1. Provider 是能力边界

Factory 的用例只依赖 Provider 提供的 Repository、Issue 和 PR 能力，不直接调用 GitHub API。Provider 返回统一的核心字段，并保留稳定的外部标识用于后续读写。

这层抽象只有两个目的：

1. 让 Agent 闭环不散落 GitHub API、Webhook 和权限细节；
2. 允许未来在真实需求出现时增加另一套承载后端。

第一阶段只实现 GitHub Adapter。不建设插件市场、通用连接器配置、跨平台同步或动态字段映射。

## 2. 最小能力

Provider 只覆盖当前闭环需要的操作：

```text
Repository
  读取仓库、默认分支和精确 Commit
  为 Run 获取代码和推送 Agent 分支

Issue
  读取 / 创建 / 编辑
  评论 / 关闭 / 重新打开
  读取 / 修改 Parent 与 Sub-issues
  读取 / 修改 blocked by 与 blocking

Pull Request
  读取指定 PR；恢复时列出 Issue 关联的 PR
  创建 / 更新 / 评论
  读取 Commits / Checks / Reviews / mergeability
  发布 Agent Check / 请求 Review
```

Merge 保留为人的操作。接口可以读取 Merge 状态，但第一阶段不向 Agent 暴露执行 Merge 的能力。

Provider 返回的 Issue 和 PR 状态保持最小：

- Issue：`open`、`closed`，关闭时必须返回 `completed` 或 `not_planned`；未知关闭原因按未满足依赖处理并对账；
- PR：`open`、`merged`、`closed`；
- Review：`comment`、`approve`、`request_changes`。

平台特有字段只有在出现明确用例时才加入，不预先追求所有代码托管平台的最低公分母。

## 3. GitHub Adapter

GitHub Adapter 负责：

- 把 GitHub Repository、Issue、Pull Request、Commit、Check 和 Review 映射到统一模型；
- 把 GitHub Parent、Sub-issues 和 Issue Dependencies 映射到 Issue DAG；
- 把 GitHub Webhook 映射成 Factory 能理解的触发事件；
- 使用 GitHub delivery ID 去重；
- 使用 GitHub App installation token 执行最小权限操作；
- 在每次写入前读取 Issue、PR 和 head SHA 的最新状态；
- 把 GitHub API 的速率限制、权限拒绝和暂时故障转换成明确错误。
- 把 Run、PR 和 Issue 的通知投递到对应 GitHub 时间线。

第一阶段由 GitHub 承载 Issue、PR、评论、Review、关闭原因与 Merge 状态。Factory 数据库保存 Provider 关联标识、Issue 与当前目标 PR 的明确关联、必要缓存、已观察事件和 Run；缓存不能覆盖 GitHub 的新状态。

## 4. GitHub App 最小权限

- Metadata：读取仓库基本信息；
- Issues：管理 Issue 和评论；
- Contents：读取代码并向 Agent 分支推送 Commit；
- Pull requests：创建或更新 PR、请求 Review；
- Checks：发布 Factory 自己的 Agent Run Check。

不申请 Administration、Deployments、Environments、Actions 管理或仓库规则修改权限。安装令牌使用短期令牌，并且只注入当前 Run。

人的 Review 和 Merge 不委托给 Agent。若未来允许自动合并，必须作为独立产品能力明确设计和授权。

## 5. 事件与幂等

第一阶段只处理能推进闭环的事件：

- 用户在 Issue 上显式启动 Agent；
- PR Review 提交了 `Request changes`；
- PR head 更新、关闭或合并；
- 用户取消或重新运行 Agent Run。
- Issue 父子关系或 Dependencies 变化；
- Issue 关闭或重新打开。

具体触发方式可以是 GitHub App 按钮、命令评论或 Factory 界面，但最终都必须落到明确用户和唯一 Run。

- 首次创建 PR 后保存 Issue、方案与 PR 的稳定关联；后续 Run 按关联读取，不按标题或更新时间猜测；
- 恢复时如果找到多个候选 PR 且没有已保存关联，要求用户选定目标；
- 返工优先更新同一个 PR，不按 Run 创建新 PR；
- 推送前比较启动时和当前 head SHA，发生竞争时停止并重新读取；
- Agent 拆分前先持久化拆分计划；每个预期 Sub-issue 和 Dependency 使用跨 Run 不变的逻辑 operation ID，并逐项记录 `confirmed` 或 `unknown`；
- 其他外部写入使用由 Run ID 和动作生成的稳定 operation ID；分支名、PR/评论标记或 Check Run `external_id` 在平台允许时携带该 ID；
- 写入超时后使用 operation ID 和已知外部标识对账；无法可靠确认时保留结果未知，不盲目重复创建；
- PR 已关闭或合并后不再写入，除非用户显式开始新的方案。

通知评论与其他写入共用稳定 operation ID 和去重规则。GitHub 通知只是一个投递渠道；Factory 先把已观察的 GitHub 事实与 Notification 一起保存，再推进事件消费位置，因此 GitHub 暂时不可用不会丢失完成通知。GitHub 写入结果未知时先对账；无法确认时保留未知，不能承诺外部评论绝不重复。

Webhook 用于及时推进状态，定期对账用于修复漏投或长时间未处理的事件。对账覆盖所有 Factory 正在跟踪但尚未确认最新终态事件的 Issue、近期关闭或重新打开的 Issue、关联 PR 和未送达通知，不建设全仓库同步器。

## 6. CI/CD 与部署不属于 Factory

GitHub Actions 或其他 CI/CD 系统继续负责构建流水线、制品、部署、发布和回滚。Factory：

- 可以在 Agent worktree 中运行仓库已有的本地验证命令；
- 可以通过 Provider 读取已有 Check，帮助 Agent 修复问题；
- 不创建流水线、不托管制品、不部署环境、不对账发布状态；
- 不建立 Delivery 或 Effect 状态机。

如果未来需要 Agent 修改部署配置，它仍然通过 Commit 和 PR 提议变更，后续执行交给专业系统。
