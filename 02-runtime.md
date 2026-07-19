# Agent 运行、恢复与验证循环

## 1. Task 是基本调度单位

每个 Task 至少包含：

```text
objective       要改变或发现什么
inputs          Baseline 和稳定引用
expected_delta  预期产物
oracle          如何自动判断结果
coverage        必须触达的信息面
effects         允许的外部副作用
budget          时间、token、分支和产物预算
stop            成功、失败和终止条件
```

没有 Oracle 的生产 Task 不执行。Oracle 本身若由 AI 生成，也只是候选；硬目标至少需要受保护测试、属性检查、外部回读或真实运行指标中的一种独立信号。

## 2. 运行循环

```text
Task
  → Context View
  → Run / Candidate
  → deterministic checks
  → independent verification
  → counterexample search when needed
      ├─ Finding → 新修复 Task
      ├─ Inconclusive → 补证或停止
      └─ Pass → Product Revision / release
```

Finding 必须先回到 Runtime 形成新 Task，再启动修复 Agent。Verifier 和发布控制器不能绕过 Task、Context、预算和权限直接命令 Agent。

## 3. 角色按需产生

产品、架构、开发、测试和 Review 都是能力模板：

- 简单修改不需要完整四段流水线；
- 独立方案有真实探索价值时才 fork；
- 高风险变更才增加更强对抗和运行验证；
- 一个 Agent 可以完成多个相邻能力，只要 Gate 仍独立。

## 4. Continue、Resume、Re-enter 与 Fork

| 操作 | 语义 |
|---|---|
| Continue | 同一短期会话继续当前 Run |
| Resume | 从同一 branch、同一 Baseline 的 checkpoint 继续 |
| Re-enter | 换 Agent 接手同一 branch，不继承旧聊天 |
| Fork | 从不可变 checkpoint 创建隔离候选 branch |
| Rebase | 从新 Baseline 创建 branch generation，旧 checkpoint 不改写 |
| Merge | 合成 Candidate Delta；重新验证后才可能成为 Product Revision |

Checkpoint 只保存任务游标、Delta 引用、工具 continuation、Coverage、Effect 状态和版本信息。它不保存完整聊天或推理文本，也不提升任何结论的可信度。

Merge 前比较完整 Baseline 和取消版本；目标、源码、配置、产品或权限任一变化都必须 Rebase 或重新验证。

## 5. 外部副作用

所有真实写操作进入 Effect Ledger：

```text
effect_id
intent_hash
idempotency_key
target
prepared / dispatched / confirmed / unknown / compensated
receipt
```

- Resume 和 Retry 复用原幂等键；
- `unknown` 先查询外部状态，不能直接重发；
- Replay 默认禁止真实副作用；
- 权限在每次 dispatch 前重新检查，旧 checkpoint 不延续已撤销授权；
- 无法幂等、回读或补偿的高影响操作不自动执行。

## 6. 停止、发布与自愈

只有硬性验收通过、没有阻塞 Unknown 且发布观察稳定，才能 `DELIVERED`。

候选无改进但仍未通过 Gate、预算耗尽或关键来源不可达时返回 `NO_SAFE_RELEASE`。目标歧义和授权缺失分别返回 `NEEDS_GOAL_INPUT` 与 `NEEDS_BOUNDARY_INPUT`。

运行中发现偏差时，系统固定故障环境，生成复现和修复 Task，再走相同验证循环。设置最大连续修复次数、冷却期和风险预算；回滚目标也要在当前环境重新检查兼容性，不能只因“过去安全”就盲目回滚。

