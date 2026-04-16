# 重构实战

这次重构的重点，不是“把代码挪到另一个目录”，而是把职责重新切开。

## 重构前

`steven-cli-typescript` 里原本同时承担了三层职责：

- Anthropic SDK 初始化
- tool schema 声明
- tool 分发与 agent loop

于是出现了几个典型问题：

- `src/api.ts` 直接把供应商类型扩散到 CLI
- `TOOLS` 和 `runTool()` 是两套系统
- `agent.ts` 同时关心 provider、tool dispatch、todo reminder

## 重构后

职责拆成两层：

### SDK 层

- `provider.ts`
- `tool.ts`
- `anthropic-provider.ts`
- `agent.ts`

### CLI 层

- `config.ts` 继续持有模型和系统提示词
- `tools/index.ts` 只负责声明工具集合
- `agent.ts` 只负责组装 `Agent`
- `index.ts` 继续维护 REPL 与 history

## 一个最直观的 before / after

重构前的 tool 调用：

```ts
const output = runTool(block.name, block.input as Record<string, unknown>);
```

重构后的 tool 调用：

```ts
const output = executeTool(this.tools, block.name, block.input);
```

区别不只是少了一个 `as`，而是 schema 校验真正进入执行链路了。

## `src/api.ts` 为什么可以删除

因为 Anthropic 相关初始化已经进入 `createAnthropicProvider()`：

```ts
const agent = new Agent({
	provider: createAnthropicProvider({
		apiKey: process.env.ANTHROPIC_API_KEY,
		baseURL: process.env.ANTHROPIC_BASE_URL,
	}),
	...
});
```

CLI 不再需要知道 `new Anthropic()` 怎么写。

## 重构后的实际收益

- CLI 代码更短，但更重要的是边界更清楚
- 新 provider 可以在 SDK 层增加，不需要入侵 CLI
- tool 定义变成可组合资产，不再是零散常量
- 文档可以围绕 SDK 抽象组织，而不是围绕供应商 SDK 组织

## 下一步能做什么

P1 完成后，最自然的 P2 方向有三类：

1. hooks：把 todo reminder、trace、logging 变成可插拔能力
2. streaming：让 CLI 更像实时 agent，而不是轮询式输出
3. multi-provider：在不改 CLI 的前提下接入更多模型后端

这就是“先抽最小 SDK，再长能力”的价值。
