# 第三章：Provider 抽象

## 背景

第一章结束时，你的 Agent Loop 里直接调用了 `callAnthropic()`——一个硬编码到 Anthropic SDK 的函数。这在只有一个 Provider 时完全合理。

**第三章要解决的问题：** 如果我想切换到 OpenAI，需要改多少行代码？

答案是：`query.ts`、`engine.ts`、`bin/index.ts` 都要改，还要重写消息格式转换逻辑。这是一个明显的设计缺陷——**LLM 的具体实现泄漏进了 Agent Loop 的核心**。

## 本章目标

**本章结束后，切换 Provider 只需要改一个环境变量：**

```bash
# 用 Anthropic（默认）
ANTHROPIC_API_KEY=sk-ant-... bun run bin/index.ts -p "hello"

# 用 OpenAI
STEVEN_PROVIDER=openai OPENAI_API_KEY=sk-... bun run bin/index.ts -p "hello"
```

`query.ts` 的代码**一行不改**。

## 本章内容

- [3.1 LLMProvider 接口](./3.1-interface) — 定义 Agent Loop 与 Provider 之间的契约
- [3.2 重构 Anthropic](./3.2-anthropic) — 把 `callAnthropic()` 封装成 `AnthropicProvider` 类
- [3.3 接入 OpenAI](./3.3-openai) — 实现 `OpenAIProvider`，理解两者消息格式的差异
- [实现笔记](./notes) — 为什么这样设计，有哪些替代方案

## 本章结束后你能做什么

```bash
# 切换 Provider 不改代码
STEVEN_PROVIDER=openai OPENAI_API_KEY=sk-... bun run bin/index.ts -p "搜索项目里所有 .ts 文件"

# 测试两个 Provider 行为一致
STEVEN_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... bun run bin/index.ts -p "读取 src/core/query.ts"
STEVEN_PROVIDER=openai OPENAI_API_KEY=sk-... bun run bin/index.ts -p "读取 src/core/query.ts"
```
