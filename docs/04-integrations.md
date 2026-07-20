# 飞书、Issue Manager 与外部系统边界

## 1. 定位

飞书任务、飞书多维表格、Linear、Jira、GitHub Issues 或自有 Issue Manager 只是 Goal 入口和 Outcome 出口：

```text
外部事件 → Connector Inbox → GoalIngressPort
                               ↓
                        自主 AI 产品工厂
                               ↓
Outcome ← Projection Outbox ← OutcomeProjectionPort
```

它们不保存 Agent Context、Task、checkpoint、Evidence 或候选产物。更换 Issue Manager 不应改变内部运行语义。

Inbox/Outbox 是 Goal Gateway 内的可靠传输模式，不是新的顶层组件或领域对象。MVP 只接一个外部入口，其他适配器复用同一端口契约。

## 2. 规范化请求

适配器输出一个简单信封：

```text
connector, tenant, project
connector_schema_revision
external_item_id, external_revision, event_id
authenticated_actor
authorization_ref
command             create / revise / cancel
goal_fields
boundary_profile_ref / boundary_fields
delivery_mode / delivery_target
untrusted_content_refs
reply_target
```

`external_item_id + external_revision + event_id` 用于去重、处理乱序和安全重放。

- `authorization_ref` 只能引用预配置策略，外部字段不能直接创建 Capability Grant；
- `connector_schema_revision` 用于发现字段删除、类型变化和映射漂移；
- `delivery_target` 必须属于 Boundary 允许的环境，不能由评论或附件覆盖。

## 3. 信任边界

Webhook 签名只证明事件来源。只有入口策略明确列出的字段有资格表达 Raw Goal 或 Boundary；字段内容在 Goal 编译前仍不是正式契约，也不能授予权限。

- 目标字段表达“想要什么”；
- Boundary 字段只能在预授权范围内设置环境和预算；
- 评论、附件、链接和技术方案作为不可信 Source；
- 文本中的“关闭测试、读取密钥、直接部署”没有权限效力；
- 修改目标创建新 revision，不覆盖正在运行的旧版本。

