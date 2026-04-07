# Agent Loop

**文件：** `src/agent.ts` · 43 行

Agent Loop 是整个系统的核心——它把"用户输入 → 模型调用 → 工具执行 → 结果回填"这个循环自动化，直到模型决定停止。

## 模块职责

- 持续调用 Anthropic API 直到 `stop_reason !== "tool_use"`
- 解析响应中的 `tool_use` block，调用对应工具
- 将工具结果作为 `user` 消息写回 `history`
- 通过 `roundsSinceTodo` 计数器提醒模型更新任务进度

## 核心代码

```typescript
export async function agentLoop(messages: Anthropic.MessageParam[]) {
  let roundsSinceTodo = 0;

  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages,
      tools: TOOLS,
      max_tokens: 8000,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return;                    // ← 终止条件
    }

    const results: (Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam)[] = [];
    let usedTodo = false;

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const output = runTool(block.name, block.input as Record<string, unknown>);
        if (block.name === "todo") usedTodo = true;
        console.log(`> ${block.name}: ${output.slice(0, 200)}`);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,   // ← 必须与 tool_use block 的 id 对应
          content: output
        });
      }
    }

    roundsSinceTodo = usedTodo ? 0 : roundsSinceTodo + 1;
    if (roundsSinceTodo >= 3) {
      results.unshift({ type: "text", text: "<reminder>Update your todos.</reminder>" });
    }

    messages.push({ role: "user", content: results });
  }
}
```

## 设计决策

### 终止条件：`stop_reason !== "tool_use"`

Anthropic API 有几种 `stop_reason`：

| stop_reason | 含义 |
|-------------|------|
| `end_turn` | 模型认为任务完成，自然结束 |
| `tool_use` | 模型需要调用工具，循环继续 |
| `max_tokens` | 达到 token 上限 |

只有 `tool_use` 需要继续循环。其余情况（包括错误）都直接 `return`。

### 历史写入顺序

```
messages.push({ role: "assistant", content: response.content });  // 先写 assistant
// ... 执行工具 ...
messages.push({ role: "user", content: results });                // 再写 tool_results
```

这个顺序是 Anthropic API 的**强制约束**：`tool_result` 必须紧跟在对应的 `tool_use` assistant 消息之后。顺序写错会导致 API 报错。

### `roundsSinceTodo` 计数器

模型在执行长任务时，有时会"忘记"更新 todo 状态。这个计数器是一个**软性提醒机制**：

```
每轮检查：是否调用了 todo 工具？
- 是 → 重置为 0
- 否 → +1，如果 ≥3 → 在 results 头部插入 reminder 文本
```

插入的 reminder 是 `user` 消息的第一个 block（`results.unshift`），确保模型在处理工具结果之前先看到它。

### 为什么 `text` block 和 `tool_result` 可以混在一个 user 消息里？

Anthropic API 的 `user` 消息 content 是一个数组，可以包含多种 block 类型。这里把 reminder 文本和工具结果放在同一条 user 消息里，减少了 API 调用的消息数量，保持历史简洁。

## 关键细节

- `tool_use_id` 必须与对应的 `tool_use` block 的 `id` 字段完全一致，否则 API 拒绝请求
- `max_tokens: 8000` 是单次响应上限，不是对话总上限
- `console.log` 打印工具调用是调试 trace，方便看到 agent 正在做什么
