# 入口层 (index.ts)

**文件：** `index.ts` · 34 行

入口层承担两件事：维护一个 REPL（Read-Eval-Print Loop），以及管理贯穿整个会话的对话历史。

## 模块职责

- 创建 readline 接口，接受用户输入
- 维护 `history: MessageParam[]`，让多轮对话保持上下文
- 调用 `agentLoop(history)` 并打印最终文本输出
- 处理退出条件（`q` / `exit` / 空输入）

## 核心代码

```typescript
async function main() {
  const history: Anthropic.MessageParam[] = [];
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () =>
    new Promise<string>(resolve =>
      rl.question("\x1b[36ms01 >> \x1b[0m", resolve)
    );

  while (true) {
    const query = await prompt();
    if (["q", "exit", ""].includes(query.trim().toLowerCase())) {
      break;
    }
    history.push({ role: "user", content: query });
    await agentLoop(history);

    const lastMsg = history[history.length - 1]!;
    if (Array.isArray(lastMsg.content)) {
      for (const block of lastMsg.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
    }
    console.log();
  }
  rl.close();
}
```

## 设计决策

### 为什么用 `history` 数组而不是每次重新构建消息？

`history` 是 Anthropic API 的 **上下文窗口**。把每轮的 user/assistant 消息都追加进去，模型在下一轮就能看到完整的对话历史，从而实现多轮记忆。

如果每次只传当前问题，模型就是无状态的——无法引用之前的文件内容、任务进度或已有结论。

### `agentLoop` 直接修改 `history`（传引用）

`agentLoop` 接受 `history` 数组并在内部执行 `messages.push()`，这意味着 agent 运行完毕后，`history` 已经包含了本轮所有的 assistant 响应和 tool_result。

入口层不需要手动收集返回值，直接读 `history[history.length - 1]` 就是最新状态。

### 退出条件为何包含空字符串？

防止用户意外敲回车后陷入无限等待。空输入视为"无操作，退出"是防御性的 UX 选择。

## 关键细节

| 细节 | 说明 |
|------|------|
| `\x1b[36m` | ANSI 青色，让提示符 `s01 >>` 在终端中视觉突出 |
| `rl.close()` | 必须调用，否则进程不会正常退出（readline 持有 stdin） |
| `Array.isArray(lastMsg.content)` | assistant 响应的 content 可能是 string 或 Block[]，此处做类型保护 |
