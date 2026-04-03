# 第二章实现笔记

## 设计决策记录

### 为什么 Tool 的 inputSchema 用 Zod 而不是直接写 JSON Schema？

**问题：** 工具需要定义输入参数的结构，以便：
1. TypeScript 能推断参数类型（保证 `call()` 函数体里的类型安全）
2. 生成符合 Anthropic/OpenAI API 要求的 JSON Schema 传给 LLM

**市面上的做法：**

- **直接写 JSON Schema：** 最直接，零依赖。缺点是 TypeScript 无法从 JSON 对象推断类型，`call(input)` 里 `input` 是 `any`，容易写错字段名或忘记必填字段。
- **Zod（我们的选择，和 Claude Code 一致）：** 先定义 Zod schema，用 `z.toJSONSchema()` 生成 JSON Schema 传给 API，TypeScript 用 `z.infer<typeof schema>` 推断参数类型。一套定义，两个用途。
- **io-ts / Valibot / ArkType：** 设计理念相似，但生态较小，且 Claude Code 用 Zod，有参考价值。

**我们的选择：** Zod。

**理由：**
- `z.infer<typeof schema>` 让 `call(input: ...)` 获得完整的 TypeScript 类型推断，字段名拼错时编译就报错
- `z.toJSONSchema(schema)` 自动生成 JSON Schema，不需要维护"TypeScript 类型定义"和"JSON Schema 描述"两套内容
- Zod 是 TypeScript 生态最主流的运行时验证库，不只在工具定义里用到，后续还会用在 API 边界

**版本注意：** Zod v4（`zod@^4.0.0`）将 JSON Schema 生成从第三方包 `zod-to-json-schema` 改成了内置的 `z.toJSONSchema(schema)`，不需要额外安装依赖。

---

### defineTool() 的"保守默认"原则

**问题：** 工具是否有副作用（修改文件、执行命令）应该怎么标记？漏标了会怎样？

**两种默认值策略：**

- **`isReadOnly: true`（乐观默认）：** 认为工具默认是安全的，需要副作用的工具显式声明 `isReadOnly: false`。好处是方便（只读工具不需要标注），坏处是漏标写工具时，可能被并发执行，产生数据竞争。
- **`isReadOnly: false`（保守默认，Claude Code 的做法）：** 认为工具默认可能修改状态，只读工具需要显式声明 `isReadOnly: true`。

**我们的选择：** `isReadOnly: false`（保守默认），和 Claude Code 的 `TOOL_DEFAULTS` 一致。

**理由：** 保守原则（fail safe）——两种漏标的后果不对称：

| 漏标场景 | 结果 | 严重性 |
|---------|------|--------|
| 写工具漏标 isReadOnly: false（乐观默认的漏标） | 被并发执行 → 文件系统竞争 → 难以复现的 bug | **严重** |
| 只读工具漏标 isReadOnly: true（保守默认的漏标） | 退化为串行执行 → 性能稍差 | **无害** |

宁可慢一点，不要出错。

---

### 为什么 Grep 工具直接调用系统 grep，而不是用 Node.js 实现？

**问题：** 实现文件内容搜索，有多种方案。

**方案对比：**

- **纯 Node.js 实现：** `fs.readdirSync` 递归遍历文件，逐行 `String.match()`。代码量大、性能差、正则支持不完整（比如多行匹配），而且还要自己实现"跳过 .git 目录"。
- **ripgrep Node 绑定（`@vscode/ripgrep`）：** VS Code 的选择，性能极佳，支持 `.gitignore` 规则。缺点是引入原生二进制依赖，跨平台打包和调试变复杂。
- **直接调用系统 grep（我们的做法）：** 一行 `Bun.spawnSync(['grep', '-rn', pattern, path])`，真正的 POSIX 正则、递归搜索、行号输出——全部内置。

**我们的选择：** 直接调用系统 `grep`。

**理由：** 学习项目里，简单且正确优先于性能最优。`grep` 是 Unix 标准工具，macOS/Linux 上随时可用。我们的 `Grep` 工具本质上是"帮 LLM 正确组装 grep 参数的封装层"，核心是接口设计，不是算法实现。

**代价：** Windows 原生环境没有 grep（需要安装 Git for Windows 或 WSL）。生产级工具（如 Claude Code）使用 `ripgrep` 来规避这个问题，同时获得 `.gitignore` 感知和更好的性能。

---

### 工具并发执行：为什么"先只读，再写入"？

**问题：** 一次 LLM 响应可能包含多个 `tool_use` 块，应该怎么决定执行顺序？

**策略对比：**

- **全串行（第一章的实现）：** 最简单，但慢。LLM 同时要读 3 个文件时，需要等 3 次。
- **全并发：** 最快，但危险。如果 LLM 同时请求了 `Read("a.ts")` 和 `Write("a.ts", ...)`，并发执行结果不可预测。
- **分组并发（Claude Code 的做法）：** 只读工具 `Promise.all()` 并发，写工具串行，且**只读组执行完再执行写工具**。

**我们的选择：** 分组并发，参考 `references/claude-code/src/services/tools/toolOrchestration.ts` 里的 `partitionToolCalls()`。

**理由：**
- 只读工具（`Read`、`LS`、`Grep`、`ViewRange`）之间没有副作用，并发完全安全
- 写工具（`Write`、`Bash`）必须串行，避免文件系统竞争
- 只读工具先于写工具执行：确保写操作看到"干净"的初始状态，不会读到本轮写到一半的中间状态

**现实例子：** LLM 让 Agent "读取 3 个文件，合并内容写入第 4 个"，可能产生 4 个 tool_use 块。正确执行顺序：3 个 Read 并发完成 → Write 串行执行。

---

### ALL_TOOLS 显式注册 vs 自动发现

**问题：** 如何让 Agent Loop 知道"有哪些工具可用"？

**方案对比：**

- **自动发现（装饰器/文件扫描）：** 用 `@tool` 装饰器或扫描特定目录，框架自动收集所有工具。加工具时不需要改注册表，但依赖"隐式魔法"——工具是否生效，取决于文件在不在正确目录、装饰器是否正确应用。
- **显式注册（我们的做法）：** 在 `registry.ts` 里手动维护 `ALL_TOOLS` 数组，每加一个工具加一行 import。

**我们的选择：** 显式注册。

**理由：**
- 显式优于隐式：直接看 `ALL_TOOLS` 就知道 Agent 能做什么，不需要了解框架约定
- 控制顺序：工具数组顺序影响 LLM system prompt 里的工具列表，只读工具排前面，LLM 先看到
- 易于按条件裁剪：实现"只读模式"时，直接 `ALL_TOOLS.filter(t => t.isReadOnly)` 即可

**代价：** 加新工具时要记得来 `registry.ts` 加一行 import。这点轻微的维护成本，换来了完全的透明性。
