# Tool 系统

`defineTool()` 是这次 SDK 封装里最值钱的一层，因为它把原来分裂的三套信息合并成了一套。

## Zod 一石三鸟

同一个 schema 同时承担三种职责：

1. 生成 TypeScript 输入类型
2. 运行时校验模型产出的参数
3. 转成 JSON Schema 发给模型 API

```ts
const bashTool = defineTool({
	name: "bash",
	description: "Run a shell command.",
	schema: z.object({
		command: z.string(),
	}),
	handler: ({ command }) => runBash(command),
});
```

这里没有再手写第二份 `input_schema`，也没有再在执行阶段用 `as string` 解包参数。

## `defineTool()` 返回什么

每个 tool 最终同时拥有两种形态：

- 给 TypeScript 和 handler 用的 `schema`
- 给模型 API 用的 `definition`

```ts
interface Tool<T extends z.ZodType = z.ZodType> {
	name: string;
	description: string;
	schema: T;
	handler(input: z.infer<T>): string;
	definition: ToolDefinition;
}
```

这让“声明”和“执行”天然绑定在一起。

## 执行阶段怎么工作

`executeTool()` 的顺序很简单：

1. 按名字找到 tool
2. 用 `schema.parse(rawInput)` 校验
3. 调用 handler

于是旧 CLI 里的问题都消失了：

- 不需要中央 `switch-case`
- 不需要 `input.command as string`
- tool schema 和 handler 不会再漂移

## 与其他方案的差异

### 对比 Vercel AI SDK `tool()`

相似点：

- schema 驱动输入类型
- 工具声明和执行逻辑靠在一起

不同点：

- Steven 直接面向 agent runtime，而不是面向通用生成式接口
- Steven 自己持有 `ToolDefinition`，更适合直接接模型 provider

### 对比 pi-mono + TypeBox

pi-mono 这类方案通常把 runtime schema 放在系统更底层，扩展能力更强。Steven 选择 Zod，是因为 P1 的目标是让 CLI 立刻重构成功，而不是先搭一整套 runtime framework。

## 为什么这一步对 CLI 重构最关键

原先 CLI 里有两套真相：

- `TOOLS` 数组里的 JSON Schema
- `runTool()` 里的 switch-case

重构后只剩一套真相：`defineTool()`。

这一步一旦完成，后续再加 provider、hooks、streaming，复杂度都不会像之前那样指数增长。
