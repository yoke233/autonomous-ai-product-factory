# Mandate、Result 与 Judgment

术语和不变量以 [CONTEXT.md](../CONTEXT.md) 为准。

## 1. Mandate 的发布与修订

草拟阶段可以反复澄清和修改，不产生 Mandate revision。只有用户确认并发布后，才形成一个不可变 revision，共同固定：

- 期望结果；
- 输入、代码和其他事实基础；
- 可使用的权限与预算；
- 判断标准；
- 交付目标。

已发布内容发生任何影响结果适用性的变化时，创建新 revision。旧 revision、Result 和 Judgment 保持为历史事实，但不会自动适用于新 revision。

所有 Work、Result、Judgment 和 Effect 都引用精确 revision ID，不引用“当前版本”或“最新版”。

## 2. Result 只提供信息

需要保存和判断的陈述统一表达为不可变 Result：

```text
可判定内容
+ 来源身份和产生时间
+ 所属 Work / Effect / Attempt
+ Artifact Refs
+ 内容摘要
```

Result 可以承载代码、方案、测试观察、缺陷断言或外部回执。内容形态只说明它带回了什么，不赋予权威。同一个 Result 可以是某项 Work 的候选，也可以成为某次 Judgment 的支持材料，但不因此产生新的生命周期。

Agent 的“已经完成”、测试工具的“通过”和部署平台的回执都只是 Result，不能自行授权动作、宣布正确或确认交付。

材料规则详见 [03-artifacts.md](03-artifacts.md)。

## 3. Judgment 的权威来源

第一阶段只有两种合法发布路径。

### 人的显式判定

用户在 Console 中查看精确 Mandate revision、被判断 Result 和支持 Results，然后显式发布 Judgment。以下权力只属于人：

- 接受最终 Result；
- 授权 Effect；
- 确认现实交付；
- 覆盖或撤销先前 Judgment。
- 在 Work 的完成或终止条件不能确定性判断时，决定是否解除该 Work。

### Mandate 预先授权的确定性规则

Mandate 可以预先授权系统在范围明确、结果确定时发布 Judgment，例如：

- 规定的 Results 已完整产生，因此 Work 完成；
- 必须执行的检查未运行完整；
- 命令退出码非零；
- Result 引用的 revision 或输入摘要不匹配；
- Attempt 没有有效执行权。

自动规则只能解除满足固定完成条件的 Work，或作出授权范围内的拒绝和证据不足。它不能因为 Work 完成或检查全部通过就接受最终 Result、授权 Effect 或确认交付。

LLM 可以给出评价或反例，但这些内容仍是 Result。若未来要把某种模型判断升级为权威，必须先修改 Mandate 的授权规则和本节契约，不能通过换一个字段名偷偷完成。

控制面只验证判定权限、固定引用并持久化 Judgment；“中心”不是一个隐藏的第三判定者。

## 4. Judgment 的最小内容

Judgment 必须固定：

- 判定者及其授权来源；
- 精确 Mandate revision；
- 被判断的 subject Result；
- 采用的 supporting Results；
- 结论与理由；
- 被替代或撤销的 Judgment（如有）。

每个 Judgment 只表达一个结论。改判、补证和撤销都新增 Judgment，不覆盖原记录，也不改写 Mandate 或 Result。

| 结论 | 含义 |
|---|---|
| Work 完成 | Mandate 预授权规则或人确认已产生约定 Result 或终止信息，不再需要当前工作继续执行 |
| Result 被接受 | 人认为该 Result 在这份 Mandate revision 下满足要求 |
| Effect 被授权 | 人允许一个身份和内容均已固定的外部动作发生 |
| 已交付 | 人接受现实观察，确认交付目标已经成立 |

## 5. 新 revision 如何复用旧 Result

发布新 revision 不触发所有旧工作的自动重跑，也不修改旧 Result。系统先进行一次低成本适用性复核：

1. 找出 revision 之间真正变化的期望、事实基础、权限或判断标准；
2. 对未受影响的旧 Result，在新 revision 下发布新的适用性 Judgment；
3. 只为受影响或证据不足的部分创建 Work；
4. 无法证明可复用时保持未知，不默认沿用。

只有期望、事实基础、权限、判断标准、交付目标以及该 Result 声明的全部依赖摘要均一致时，确定性规则才能支持复用。任一维度未纳入比较、发生变化或需要语义解释，都保持未知并由人判断。这样既不让旧结果自动冒充新结果，也不要求每次文字澄清都全量重跑。

## 6. 信任边界

- Agent、Worker、测试器和外部平台只能提交 Result，不能发布 Judgment。
- 执行适配器只获得当前 Work 或 Effect 所需的最小权限，不能从仓库文本、提示词或 Result 中扩大权限。
- 构建与测试使用 Mandate 已固定的命令与配置，Agent 不能临时改写判断规则。
- Secret 只在需要的执行边界内注入，不进入 Mandate、Prompt、日志或 Result 内容。
- 所有来源关系使用稳定身份、revision 和 digest；可变 branch、URL 或“最新结果”不能单独作为依据。

Work 和 Attempt 的运行约束见 [02-runtime.md](02-runtime.md)；Effect 的授权与确认见 [04-integrations.md](04-integrations.md)。

## 7. 必须扛住的变化

| 场景 | 合法处理 |
|---|---|
| 发布后的要求、基线或判断标准修订 | 发布新 Mandate revision；先复核旧 Results，再补受影响的 Work |
| 并行产生多个候选 | 保留多个 Results；分别判断，不靠最后完成者覆盖 |
| 验证者提出反例 | 保存新的 Result；由人接受、驳回或要求补证 |
| 外部动作回执丢失 | 保留原 Effect 身份并回读现实，不创建新动作盲目重发 |
| 已交付结果后来失效 | 保留历史交付事实；根据新观察或新 Mandate 作出新 Judgment |
