# Issue、Pull Request 与 Review

术语和不变量以 [CONTEXT.md](../CONTEXT.md) 为准。

## 1. Issue 是持续存在的一件事

Issue 是用户与系统共同工作的入口。标题、正文和评论可以随着澄清持续变化，但身份不变：

- 编辑正文不会创建任务版本；
- `Request changes` 不会创建新 Issue；
- 执行失败不会创建新 Issue；
- Issue 关闭后仍可重新打开；
- 超出当前范围的新需求才创建另一个 Issue。

Factory 在 Run 启动时记录实际提供给 Agent 的输入快照摘要，包括 Issue 标题、正文、选用的评论以及触发返工的 Review 或讨论。评论和 Review 使用稳定 ID、更新时间和内容摘要固定。提交结果前再次读取这些输入；发生变化时提示用户。这份快照只解释一次 Run 看到了什么，不是 Issue revision。

## 2. 一个 Issue 通常对应一个 PR

Agent 第一次产生可提交的代码时创建 PR。后续修复检查失败或处理 Review 意见时，新的 Run 继续向同一个 PR 推送 Commit。

Factory 显式保存 Issue 与当前目标 PR 的关联。后续 Run 使用这条关联，而不是搜索“最新 PR”或猜测哪个 PR 属于当前方案。只有下面情况才另建 PR：

- 用户明确要求比较彼此独立的方案；
- 原 PR 已关闭且决定不再继续；
- 新工作已经超出原 Issue 的范围并建立了新 Issue。

PR 是持续变化的提案，Commit 才是不可变的代码快照。因此任何检查或审核代码是否合格的记录，都必须能够定位到具体 commit SHA。

## 3. Sub-issue 与 Dependency 组成 DAG

一个较大的 Issue 可以拆分为 Sub-issues。每个 Sub-issue 都是普通 Issue：拥有自己的描述、讨论、Run、PR 和完成通知。

两种关系不能混用：

- Parent / Sub-issue 表达“这件大事由哪些小事组成”；
- `blocked by` / `blocking` 表达“哪件事必须先完成”。

Sub-issues 之间没有天然顺序，需要顺序时必须显式添加 Dependency。Factory 内部统一把边表示为“前置 Issue → 被阻塞 Issue”；Provider 的 “B blocked by A” 映射为 `A → B`。每个 Sub-issue 到 Parent 还派生一条隐式完成边。显式边与隐式边的并集必须保持无环。

父 Issue 只有在每个 Sub-issue 都以 `completed` 关闭后才满足完成门槛。以 `not planned` 关闭的 Sub-issue 仍不满足父级完成边；用户需要调整父子关系，或显式终止父 Issue。

Agent 可以在一次 Run 中提出或创建 Sub-issues 和 Dependencies，但必须受到原 Issue 范围、数量上限和用户授予权限的约束。每次新增关系前检查环；出现环时拒绝该关系，不创建隐藏的调度例外。

一个 Issue 可被调度，当且仅当：

- Issue 仍为 `open`；
- 所有 Sub-issues 均以 `completed` 关闭；没有 Sub-issues 时自然满足；
- 所有 `blocked by` Issue 都以 `completed` 关闭；
- 没有另一个有效 Run 正在接手它。

以 `not planned` 关闭的前置 Issue 不算完成；其下游保持阻塞并通知人处理依赖。

## 4. Check 说明机器观察到了什么

Factory 可以运行仓库规定的本地测试，并通过 Provider 发布 Check。仓库已有的 CI 继续由原系统运行，Factory 不接管或复制它。

- Check 对应具体 commit SHA；
- 新 Commit 需要新的 Check；
- 失败、超时和取消分别报告；
- 基础设施故障不能伪装成代码测试失败；
- Check 成功不等于人已经批准 PR。

哪些 Check 是 Merge 前的必需条件，由 Provider 中的仓库规则决定。

## 5. Review 由人完成

