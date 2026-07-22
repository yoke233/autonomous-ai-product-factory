# 自主 AI 产品工厂：设计总览

领域术语和不变量以 [CONTEXT.md](../CONTEXT.md) 为准。

## 1. 一句话

> Factory 接收 Issue，运行编码 Agent，并持续更新关联的 Pull Request，直到人完成审核。

Issue 和 PR 是系统自己的核心抽象，GitHub 是第一套 Provider。Factory 不是单纯的 GitHub 外挂，但第一阶段也不复制 GitHub 做第二套数据源。

## 2. 最小领域

只有三个拥有独立产品生命周期的核心对象：

| 对象 | 回答的问题 |
|---|---|
| Issue | 现在要解决什么？ |
| Pull Request | 当前提出了什么代码方案？ |
| Agent Run | Agent 这一轮做了什么？ |

Commit、Check、Review 和 Merge 是围绕 PR 发生的协作记录与操作，不再提升成另一套 Result、Judgment 或 Effect。

任务 DAG 由 Issue 构成：父 Issue 用 Sub-issues 拆分工作，Dependency 表达先后阻塞。边统一从前置 Issue 指向被阻塞 Issue，Sub-issue 到 Parent 是隐式完成边。Run 只是 Agent 接手一个已就绪 Issue 后的一轮执行，Run 内部不再建立第二套 Workflow 或 Job 图。

## 3. 系统边界

```text
                     ┌─ Issue 能力 ─┐
产品界面 / 用例层 ───┼─ PR 能力 ────┼─ Provider ── GitHub（第一阶段）
                     └─ 仓库能力 ───┘
          │
Issue DAG ── 调度器 ── Run 服务 ── ACP Client ── Agent / Worker
```

- Factory 定义 Issue、PR 和 Run 的统一含义与用例；
- Provider 负责实际读写 Repository、Issue、PR、Check 和 Review；
- GitHub Adapter 是第一套 Provider 实现；
- Run 的 ACP session、原始 JSON-RPC 事件、耗时、成本和停止原因由 Factory 保存；
- Issue 父子关系、依赖、调度进度和完成通知由 Factory 通过 Provider 管理；
- 第一阶段 Issue 和 PR 的正文、评论与状态仍由 GitHub 承载，本地缓存没有独立裁决权。

抽象的目的，是让核心执行闭环不直接写死 GitHub API，而不是提前建设多平台同步框架。

## 4. 最小闭环

```text
Issue
  → 启动 Agent Run
  → 创建或更新同一个 PR
  → Checks + 人的 Review
      ├─ Request changes → 新 Run → 新 Commit → 重新检查和审核
      ├─ Approve         → 人执行 Merge
      └─ Comment         → 继续讨论，必要时再启动 Run
  → 关闭或保持 Issue
```

Issue 没有版本。PR 也不是每次返工都重建；新的 Run 在同一个 PR 上增加 Commit。Check 必须对应具体 Commit，Review 是否因新提交失效由 Provider 的仓库规则决定。

Issue DAG 的闭环是：

```text
父 Issue
  → 拆分 Sub-issues，并设置 blocked by / blocking
  → 调度没有未完成前置依赖的 Issue
  → Agent Run → PR → Review → Merge → Issue completed
  → 解除下游 Issue 的阻塞并通知
  → 所有 Sub-issues 均以 completed 结束后，父 Issue 可以完成
```

## 5. 第一阶段产品

1. GitHub Adapter 读取 Issue、Sub-issues 和 Dependencies；
2. Factory 计算已就绪 Issue；用户显式启动，或按用户预先允许的策略自动启动 Run；
3. GitHub Adapter 把 Issue、Repository 和关联 PR 提供给 Run；Run 服务先通过 ACP `session/new` 获得 Agent 创建的 session ID，再发送 `session/prompt`；
4. Factory 按顺序保存 Agent 发回的 `session/update`、权限请求和 prompt response，并投影成聊天记录；
5. Agent 可以在授权范围内继续拆分 Sub-issues、补充 Dependencies，或直接修改代码；
6. Agent 在隔离 worktree 中修改代码并执行本地验证；
7. Factory 通过 Provider 创建 PR，或向已有 PR 推送 Commit；
8. Factory 通过 Provider 发布运行摘要和 Check，并保存“PR 等待 Review”或本轮结论通知；
9. 用户在 GitHub Review；
10. `Request changes` 后继续启动 Run，`Approve` 后由用户 Merge；
11. Provider 确认 Issue 以 `completed` 关闭后，Factory 通知完成并重新计算下游 Issue。

产品界面可以管理 Issue 和 PR，但它调用统一用例，不直接调用 GitHub API。第一阶段显示的数据来自 GitHub，Run 数据来自 Factory。

## 6. 明确不做

- 不建立 Mandate、Work、Result、Judgment、Effect 等平行领域对象；
- 不创建 Issue revision、任务版本或需求版本状态机；
- 不在第一阶段建设跨 Provider 双向同步或冲突合并；
- 不在 Run 内建立 Workflow/Job DAG；任务分解统一使用 Issue、Sub-issue 和 Dependency；
- 不建设通用 Planner 平台、多 Agent 组织或 Agent 市场；
- 不建设 CI/CD、部署、发布、制品或回滚系统；
- 不因为未来可能接入 GitLab 就提前实现最低公分母式通用平台。

## 7. 文档导航

| 问题 | 文档 |
|---|---|
| Issue、PR、Commit、Check 与 Review 的语义 | [01-context-and-trust.md](01-context-and-trust.md) |
| Issue DAG、Agent Run、通知与恢复 | [02-runtime.md](02-runtime.md) |
| Commit、日志和运行输出保存在哪里 | [03-artifacts.md](03-artifacts.md) |
| Provider 边界与 GitHub Adapter | [04-integrations.md](04-integrations.md) |
| 参考资料 | [REFERENCES.md](REFERENCES.md) |
