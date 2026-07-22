# 参考资料

本文件只保存设计与实现时需要回查的来源，不定义项目术语。领域语言以 [CONTEXT.md](../CONTEXT.md) 为准；GitHub 文档用于实现第一套 Provider，不反过来限定核心接口。

## GitHub 工作模型

- [GitHub Pull requests documentation](https://docs.github.com/en/pull-requests)
- [Using issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues)
- [About issues, sub-issues and issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/about-issues)
- [Creating issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies)
- [Linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
- [About pull request reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews)
- [About status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## GitHub App

- [GitHub Apps overview](https://docs.github.com/en/apps/overview)
- [Choosing permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
- [Using the REST API to interact with checks](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-checks)
- [Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Best practices for using webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)

## Agent 运行

- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Hatchet Architecture & Guarantees](https://docs.hatchet.run/v1/architecture-and-guarantees)
- [Hatchet Durable Tasks](https://docs.hatchet.run/v1/durable-tasks)
- [Agent Client Protocol: Prompt Turn](https://agentclientprotocol.com/protocol/v1/prompt-turn)
- [Agent Client Protocol: Tool Calls](https://agentclientprotocol.com/protocol/v1/tool-calls)
- [Agent Client Protocol: Agent Plan](https://agentclientprotocol.com/protocol/v1/agent-plan)

没有真实需求时，不从参考资料预先引入新对象、状态机或基础设施。