Factory 使用三种统一 Review 结果；GitHub Adapter 直接映射 GitHub 的同名语义：

| Review | 含义 |
|---|---|
| `Comment` | 提供意见，不批准也不要求返工 |
| `Approve` | 同意合并当前 PR 变更 |
| `Request changes` | 当前变更需要继续修改 |

收到 `Request changes` 后，Issue 和 PR 保持不变，Factory 启动新的 Run，在同一 PR 上增加 Commit，然后重新请求 Review。

新 Commit 是否撤销旧批准、是否要求最近一次推送获得批准以及需要多少批准，服从 Provider 中的仓库规则。Factory 可以读取并展示当前合并条件，但不维护独立的 `approved`、`rejected` 或 `stale review` 真相。

Agent 可以总结 Review、定位问题和修改代码，但不能提交代表人的 `Approve`，也不能绕过仓库规则执行 Merge。

## 6. Provider 抽象的范围

应用层需要统一表达以下能力：

- 读取、创建、编辑、评论、关闭和重新打开 Issue；
- 读取和修改 Parent、Sub-issues、`blocked by` 与 `blocking`；
- 读取 Factory 已选定的 PR，并在恢复时列出 Provider 中与 Issue 关联的 PR；
- 创建和更新 PR，读取其 Commit、Check 与 Review；
- 发布 Agent 自己的 Check；
- 请求 Review，并读取 PR 当前是否满足 Merge 条件。

统一的是 Factory 当前真正需要的行为，不是所有平台 API 的并集。GitHub 特有但闭环不需要的字段不进入核心模型；需要显示时可以作为 Provider 附加信息透传。

第一阶段 GitHub 是 Issue 和 PR 的承载后端。Provider 必须返回 Issue 的 `open/closed` 状态和关闭原因 `completed/not_planned`；关闭原因未知时按未满足依赖处理并对账。Factory 保存 Issue 与目标 PR 的明确关联、外部标识和短期缓存，但每次产生外部写入前都通过 Provider 读取当前状态，避免本地副本与 GitHub 争夺权威。恢复时若发现多个候选 PR 且没有已选关联，必须由用户选择。

## 7. 完成不是一个状态

- Run 完成：这一轮 Agent 已经停止；
- Check 成功：某个 Commit 的自动检查通过；
- Review 批准：人同意当前 PR；
- PR 已合并：代码已经进入目标分支；
- Issue 已关闭：这件事不再打开。

Issue 只有以 `completed` 原因关闭才会满足 Dependency；`not planned` 是终止而不是完成。

Factory 不新增一个总括性的 `SUCCESS`，而是分别展示这些事实。

## 8. 最小反例

| 场景 | 正确处理 |
|---|---|
| Issue、所选评论或 Review 在 Run 中途变化 | 保留 Run，比较输入快照并提示变化；不创建 Issue 版本 |
| Check 通过后又推送 Commit | 旧 Check 仍属于旧 SHA，新 SHA 重新检查 |
| Review 要求修改 | 同一 Issue、同一 PR，新 Run 和新 Commit |
| Review 批准后又推送 Commit | 是否仍可 Merge 由 Provider 的仓库规则决定 |
| PR 合并但 Issue 未关闭 | 以 Provider 当前状态为准，不由 Factory 推断关闭 |
| Provider API 暂时不可用 | 保留 Run 状态并重试读取，不用本地缓存冒充最新事实 |
| 新增 Dependency 会形成环 | 拒绝新增关系，保留原 DAG |
| 前置 Issue 以 `not planned` 关闭 | 下游继续阻塞并通知人，不自动当作完成 |
| 已完成的前置 Issue 被重新打开 | 停止调度尚未开始的下游 Issue；对已经运行或合并的工作只通知，不改写历史 |
| Parent 已完成后 Sub-issue 被重新打开 | 不自动改写 Parent；标记关系不一致并通知人处理 |
