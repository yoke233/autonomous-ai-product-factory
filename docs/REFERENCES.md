# 冷参考索引

本文件只保存实现设计时可能需要回查的来源，不定义领域语言或架构结论。领域术语与不变量唯一以 [CONTEXT.md](../CONTEXT.md) 为准；[设计总览](README.md) 和专题文档必须服从它。

## Agent 上下文与长任务

- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Lost in the Middle, TACL 2024](https://aclanthology.org/2024.tacl-1.9/)
- [LongMemEval, ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html)

## 验证与安全

- [METR: Recent Frontier Models Are Reward Hacking](https://metr.org/blog/2025-06-05-recent-reward-hacking/)
- [SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/)
- [AgentDojo, NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/hash/97091a5177d8dc64b1da8bf3e1f6fb54-Abstract-Datasets_and_Benchmarks_Track.html)
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

## 运行、幂等与恢复

- [Hatchet Architecture & Guarantees](https://docs.hatchet.run/v1/architecture-and-guarantees)
- [Hatchet Durable Tasks](https://docs.hatchet.run/v1/durable-tasks)
- [Brandur: Idempotency Keys in Postgres](https://brandur.org/idempotency-keys)
- [Kleppmann: Distributed Locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)

没有真实调用者和可执行验收时，不把实现机制、适配器或配置项写入活跃设计。领域内核只按不可合并的语义与生命周期确定，不迁就既有代码结构。
