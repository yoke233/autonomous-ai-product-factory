# 冷参考索引

本文件不进入默认 Agent Context，只在验证设计依据时读取。

## Context 与长任务

- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Lost in the Middle, TACL 2024](https://aclanthology.org/2024.tacl-1.9/)
- [LongMemEval, ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html)

## Provenance、恢复与副作用

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/)
- [SLSA Provenance](https://slsa.dev/spec/v1.2/provenance)
- [Temporal Workflow Execution](https://docs.temporal.io/workflow-execution)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)

## 多 Agent、验证与安全

- [Anthropic: How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [AgentLens](https://www.microsoft.com/en-us/research/publication/agentlens-revealing-the-lucky-pass-problem-in-swe-agent-evaluation/)
- [SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/)
- [AgentDojo, NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/hash/97091a5177d8dc64b1da8bf3e1f6fb54-Abstract-Datasets_and_Benchmarks_Track.html)
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

## 参考实现

- [stablyai/orca](https://github.com/stablyai/orca) — Issue 驱动 Agent 编排与适配边界参考，不作为本设计的完整信任模型。

