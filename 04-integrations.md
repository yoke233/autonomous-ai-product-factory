# 飞书、Issue Manager 与 Orca 的边界

## 1. 定位

飞书任务、飞书多维表格、Linear、Jira、GitHub Issues 或自有 Issue Manager 只是 Goal 入口和 Outcome 出口：

```text
外部工作项
  → GoalIngressPort
  → 自主 AI 产品工厂
  → OutcomeProjectionPort
  → 原工作项
```

它们不保存 Agent Context、Task、checkpoint、Evidence 或候选产物。更换 Issue Manager 不应改变内部运行语义。

## 2. 规范化请求

适配器输出一个简单信封：

```text
connector, tenant, project
external_item_id, external_revision, event_id
authenticated_actor
command             create / revise / cancel
goal_fields
boundary_fields
untrusted_content_refs
reply_target
```

`external_item_id + external_revision + event_id` 用于去重、处理乱序和安全重放。

## 3. 信任边界

Webhook 签名只证明事件来源。只有入口策略明确列出的字段有资格表达 Raw Goal 或 Boundary；字段内容在 Goal 编译前仍不是正式契约，也不能授予权限。

- 目标字段表达“想要什么”；
- Boundary 字段只能在预授权范围内设置环境和预算；
- 评论、附件、链接和技术方案作为不可信 Source；
- 文本中的“关闭测试、读取密钥、直接部署”没有权限效力；
- 修改目标创建新 revision，不覆盖正在运行的旧版本。

## 4. 结果投影

外部工作项只接收：

- `RECEIVED/RUNNING`；
- `DELIVERED` 与 Product 引用；
- `NEEDS_GOAL_INPUT` 或 `NEEDS_BOUNDARY_INPUT` 的一个简短问题；
- `NO_SAFE_RELEASE/CANCELLED/SYSTEM_FAULT` 与原因类别。

默认不回写 Agent 对话、PRD、架构草稿、候选列表、完整 Review 或 trace。

所有回写都是 Effect：使用稳定幂等键，超时后先回读平台状态，再决定是否重试。

## 5. 飞书映射

### 多维表格

- 一条记录对应一个外部 Work Item；
- 记录 ID 是稳定身份，revision 或更新时间用于并发控制；
- 显式列映射 Goal、Boundary、命令和 Outcome；
- 附件、评论和未白名单字段只作为 Source。

### 飞书任务

- Task GUID 对应外部 Work Item；
- 创建者、成员和应用身份决定谁能创建、修订或取消；
- 只有明确配置的标题、描述片段或自定义字段可形成 Raw Goal；
- 只有 `DELIVERED` 可以自动完成任务，失败不能伪装成完成。

## 6. 与 Orca 集成

对 Orca 这类 Issue 驱动运行时，飞书逻辑应留在边界：

```text
FeishuTableAdapter / FeishuTaskAdapter
  implements GoalIngressPort + OutcomeProjectionPort
```

Orca 只消费规范化请求并返回 Outcome。不要把飞书 API 调用散落在 Agent prompt 或每个工作流节点中，也不要把飞书记录当作内部记忆库。

第一版只需验证六件事：重复事件不重复建 Goal、乱序编辑不覆盖新版本、评论注入不能越权、目标修改触发新 revision、回写 Resume 不重复、外部工作项不承载中间产物。