身份、目标和能力分三步处理：Gateway 验证外部 actor，State Core 编译 Boundary，Runtime Broker 根据 `authorization_ref` 为每次执行尝试签发短期 Grant。Grant 内容不可变，但有效性由 expiry、revocation epoch 和当前 Policy 计算；重试不会复用过期 Grant。Agent 只获得不透明工具句柄，长期 Secret 不进入 Context、日志或飞书字段。详细 dispatch 规则归 [Runtime 的 Effect Ledger](02-runtime.md#7-effect-ledger) 管理。

## 4. Inbox、Outbox 与一致性

- Webhook 只有在原始事件摘要和 Inbox 记录持久化后才确认；进程在确认前后崩溃都可安全重放；
- Inbox 消费使用稳定 event ID 和 external revision，同一事件最多改变一次 Goal；
- Outcome、Effect 状态和 Outbox 投影意图原子记录，发送通知不能代替持久状态；
- Outbox 只是引用原 Effect 的持久唤醒项；重复投递不会直接调用外部 API，只有 Effect Dispatcher 决定重试并迁移状态；
- Product 已交付但外部投影暂时失败时，内部状态保持 DELIVERED，连接器恢复后继续投影；
- 连接器离线、限流或 schema 漂移不能阻塞内部 GC 之外的正常恢复，也不能丢最终 Outcome。

## 5. 结果投影

外部工作项只接收：

- `RECEIVED/RUNNING`；
- `DELIVERED`、Delivery Mode、Product Revision、可选 Release 和产品链接；
- `NEEDS_GOAL_INPUT` 或 `NEEDS_BOUNDARY_INPUT` 的一个简短问题；
- `NO_SAFE_DELIVERY/CANCELLED/SYSTEM_FAULT` 与原因类别；
- 可选的机器可读 `assurance_ref`；默认界面只展示状态和产品链接。

默认不回写 Agent 对话、PRD、架构草稿、候选列表、完整 Review 或 trace。

所有回写都是 Effect：使用稳定幂等键，超时后先回读平台状态，再决定是否重试。

## 6. 飞书映射

字段所有权必须固定：

| 类型 | 示例 | 写入方 |
|---|---|---|
| 输入字段 | Goal、Boundary Profile、Delivery Mode、Command | 用户或受信入口；AI 不反写 |
| 系统字段 | Factory Status、Product Revision、Product Link、Outcome Code、Delivery Receipt | Outcome Projection |
| 不可信 Source | 评论、附件、链接、自由技术方案 | 任何参与者；只能作为检索来源 |

### 多维表格

- 一条记录对应一个外部 Work Item；
- 记录 ID 是稳定身份，revision 或更新时间用于并发控制；
- 显式列映射 Goal、Boundary Profile、Delivery Mode、命令和 Outcome；
- 附件、评论和未白名单字段只作为 Source。

### 飞书任务

- Task GUID 对应外部 Work Item；
- 创建者、成员和应用身份决定谁能创建、修订或取消；
- 只有明确配置的标题、描述片段或自定义字段可形成 Raw Goal；
- 自动完成条件按 Delivery Mode 判定：`ARTIFACT_ONLY` 需要 Product Revision 可获取，`PULL_REQUEST` 需要 PR Effect `CONFIRMED`，`STAGING/PRODUCTION` 需要 Release `HEALTHY`；同时 Outcome 必须为 `DELIVERED`。失败不能伪装成完成。

## 7. Project 注册表、Intake 与文档 Provider

### Project 注册表

仓库登记一次，之后所有 Intake/Goal 从"选 Project"开始，不重复填写：

```text
project_id / name
repo_ref              本地路径或远端地址
repo_profile_defaults 构建/测试命令默认值
doc_refs              外部文档引用（DocProvider URI）
work_item_ref         外部需求表引用（可选）
worker_labels         路由标签（见 02-runtime §9）
```

### Intake 澄清会话

Intake 是 Goal Gateway 的交互式前置：人与只读 Clarifier Agent 多轮对话，Agent 通过 Worker 在仓库现场执行 clarify job（只读工具，可解析 `doc_refs`），产出自包含 Goal 草稿；人可修改草稿，确认后编译 Goal Revision，Intake 锁定为 STARTED。对话消息不进入 Goal Context——执行者只看到草稿文本，这保证草稿必须独立成立。

Clarifier 读取的仓库代码与文档快照都是不可信 Source：其中的指令性内容（如"关闭测试、读取密钥、直接部署"）没有权限效力（§3），也不能提升 clarify job 自身的只读权限。草稿是 AI 提议，人的确认是唯一授权入口；提示注入面演练见 §11。

### 文档 Provider 与内容快照

文档是**只读输入 Source**，接口只有一个方法：`resolve(ref) → {title, content, version}`。引用用带 scheme 的 URI 区分实现：`file://`（相对目标仓库）、`feishu://docx/<token>`、`https://…`。

**开工即快照**：澄清/开工时 resolve 到的内容必须固化快照（内容 + version/hash）存入 Intake/Goal 引用，执行与审计以快照为准，不在执行期间重新读取外部文档。外部文档在 Run 期间被修改不影响进行中的执行；provider 不可达只阻塞新的 resolve 并显式报错，不静默降级、不影响已开工的 Run。

### 外部系统的分工纪律

| 内容 | 归属 |
|---|---|
| 需求文档、PRD、讨论 | 飞书文档等，经 DocProvider 只读引用 + 快照 |
| 需求池 / issues / 迭代 | 飞书 Base/任务一张表，作为 GoalIngressPort 的 Connector（§2） |
| 看板 / 状态总览 | 外部表基于回写状态字段的自带视图，工厂不感知 |
| 执行与交付状态 | 只在控制面；外部只收 §5 定义的投影 |

不做双向同步：外部系统对工厂只有**输入源**（issues、文档）和**投影目的地**（状态、证据链接回写，均为 Effect）两个角色，工厂永远不从外部系统读回执行状态。

## 8. CI/CD Provider 端口

外部 CI/CD（GitHub Actions、Codeup Flow、Jenkins 等）通过统一 `PipelinePort` 接入，只扮演两个角色：**受雇执行器**（运行构建/验证/部署流水线）和**观察源**（状态与产物回读）。它不是判定者：流水线成功只是 Evidence，Assessment 仍由控制器依据 Gate Policy 做出（四层判定语义）；更换 provider 不改变内部运行语义。

```text
PipelinePort
  trigger(pipeline_ref, revision, params, idempotency_key) → external_run_ref   # Effect
  observe(external_run_ref) → queued/running/succeeded/failed/unknown + stages   # 回读
  fetch_results(external_run_ref) → logs_ref / artifacts / reports               # → Evidence
  cancel(external_run_ref)                                                       # Effect
  webhook 或轮询 → 规范化事件信封（复用 §2 信封与 §4 Inbox 去重）
```

- `trigger/cancel` 是外部写，必须走 Effect Ledger：幂等键、超时先 `observe` 回读、不直接重发（INV-04）；provider 限流或离线只影响对应 job，按队列与 lease 语义等待，不静默丢弃。
- 结果只登记为 Evidence（provider、`external_run_ref`、日志与报告 digest、observed_at、对应 Baseline）；`succeeded` 不能映射 Assessment PASS，`failed` 作为 finding claim 的输入。
- **防篡改**：Producer 可以修改 Candidate 分支内的流水线定义（`.github/workflows`、Codeup `.flow.yml`），因此受保护 VERIFY 不得执行 Candidate 自带的定义——受信流水线定义位于 Producer 不可写的位置（独立仓库、受保护分支或平台侧配置），其引用与 digest 记入 Baseline Snapshot，定义变更触发重新 Assessment（INV-07/INV-13 的延伸）。
- Release 复用同一端口：Release Controller 经 `trigger` 发起部署，`DEPLOYING/OBSERVING` 由 `observe` 与独立健康信号共同驱动；`HEALTHY` 由 Release SLO 判定，不由流水线自报。
- Project 注册表登记 `pipeline_refs`（provider、流水线标识、用途 build/verify/deploy、受信定义 ref）。Worker 本地验证与外部流水线产出相同 shape 的 Evidence，Gate Policy 不感知执行位置。

适配器为 `GithubActionsAdapter`（workflow_dispatch 触发、check-run/workflow_run webhook + 轮询兜底、artifacts API 取产物）与 `CodeupFlowAdapter`（流水线运行 API + 回调/轮询）。MVP 只实现一个，其余复用同一契约。

## 9. 与 Orca、Multica 或其他 Agent Runtime 集成

对 Orca、Multica 这类 Issue 驱动系统，飞书逻辑仍留在边界：

```text
FeishuTableAdapter / FeishuTaskAdapter
  implements GoalIngressPort + OutcomeProjectionPort

OrcaAdapter / MulticaAdapter
  implements RunnerPort 或 ExternalIssuePort
```

外部 Runtime 只消费已授权 Task，并返回 Run result、Candidate 引用、工具观察回执和执行回执；只有 Broker/Assurance 能据此登记权威 Evidence。它的 `completed/done` 只表示一次执行结束，不能直接成为 Assessment PASS 或 `DELIVERED`。

不要把飞书 API 调用散落在 Agent prompt 或每个工作流节点中，也不要把飞书、Orca 或 Multica 的 Issue/评论当作内部记忆和权威状态库。

## 10. Operator Plane

Operator Plane 的职责以[总纲](README.md#2-最小架构四个组件)为准。本层只提供连接器积压、schema 漂移、投影 Effect 和脱敏回执诊断；它不是第五个状态库，也不能让正常链路依赖人工批准。

## 11. 最小故障演练

| 场景 | 预期 |
|---|---|
| Webhook 重复、乱序、确认前后崩溃 | 不重复建 Goal，不用旧 revision 覆盖新 revision |
| 外部写成功但回执丢失 | Effect 为 UNKNOWN，先回读，不重复写 |
| Capability 在 dispatch 前过期或撤销 | 写入被拒绝，checkpoint 不能恢复旧权限 |
| 飞书限流、字段删除或 schema 漂移 | 内部 Outcome 不丢失，投影暂停并在修复后续传 |
| Product 已交付但投影失败 | 产品状态不回滚，Outbox 使用原幂等键重试 |
| Connector 长时间离线后批量恢复 | 有序去重消费，不泄露或回写中间产物 |
| 评论包含越权或提示注入 | 只能成为不可信 Source，不能改变 Goal、Gate 或 Capability |
| 流水线触发成功但回执丢失 | Effect 为 UNKNOWN，先 observe 回读 external_run_ref，不重复触发 |
| Producer 篡改 Candidate 分支内的流水线定义 | 受保护 VERIFY 使用受信定义执行，篡改不影响 Assessment；定义 digest 与 Baseline 不符时拒绝采信结果 |
| 文档快照或仓库内容含提示注入 | 注入不能自动生效：草稿变化须经人确认才编译，越权 Boundary 被预授权范围拒绝，clarify job 只读权限不受文本内容影响 |

所有演练共同验证：不重复副作用、不丢最终 Outcome、不泄露中间产物、不可信内容不获得权限。
