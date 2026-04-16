# 为什么自己造

`steven-agent-sdk` 的目标不是覆盖所有 Agent 场景，而是把 Steven CLI 里最核心的三件事抽出来：

- Provider 抽象
- Tool 定义与执行
- 最小可工作的 Agent Loop

做到这一步，CLI 就不再直接耦合 Anthropic SDK，后续无论是换模型供应商、加 hooks、做测试替身，还是把 Agent 嵌到别的应用里，边界都清楚得多。

## 为什么不直接用现成 SDK

现成 SDK 很强，但也都有自己的抽象偏好：

| 方案 | 强项 | 代价 |
| --- | --- | --- |
| Vercel AI SDK | Provider 抽象成熟，生态完整 | 面向通用 AI UI，Agent loop 不是核心主线 |
| Claude Agent SDK | 与 Claude 能力贴得很近 | 供应商耦合更强，抽象面向 Claude 世界观 |
| pi-mono | Agent runtime 设计完整，loop 分层清晰 | 结构更重，学习成本更高 |

Steven 这里要的不是“大而全”，而是一个能解释清楚、能自己维护、能支撑 CLI 重构的最小 SDK。

## P1 的边界

P1 只做三层：

1. `Provider`：统一模型调用接口
2. `defineTool()`：统一 schema、类型、JSON Schema 生成
3. `Agent`：负责 `tool_use -> tool_result` 循环

这足够替换当前 CLI 全部功能，但刻意不做：

- hooks
- streaming
- memory
- provider capability matrix
- todo reminder 等 CLI 特有 UX

## 重构后的收益

- CLI 只关心配置和工具集合，不再持有供应商细节
- tool 定义、校验、执行不再分裂成 schema + switch-case 两套系统
- 类型边界集中在 provider 层，业务代码不再到处写 `as`
- 文档可以围绕 SDK 讲“为什么这么设计”，而不是只讲某一个 CLI 文件

## 本章结构

- [Provider 层](/agent-sdk/provider)
- [Tool 系统](/agent-sdk/define-tool)
- [Agent Loop](/agent-sdk/agent-loop)
- [重构实战](/agent-sdk/refactor)
