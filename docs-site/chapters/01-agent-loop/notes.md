# 第一章实现笔记

## 设计决策记录

### 为什么用 AsyncGenerator 而不是 callback 或 EventEmitter？

**问题：** 实现流式 Agent Loop 时，如何把"边执行边产生"的事件传递给调用方？

**市面上的做法：**

- **LangChain：** 使用 callback 机制（`CallbackHandler`），调用方注册 `onLLMStart`、`onToolStart` 等事件钩子。灵活但难以组合，回调地狱风险高。
- **OpenAI Codex：** 使用 `EventEmitter`，类似 Node.js 的事件系统。
- **Claude Code：** `query()` 是 `AsyncGenerator`，调用方用 `for await ... of` 消费事件，整个调用链是线性的、可组合的。

**我们的选择：** AsyncGenerator，和 Claude Code 一致。

**理由：**
- `for await...of` 让调用方的代码是**线性的**，比注册回调更好读
- AsyncGenerator 可以自然地**暂停/恢复**，配合 `yield` 天然支持背压
- 可以被 `for await...of` 消费，也可以被其他 AsyncGenerator `yield*` 转发，**组合性极好**
- TypeScript 类型推断更友好：`AsyncGenerator<QueryEvent>` 比 callback 参数更清晰

**代价：** 相比 callback，调用方必须主动消费（`for await...of`），不能"注册后忘记"。对我们的场景来说这不是问题。

---

### 为什么 LoopState 用对象而不是多个独立变量？

**问题：** Agent Loop 需要跨迭代维护状态（messages、turnCount 等），如何组织这些状态？

**直觉做法：**
```ts
let messages = [...params.messages]
let turnCount = 0
// 每次迭代分别更新...
```

**Claude Code 的做法（`query.ts` 第 204 行）：**
```ts
let state: State = { messages, toolUseContext, turnCount, ... }
while (true) {
  const { messages, turnCount } = state  // 每次迭代顶部解构
  // ...
  state = { ...state, messages: newMessages, turnCount: turnCount + 1 }  // continue 点整体赋值
}
```

**我们的选择：** 使用 state 对象，每次迭代顶部解构。

**理由：**
- 多个独立变量在循环里容易产生"部分更新"的 bug——更新了 `messages` 却忘了更新 `toolUseContext`
- State 对象让"本次迭代用什么状态"一目了然
- `continue` 点整体赋值新 state，避免隐式的跨迭代状态突变

---

### 工具执行失败时，为什么不直接抛出异常？

**问题：** 工具执行出错（文件不存在、命令失败），应该怎么处理？

**直觉做法：** `throw new Error('File not found')`，让上层 catch。

**Claude Code 的做法：** 把错误包装成 `tool_result` 传给 LLM：
```ts
{ type: 'tool_result', tool_use_id: id, content: '错误信息', is_error: true }
```

**我们的选择：** 与 Claude Code 一致，错误作为 tool_result 返回。

**理由：**
- LLM 可以**读到错误信息**，自主决定如何处理（重试、换方案、告知用户）
- 如果直接 throw，Loop 中断，LLM 完全不知道发生了什么
- 这是 Agent 系统"容错性"的核心设计：让 LLM 参与错误处理决策，而不是硬中断

**现实例子：** 用户让 Agent "修改 src/foo.ts"，但文件不存在。如果报错中断，用户需要重新来过。如果 LLM 收到 "File not found: src/foo.ts"，它可能会改为列出目录、找到正确路径，继续完成任务。

---

### 为什么 Engine 和 query() 分层？

**问题：** 为什么不直接在 `bin/index.ts` 里调用 `query()`，非要有一个 `Engine` 类？

**分层职责：**

| 层 | 知道什么 | 不知道什么 |
|----|---------|-----------|
| `query()` | 如何驱动一轮 Agent loop | 历史消息怎么来的、用户从哪里交互 |
| `Engine` | 如何维护多轮历史 | CLI 参数、TTY 还是 pipe |
| `bin/index.ts` | 用户输入从哪来、如何显示 | Agent 内部怎么运行 |

**这和 Claude Code 的分层一致：**
- `query.ts` — raw loop
- `QueryEngine.ts` — 会话管理
- `screens/REPL.tsx` — UI

**好处：** 每层可以独立测试。测试 `query()` 时用 mock provider，测试 `Engine` 时用 mock `query()`，不需要真实 API 调用。

---

### 第一章为什么不做 Provider 抽象？

**问题：** 已经知道最终要支持 Anthropic + OpenAI 两个 provider，为什么不一开始就做抽象？

**我们的选择：** 先直连，第三章再抽象。

**理由：**
- **YAGNI（You Aren't Gonna Need It）**：在只有一个 provider 时，抽象层是纯开销
- **抽象来自具体**：没实现过直连代码，就不知道抽象的边界在哪里
- **学习目标**：先理解"直连长什么样"，才能感受"抽象解决了什么问题"

第三章重构时，你会深刻体会到：`AnthropicProvider` 和 `OpenAIProvider` 之间有哪些差异需要被抽象屏蔽，`LLMProvider` 接口的边界应该画在哪里。
