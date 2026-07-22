# Work、Attempt 与运行安全

术语和不变量以 [CONTEXT.md](../CONTEXT.md) 为准。

## 1. Work 是义务，Attempt 是尝试

Work 回答“为了推进这份 Mandate，还必须完成什么”。它具有稳定身份、输入条件、完成条件、预算和停止条件，并跨多次 Attempt 持续存在。

Attempt 只表示执行某个 Work 或 Effect 的一次持久化尝试，承担：

- 执行来源和重试 lineage；
- 排队、开始、结束、取消和超时记录；
- lease、fencing 和执行者身份；
- 本次资源、日志及所产生 Results 的引用。

Attempt 执行结束不等于 Work 完成，Work 完成不等于 Result 被接受，也不等于已经交付。

第一阶段每个 Mandate revision 只创建一个粗粒度代码修改 Work。执行失败或需要修复时保留同一 Work，创建新的 Attempt。只有出现真实的独立依赖、并发或停止条件时，才拆分更多 Work；不预建任务图。

## 2. 运行闭环

Runner 接收固定到精确身份和摘要的执行上下文：

```text
Mandate revision
Work 或 Effect
Attempt
仓库与输入基线
允许的命令和权限
预算、超时与取消信号
```

代码修改 Attempt 至少应：

1. 验证输入身份、lease 和 fencing token；
2. 创建本次 Attempt 独有的 worktree；
3. 在最小权限环境中调用 Agent；
4. 运行 Mandate 规定的构建和测试；
5. 返回不可变 Results 与 Artifact Refs；
6. 无论成功、失败、取消还是超时，都终止子进程并清理临时资源。

Runner 不接收长期对话历史、其他候选的无关日志或长期凭证。需要源码时直接读取本次 worktree，不预建全局项目记忆或向量知识库。

## 3. 派发、lease 与 fencing

运行实现必须保证：

- 已发布 Work 或 Effect 在派发失败和进程重启后仍可发现；
- 同一 Attempt 的重复触发不会产生两个可发布结果的执行者；
- lease 有明确所有者和期限，失效后能够安全接管；
- 旧执行者的迟到进度和 Result 被 fencing 拒绝；
- 同一仓库不会发生破坏工作区的并发写入。

重试 Work 使用新的 Attempt 身份。重试 Effect 还必须沿用原 Effect 身份和幂等域，见 [04-integrations.md](04-integrations.md)。

这里规定可观察行为，不固定 SQL、表结构或具体锁算法。

## 4. 取消、超时与恢复

- 取消 Attempt 是运行信号；解除 Work 或撤销 Effect 授权必须由 Judgment 表达。
- Agent、构建和测试各自设置明确超时。
- 取消或超时后主动终止完整子进程树，不能只更新记录。
- Attempt 超时表示本次执行没有按期完成，不代表 Result 无效，也不代表 Effect 失败。
- Worker 崩溃后，可恢复的 Work 通过新 Attempt 重试；已产生的 Results 不被覆盖。
- 残留 worktree、分支或进程必须能被识别和清理，不能被下一次 Attempt 误认为成功结果。

## 5. 实现顺序与验收

运行正确性先于编排便利性。

### P0：执行身份与隔离

- 持久化 Work、Attempt、精确 Mandate revision 和执行 lineage；
- 实现 lease/fencing，拒绝重复执行者和迟到 Result；
- 使用环境变量白名单，并在取消、失败和超时后清理完整进程树与 worktree。

验收：并发触发、Worker 崩溃、旧 Attempt 晚到、取消和超时测试均不能产生假成功、越权 Result 或残留进程。

### P1：可恢复派发

- 未完成 Work 在服务重启后可发现；
- 重复派发保持业务幂等；
- 每次重试保留独立 Attempt 和来源关系。

验收：在提交、派发、开始执行和保存 Result 的边界分别模拟崩溃，恢复后没有丢失工作、重复权威结果或错误覆盖。

### P2：接入 Hatchet

Hatchet 只替换排队、重试、超时和 Worker 调度，不改变 Work、Attempt、Result 或 Judgment 语义。首个任务保持粗粒度，不使用 DAG、child spawning 或复杂 affinity。

验收：切换本地调度器与 Hatchet 后，同一组并发、崩溃、取消和迟到结果测试保持一致。

## 6. 最小失败矩阵

| 场景 | 必须保持的结果 |
|---|---|
| 调度触发失败 | Work/Effect 仍可发现并重新派发 |
| 同一 Attempt 重复触发 | 至多一个执行者能发布 Results |
| Worker 崩溃 | 创建新 Attempt 或明确终止，不产生假成功 |
| 旧 Attempt 晚到 | fencing 拒绝其发布，不覆盖新 Results |
| Mandate 在执行期间修订 | 原 Attempt 仍归属旧 revision；新 revision 重新复核适用性 |
| Agent 超时或用户取消 | 进程树和临时工作区被清理 |
| Mandate 规定的强制检查确定失败 | 保存观察 Result，由该 revision 预授权的具体门禁拒绝 |
| 检查未被预授权、基础设施故障或充分性需要解释 | 只保存 Result，交由人判断拒绝或补证 |
| Effect 调用超时 | 保留结果未知并对账，不以新 Effect 盲目重发 |
