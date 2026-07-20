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

## 7. 与 Orca、Multica 或其他 Agent Runtime 集成

对 Orca、Multica 这类 Issue 驱动系统，飞书逻辑仍留在边界：

```text
FeishuTableAdapter / FeishuTaskAdapter
  implements GoalIngressPort + OutcomeProjectionPort

OrcaAdapter / MulticaAdapter
  implements RunnerPort 或 ExternalIssuePort
```

外部 Runtime 只消费已授权 Task，并返回 Run result、Candidate 引用、工具观察回执和执行回执；只有 Broker/Assurance 能据此登记权威 Evidence。它的 `completed/done` 只表示一次执行结束，不能直接成为 Assessment PASS 或 `DELIVERED`。

不要把飞书 API 调用散落在 Agent prompt 或每个工作流节点中，也不要把飞书、Orca 或 Multica 的 Issue/评论当作内部记忆和权威状态库。

## 8. Operator Plane

Operator Plane 的职责以[总纲](README.md#2-最小架构四个组件)为准。本层只提供连接器积压、schema 漂移、投影 Effect 和脱敏回执诊断；它不是第五个状态库，也不能让正常链路依赖人工批准。

## 9. 最小故障演练

| 场景 | 预期 |
|---|---|
| Webhook 重复、乱序、确认前后崩溃 | 不重复建 Goal，不用旧 revision 覆盖新 revision |
| 外部写成功但回执丢失 | Effect 为 UNKNOWN，先回读，不重复写 |
| Capability 在 dispatch 前过期或撤销 | 写入被拒绝，checkpoint 不能恢复旧权限 |
| 飞书限流、字段删除或 schema 漂移 | 内部 Outcome 不丢失，投影暂停并在修复后续传 |
| Product 已交付但投影失败 | 产品状态不回滚，Outbox 使用原幂等键重试 |
| Connector 长时间离线后批量恢复 | 有序去重消费，不泄露或回写中间产物 |
| 评论包含越权或提示注入 | 只能成为不可信 Source，不能改变 Goal、Gate 或 Capability |

所有演练共同验证三个不变量：不重复副作用、不丢最终 Outcome、不泄露中间产物。
