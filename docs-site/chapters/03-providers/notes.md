# 第三章实现笔记

## 设计决策记录

### 为什么抽象边界在 Provider.call()，而不在 query.ts 内部分支？

**问题：** Provider 抽象的边界有多种画法。最简单的是在 query.ts 内部判断：

```ts
// 方案 A：query.ts 内部分支
if (params.providerName === 'anthropic') {
  yield* callAnthropic(...)
} else if (params.providerName === 'openai') {
  yield* callOpenAI(...)
}
```

**我们的选择：** 定义 `LLMProvider` 接口，query.ts 只调用 `params.provider.call()`。

**理由：**

方案 A 每加一个 Provider 就要修改 query.ts。这违背了"开闭原则"——**代码应该对扩展开放，对修改关闭**。

更深层的问题：如果 query.ts 需要知道"你是 Anthropic 还是 OpenAI"，就说明 query.ts 承担了它不该承担的职责。Agent Loop 的核心逻辑（what to do）应该和"如何调用哪个 LLM"（how to call）完全分离。

**类比：** 你写一个 `saveFile()` 函数，不需要在里面判断"是存本地还是存 S3"——你传入一个 `Storage` 接口，函数只调用 `storage.write()`。Provider 抽象是同一个道理。

---

### 为什么消息格式转换在 Provider 内部，而不是在 query.ts 里统一转换？

**问题：** 我们的内部 `Message[]` 格式和 Anthropic/OpenAI 的格式都不一样，转换代码放在哪里？

**方案对比：**

- **放在 query.ts（集中转换）：** query.ts 变成 `switch(provider) { case anthropic: toAnthropicMessages(...) }`。等同于方案 A，逃不掉分支判断。
- **放在每个 Provider 内部（我们的做法）：** `AnthropicProvider.call()` 内部做 Anthropic 转换，`OpenAIProvider.call()` 内部做 OpenAI 转换。

**我们的选择：** 格式转换在 Provider 内部。

**理由：** "如何把通用 Message 格式转成 Anthropic 格式"是 Anthropic Provider 的私有知识，不应该泄漏到 Agent Loop 里。这符合封装原则——接口的调用方（query.ts）不需要知道接口实现的细节（格式差异）。

**代价：** 如果将来内部 `Message[]` 格式发生变化，每个 Provider 的转换函数都需要同步更新。但这是合理的代价——格式变化本来就应该影响所有 Provider。

---

### 为什么用环境变量（STEVEN_PROVIDER）选择 Provider，而不是 CLI 参数？

**问题：** 切换 Provider 的方式有多种。

**方案对比：**

- **CLI 参数：** `bun run index.ts --provider openai -p "hello"`。每次运行都要指定，麻烦。
- **配置文件（`~/.stevenrc`）：** 持久化，但需要实现配置文件读取逻辑。
- **环境变量（`STEVEN_PROVIDER`）：** 可以持久化（在 `.zshrc`/`.bashrc` 里 `export STEVEN_PROVIDER=openai`），也可以临时覆盖（`STEVEN_PROVIDER=openai bun run ...`），零实现成本。

**我们的选择：** 环境变量。

**理由：**
- 12-Factor App 原则：外部配置（provider 选择、API key）放在环境变量里
- 符合用户习惯：开发者对 `ANTHROPIC_API_KEY` 这类环境变量很熟悉
- 临时覆盖方便：`STEVEN_PROVIDER=openai bun run ...` 无需改文件
- Claude Code 本身也大量使用环境变量做配置

---

### Provider 内部处理流式累积，还是在外部处理？

**问题：** Anthropic 和 OpenAI 都是流式返回工具调用参数（分多个 chunk）。这个"累积 partial JSON"的逻辑应该在哪里？

**方案对比：**

- **暴露原始流（外部处理）：** Provider yield 出原始的 `text_delta` 和 `tool_use_delta`，query.ts 自己累积工具调用参数。query.ts 就需要知道"存在流式工具参数"这件事，增加了 loop 的复杂度。
- **内部处理，对外暴露完整事件（我们的做法）：** Provider 内部累积 `partial_json` / `arguments`，只有当整个工具调用参数完整时才 yield `{ type: 'tool_use', input: ... }`。query.ts 看到的 `tool_use` 永远是完整的。

**我们的选择：** Provider 内部处理，对外 yield 完整事件。

**理由：** query.ts 需要关心"LLM 要调用哪个工具、参数是什么"，但不需要关心"工具调用参数是怎么流式传输过来的"。把流式累积封装在 Provider 内部，是降低 query.ts 复杂度的正确做法。

**深层原因：** Anthropic 的流式工具参数用 `input_json_delta` 事件；OpenAI 的用 `tool_calls[i].function.arguments` 增量。两者累积方式不同，对外接口一样（完整的 `input` 对象）。这正是抽象的价值——屏蔽差异，暴露一致。

---

### 第一章为什么不做这个抽象？

这个问题在[第一章实现笔记](../01-agent-loop/notes)里有答案，但值得再强调一遍。

**YAGNI（You Aren't Gonna Need It）：** 在只有一个 Provider 时，`LLMProvider` 接口是纯开销。接口需要维护、需要文档、需要理解"为什么这里有一层间接"——如果没有切实的收益，这都是不必要的成本。

**抽象来自重复：** 你不写第二个 Provider，就不知道抽象的边界应该画在哪里。第三章的 `LLMProvider` 接口，是在你已经看到 AnthropicProvider 和 OpenAIProvider 的差异之后，自然得出的结论，而不是凭空设计的。

**学习顺序：** 先实现直连，感受"直连的样子"；再看重复，理解"抽象解决的问题"；最后设计接口，知道"边界应该画在哪里"。跳过前两步直接学第三步，你会得到一个死记硬背的模式，而不是真正的理解。
