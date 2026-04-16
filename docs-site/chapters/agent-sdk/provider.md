# Provider 层

Provider 层的设计目标只有一个：把“模型怎么调”封装起来，让 Agent 只看见统一的输入输出。

## 目标接口

```ts
interface GenerateOptions {
	model: string;
	system: string;
	messages: Message[];
	tools: ToolDefinition[];
	maxTokens: number;
}

interface GenerateResult {
	content: ContentBlock[];
	stopReason: "end_turn" | "tool_use" | "max_tokens";
}

interface Provider {
	generate(options: GenerateOptions): Promise<GenerateResult>;
}
```

这个接口是刻意极简的：

- 只有一个 `generate()`
- 不泄漏 Anthropic 的 `MessageParam`
- 返回值只保留 Agent loop 真正关心的字段

## 为什么不用 Anthropic 类型直接贯穿全系统

如果 CLI 内部到处都是 `Anthropic.MessageParam`，问题会很快出现：

- 供应商类型渗透到所有业务文件
- 工具结果、文本 block、stop reason 都被外部 SDK 主导
- 替换 provider 时，几乎每个模块都要改

把类型转换压缩到 `anthropic-provider.ts` 之后，SDK 外部只依赖自己的消息模型，边界就稳定了。

## 与 Vercel AI SDK 的相似点

Vercel AI SDK 的强项之一，就是把“模型能力”和“调用方逻辑”隔开。Steven 这里借鉴的是这条思路，而不是完整照搬它的大接口面。

Steven 的取舍是：

- 保留统一 provider 边界
- 不引入 capability negotiation
- 不引入 response stream protocol
- 不把 UI、structured output、multi-modal 一起带进来

## Anthropic Provider 的职责

`createAnthropicProvider()` 只做四件事：

1. 初始化 `new Anthropic()`
2. 把 SDK `Message[]` 转成 `Anthropic.MessageParam[]`
3. 调用 `client.messages.create()`
4. 把响应映射回 SDK `GenerateResult`

这意味着 Anthropic 特有的内容都被关在一个文件里：

- block 类型差异
- `max_tokens`
- `stop_reason`
- tool schema 类型要求

## 一个关键取舍

Anthropic 的 stop reason 比 Steven SDK 更丰富，但 P1 的 Agent loop 只需要区分三种：

- `tool_use`
- `max_tokens`
- 其他一律当作 `end_turn`

这不是信息最完整的设计，但对最小 loop 来说是最实用的设计。
