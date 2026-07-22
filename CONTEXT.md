# Autonomous AI Product Factory

系统接收 Issue，运行编码 Agent，并持续更新关联的 Pull Request，直到人完成审核。Issue 和 Pull Request 属于 Factory 的核心语言；GitHub 是第一套承载它们的 Provider。

## 核心语言

**Repository**：
代码及其协作记录所在的仓库，也是 Issue、Pull Request 和 Agent 权限的边界。
_Avoid_: Project、项目上下文注册表

**Issue**：
需要解决的一件事，具有稳定身份并可持续编辑、讨论、关闭和重新打开。编辑和返工不产生 Issue revision 或任务版本。
_Avoid_: Mandate、Task、开发任务、任务版本、需求修订

**Pull Request（PR）**：
针对 Issue 提出的代码变更及其审核载体。一次返工继续更新同一个 PR；只有确实存在另一套独立方案时才创建另一个 PR。
_Avoid_: Candidate、Result、代码结果、产品修订

**Agent Run（Run）**：
Factory 为一个 Issue 启动的一轮 Agent 执行，内部通过 ACP（Agent Client Protocol）会话驱动 Agent。PR 只能是它的可选目标或触发上下文。失败、人工重试或收到 `Request changes` 后创建新的 Run；Run 结束不等于 Issue 完成或 PR 可以合并。
_Avoid_: Work、Attempt、执行项、任务版本

**Sub-issue**：
由父 Issue 拆分出来、可独立讨论和执行的普通 Issue。父子关系表达工作分解，不产生 Issue 版本。
_Avoid_: Job、隐藏子任务、Issue revision

**Dependency**：
两个 Issue 之间明确的阻塞关系；统一方向为“前置 Issue → 被阻塞 Issue”。每个 Sub-issue 到 Parent 还形成一条隐式完成边；只有前置 Issue 以 `completed` 结束才满足边。
_Avoid_: 仅靠列表顺序、优先级或文字描述推断依赖

**Notification**：
系统针对需要关注的已发生事实保存并发送给相关人的消息。Notification 只传递 Run、PR 或 Issue 的真实状态，不自行建立“已完成”事实。
_Avoid_: 用评论或消息发送成功代替业务完成

## 协作记录

**Commit**：
PR 中一次不可变的代码快照。Check 和 Review 是否适用，以具体 commit SHA 和仓库规则为准。
_Avoid_: PR 最新版本、浮动代码基线

**Check**：
自动程序针对某个 Commit 报告的状态、结论和说明。Check 可以成为合并条件，但不能代替人的 Review。
_Avoid_: Evidence、Observation、Assessment

**Review**：
人对 PR 提交的 `Comment`、`Approve` 或 `Request changes`。`Request changes` 表示在同一 Issue 和 PR 上继续修改。
_Avoid_: Judgment、审核拒绝、裁决

**Merge**：
将 PR 的变更纳入目标分支。是否允许 Merge 由 Repository 的规则和人的权限决定。
_Avoid_: Delivery、交付裁决

## 集成语言

**Provider**：
为 Factory 提供 Repository、Issue、PR、Commit、Check 和 Review 能力的代码协作后端。GitHub 是第一套 Provider；Provider 不是另一套领域模型。
_Avoid_: 通用连接器平台、双向同步系统

**Agent**：
在隔离工作区读取 Issue 与 Repository、修改代码、运行本地验证并创建或更新 PR 的执行者。Agent 不能代表人批准 Review 或决定 Merge。
_Avoid_: 判定者、项目负责人

## 不变量

- Issue、PR 和 Run 是三个不同生命周期：Issue 描述问题，PR 承载方案，Run 表示一轮执行。
- Issue、Sub-issue 和 Dependency 共同形成任务 DAG；节点是 Issue，显式 Dependency 和“Sub-issue → Parent”隐式完成边构成有向边。
- 新增父子关系或 Dependency 必须对显式边与隐式边的并集检查环。
- Agent 只接手未完成且所有前置依赖均已完成的 Issue；Run 不再拥有第二套任务图。
- 一个 Issue 在澄清、返工、关闭和重新打开期间保持同一身份，不存在 Issue revision。
- 一次返工默认继续使用同一个 Issue 和同一个 PR，并由新的 Run 推送新的 Commit。
- Run 必须记录实际提供给 Agent 的输入摘要和 base SHA；如果启动时已有目标 PR，还要记录其稳定标识和 head SHA。首轮没有 PR 是合法情况，这些记录只是执行输入，不是新的领域版本。
- Run 持久化 ACP 协议版本、session ID 和按接收顺序保存的 JSON-RPC 事件；界面的聊天、工具调用、计划、权限请求和用量只是这组事件的投影，不另建一套“执行步骤”事实。
- Check 对应具体 Commit；新 Commit 不能继承旧 Commit 的 Check 结论。
- Review 的有效性和 Merge 条件由 Provider 中的仓库规则决定，Factory 不建立第二套审核状态。
- Factory 通过统一能力管理 Issue 和 PR，不让应用逻辑直接依赖 GitHub API。
- Factory 显式保存 Issue 与当前目标 PR 的关联；存在多个方案时由用户选定，不能靠“最新”或搜索结果猜测。
- 第一阶段由 GitHub 承载 Issue 和 PR；Factory 只持久化关联标识、必要缓存和自己拥有的 Run，不做双向事实同步。
- CI/CD、部署和发布继续由专业系统负责，不进入 Factory 的领域模型。
- Run 结束、PR 等待 Review、Issue 完成和下游 Issue 被解除阻塞是不同通知事件，不能用一个“任务完成”混合表达。
- 对 Provider 状态变化的本地观察记录和 Notification 必须一起保存；消费位置只能在二者保存后推进，渠道投递失败不能丢失通知。
