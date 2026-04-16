# Agent Loop

有了 Provider 和 Tool 系统之后，Agent Loop 就可以缩成一个很纯粹的状态机。

## `Agent` 的输入

```ts
interface AgentOptions {
	provider: Provider;
	model: string;
	system: string;
	tools: Tool[];
	maxTokens?: number;
	onToolCall?: (name: string, output: string) => void;
}
```

这里没有 CLI 逻辑，没有 readline，也没有 todo reminder。`Agent` 只负责一件事：把模型和工具循环跑完。

## 最小循环

```ts
while (true) {
	const response = await provider.generate(...);
	messages.push({ role: "assistant", content: response.content });

	if (response.stopReason !== "tool_use") {
		return;
	}

	for (const block of response.content) {
		if (block.type !== "tool_use") continue;
		const output = executeTool(tools, block.name, block.input);
		results.push({
			type: "tool_result",
			tool_use_id: block.id,
			content: output,
		});
	}

	messages.push({ role: "user", content: results });
}
```

这就是一个可工作的 Agent runtime 核心。

## 为什么消息数组是“就地修改”

`run(messages)` 不是返回一份新历史，而是直接 push 到传入数组里。原因很现实：

- CLI 已经天然维护了一份共享 history
- 多轮对话最方便的状态载体就是同一个数组
- P1 不需要 immutable state machine 的复杂度

## 与 pi-mono 双层循环的关系

pi-mono 这类系统常见的是：

- 外层 orchestrator loop
- 内层 provider / tool execution loop

Steven P1 只保留内层。因为 CLI 当前还没有：

- 多 agent
- planner / executor 分层
- interruption / resumption protocol

所以先把最小 loop 抽出来，收益已经足够大。

## 为什么把 reminder 留在 CLI

旧 CLI 里有 `roundsSinceTodo` 提醒逻辑，但它本质上是产品行为，不是 runtime 必要能力。

把它留在 CLI 而不是塞进 SDK，有两个好处：

- SDK 更通用，不被某个交互习惯绑死
- 后续如果要做 hooks，可以把 reminder 作为 hook 重挂回去

这也是 P1 和 P2 的边界：P1 先把核心 loop 抽稳，P2 再考虑扩展点。
