# 自主 AI 产品工厂：设计总览

领域术语和不变量以 [CONTEXT.md](../CONTEXT.md) 为准。

## 1. 一句话

> 系统接受一份委托，围绕它安排工作、收集产出、作出判定；获授权的外部作用产生新的产出，直到系统能够确认结果。

## 2. 五个核心概念

| 概念 | 回答的问题 |
|---|---|
| Mandate | 系统正在为哪一版要求工作？ |
| Work | 为推进委托，还必须完成什么？ |
| Result | 工作或外部世界实际带回了什么？ |
| Judgment | 这些产出在当前委托下意味着什么？ |
| Effect | 系统获准对外部世界做什么？ |

```text
Mandate
  → Work
  → Attempt → Result
  → Judgment
  → 必要时授权 Effect
  → Attempt → Result
  → Judgment 确认现实结果
```

必须分开的三种结论：

- Work 完成：当前义务已经结束；
- Result 被接受：有权判定者认为它满足精确 Mandate；
- 已交付：有权判定者确认约定的现实结果已经成立。

不能用一个 `SUCCESS` 或 `DELIVERED` 混合三者。

## 3. 谁作出 Judgment

权威来自人，不来自 Agent、测试器、编排器或数据库。

第一阶段采用最小规则：

- 人在 Console 中发布或修订 Mandate；
- Work 的固定完成条件满足时，系统可以依据 Mandate 的预先授权结束该 Work，但不能因此接受 Result；
- 必要检查失败时，系统依据 Mandate 预先授权的确定性规则自动拒绝；
- 检查通过只形成 Result，不自动接受最终结果；
- Result 的接受、Effect 的授权和交付确认均由人在 Console 中显式作出；
- LLM 可以分析、推荐或寻找反例，但其输出始终只是 Result。

控制面负责验证权限、固定引用和保存 Judgment，不把自己的运行状态当成权威。

## 4. 第一阶段产品闭环

1. 用户草拟并发布一份 Mandate revision。
2. 系统安排一个粗粒度 Work。
3. Worker 在隔离工作区执行 Attempt。
4. Agent 产生代码 Result，构建和测试产生观察 Results。
5. 系统执行 Mandate 预先授权的确定性完成规则和否定性门禁。
6. 用户查看产出和材料，作出接受、拒绝或补证 Judgment。
7. 系统交付被接受 Result 的稳定材料引用。

第一阶段不执行远端 Git 写入、PR、CI/CD、部署或发布。专业系统继续负责这些工作；未来只有明确的现实交付需求才引入具体 Effect Adapter。

## 5. 外部接口保持最小

对使用者，产品只暴露一个主要对象：Mandate。

```text
提交委托
修订委托
查看委托及其结果
作出明确判定
```

Work、Attempt、队列、lease、fencing、Worker、材料存储和外部对账都隐藏在接口之后。

## 6. 设计边界

当前不预建：

- 动态任务图、Planner、多 Agent 组织或 Agent 市场；
- 通用连接器、Webhook 总线或双向同步框架；
- 通用策略语言、证据图或材料平台；
- 内建 PR、CI/CD、部署控制器或回滚系统；
- 为尚不存在的多租户、跨区域和大规模 Worker 集群设计接口。

出现真实调用者、独立生命周期和可执行验收之前，不增加新的核心概念或通用机制。

## 7. 文档导航

| 问题 | 文档 |
|---|---|
| Mandate、Result、Judgment 和判定者 | [01-context-and-trust.md](01-context-and-trust.md) |
| Work、Attempt、重试和运行安全 | [02-runtime.md](02-runtime.md) |
| Result、Artifact Ref 和材料保留 | [03-artifacts.md](03-artifacts.md) |
| Effect 与外部专业系统 | [04-integrations.md](04-integrations.md) |
| 研究来源 | [REFERENCES.md](REFERENCES.md) |
