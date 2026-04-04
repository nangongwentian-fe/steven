# 目标

从 0 到 1 构建一个与 Claude Code 同等水准的 Coding Agent CLI，深入理解 Agent 的设计哲学与工程实现。计划分两条并行路线实现，并同步建设一套教学型文档站：

1. **[@steven-cli-langchain](./steven-cli-langchain)** — 基于 LangChain 全家桶技术栈构建 Coding Agent CLI，系统探索成熟框架下的 Agent 工程实践。
2. **[@steven-cli-typescript](./steven-cli-typescript)** — 用 TypeScript 从 0 到 1 手写 Coding Agent CLI，不依赖任何 Agent 框架，彻底摸清底层机制。
3. **[@docs-site](./docs-site)** — 使用 VitePress 搭建可视化文档站，把 CLI 的设计拆解成可学习、可演示、可复现的章节内容。

# 参考项目

选取以下 4 个业界知名项目的 Agent 源码作为参考：

| 项目 | 地址 | 本地路径 | 参考重点 |
|------|------|----------|----------|
| Claude Code | [GitHub](https://github.com/claude-code-best/claude-code) | [@references/claude-code](./references/claude-code) | ⭐ 主要参考——业界最强 Coding Agent CLI，架构设计标杆 |
| Codex | [GitHub](https://github.com/openai/codex) | [@references/codex](./references/codex) | OpenAI 官方 Coding Agent 实现 |
| OpenCode | [GitHub](https://github.com/anomalyco/opencode) | [@references/opencode](./references/opencode) | 社区向 Coding Agent CLI 实现 |
| Deer-Flow（harness 部分） | [GitHub](https://github.com/bytedance/deer-flow/tree/main/backend/packages/harness) | [@references/deerflow-harness](./references/deerflow-harness) | 字节跳动出品，基于 LangChain 构建，与 steven-cli-langchain 技术栈一致，具有直接参考价值 |

> **重点参考 Claude Code**：作为业界最强的 Coding Agent CLI，其架构是本项目的核心参照。
> **其次参考 Deer-Flow**：基于 LangChain 技术栈构建，与 `steven-cli-langchain` 实现路线高度契合。

# 学习输出

在实现过程中同步输出一份**可视化学习笔记**，将 Agent 的核心设计（工具调用、上下文管理、规划与执行循环等）以图文并茂的方式呈现，方便沉淀与分享。

文档站入口：[@docs-site](./docs-site)

`docs-site` 的内容组织与教学表达方式，参考 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 的思路来实现，重点不是简单罗列源码解析，而是强调：

1. 按主题渐进式拆解，从概念到实现再到代码落点，降低学习门槛。
2. 每一章尽量对应一个清晰问题，例如工具系统怎么设计、上下文如何裁剪、Agent Loop 如何驱动。
3. 结合流程图、结构图、关键代码片段和最小可运行示例，形成“讲清楚原理 + 对应到工程实现”的教学闭环。
4. 优先服务“边学边做”的读者，让 `docs-site` 成为两条 CLI 实现路线的配套课程，而不仅是项目说明文档。
