# steven-cli-typescript 设计文档

**日期：** 2026-04-03  
**路线：** steven-cli-typescript（纯 TypeScript，不依赖 Agent 框架）  
**目标：** 构建一个基础 Coding Agent CLI MVP，参考 Claude Code 架构设计

---

## 1. 项目结构与技术选型

### 目录结构

```
steven-cli-typescript/
├── bin/
│   └── index.ts              # CLI 入口（对标 Claude Code: src/entrypoints/cli.tsx）
├── src/
│   ├── core/
│   │   ├── query.ts          # Agent loop，AsyncGenerator（对标 Claude Code: src/query.ts）
│   │   └── engine.ts         # 会话级编排，管理消息历史（对标 Claude Code: src/QueryEngine.ts）
│   ├── services/
│   │   └── api/
│   │       ├── interface.ts  # LLMProvider 接口
│   │       ├── anthropic.ts  # Anthropic 实现（对标 Claude Code: src/services/api/claude.ts）
│   │       └── openai.ts     # OpenAI 实现
│   ├── tools/
│   │   ├── registry.ts       # defineTool 工厂 + 工具注册表（对标 Claude Code: src/tools.ts + buildTool）
│   │   ├── read-file.ts
│   │   ├── write-file.ts
│   │   ├── run-command.ts
│   │   ├── list-dir.ts
│   │   ├── grep.ts
│   │   └── view-range.ts
│   ├── types/
│   │   ├── message.ts        # Message 类型体系（对标 Claude Code: src/types/message.ts）
│   │   └── tool.ts           # Tool 接口类型
│   └── config.ts             # 环境变量 + 配置文件读取
├── package.json
└── tsconfig.json
```

### 技术选型

| 选型 | 决策 | 参考 |
|------|------|------|
| 运行时 | Bun（原生 TypeScript，无需编译） | Claude Code 使用 Bun runtime |
| Schema 验证 | Zod（工具 inputSchema 定义与校验） | Claude Code 工具 inputSchema 使用 Zod |
| REPL | Bun 内置 readline | — |
| Agent 框架 | 无（手写底层机制） | 学习目标 |
| CLI 参数解析 | 手写（MVP 阶段，保持简洁） | — |

---

## 2. Agent Loop（核心设计）

参考 Claude Code `src/query.ts` 的核心模式。

### 循环状态

```typescript
// 对标 Claude Code 的 State type（query.ts）
type LoopState = {
  messages: Message[]
  turnCount: number
}
```

每次迭代开头解构 state，`continue` 点整体赋值新 state，避免跨迭代的隐式状态突变。

### query() — AsyncGenerator

```typescript
// 流式 yield 事件，对标 Claude Code 的 query() AsyncGenerator
export async function* query(params: QueryParams): AsyncGenerator<QueryEvent> {
  let state: LoopState = { messages: params.messages, turnCount: 0 }

  while (true) {
    const { messages } = state  // 每次迭代顶部解构

    // 1. 调用 LLM（streaming，收集完整响应）
    // 2. 收集 tool_use 块
    // 3a. 有 tool_use → runTools() → 追加 tool_result → continue loop
    // 3b. 无 tool_use → yield 最终文本回复 → return（结束本轮）
    // 4.  工具执行出错 → 包装成 tool_result(is_error: true) 返给 LLM，不直接抛出
  }
}
```

### 工具并发策略

对标 Claude Code `src/services/tools/toolOrchestration.ts`：

- **`isReadOnly: true`**（read-file、list-dir、grep、view-range）→ 批量并发执行
- **`isReadOnly: false`**（write-file、run-command）→ 串行执行

### 分层职责

| 层 | 文件 | 职责 |
|----|------|------|
| Raw loop | `core/query.ts` | 纯 agent loop，不关心 UI 和会话管理 |
| 会话编排 | `core/engine.ts` | 维护多轮对话历史，处理 one-shot vs REPL 切换 |
| CLI 入口 | `bin/index.ts` | 参数解析，启动 engine |

---

## 3. Provider 抽象层

参考 Claude Code `src/utils/model/providers.ts` 和 `src/services/api/claude.ts`。

### Provider 接口（`services/api/interface.ts`）

```typescript
export type ProviderType = 'anthropic' | 'openai'

export interface LLMProvider {
  chat(messages: Message[], tools: ToolDefinition[]): AsyncIterable<LLMEvent>
}
```

### Provider 切换

对标 Claude Code 的环境变量驱动方式（`CLAUDE_CODE_USE_BEDROCK` 等）：

```
STEVEN_PROVIDER=anthropic  ANTHROPIC_API_KEY=sk-...
STEVEN_PROVIDER=openai     OPENAI_API_KEY=sk-...
```

- 未设置 `STEVEN_PROVIDER` 时默认 `anthropic`
- 配置文件 `~/.steven-cli/config.json` 作为备选，环境变量优先级更高
- Anthropic / OpenAI 的 tool_use 格式差异由各自的 provider 实现内部处理，`query.ts` 只看到统一的 `LLMEvent`

---

## 4. 工具系统

参考 Claude Code `src/Tool.ts` 的 `Tool` 接口与 `buildTool()` 工厂函数。

### Tool 接口（`types/tool.ts`）

```typescript
export interface Tool<TInput = unknown> {
  name: string
  description: string
  inputSchema: z.ZodObject<any>   // Zod schema，自动生成 JSON Schema 传给 LLM API
  isReadOnly: boolean              // 决定并发策略
  call(input: TInput): Promise<ToolResult>
}

export type ToolResult = {
  content: string
  isError?: boolean
}
```

### defineTool() 工厂（`tools/registry.ts`）

对标 Claude Code 的 `buildTool()`，填入默认值，减少样板代码：

```typescript
export function defineTool<T>(def: ToolDef<T>): Tool<T> {
  return {
    isReadOnly: false,   // 默认保守：assume write
    ...def,
  }
}
```

### MVP 工具集

| 工具 | isReadOnly | 说明 |
|------|-----------|------|
| read-file | true | 读取文件内容 |
| view-range | true | 读取文件指定行范围 |
| list-dir | true | 列出目录内容 |
| grep | true | 搜索文件内容 |
| write-file | false | 写入/创建文件 |
| run-command | false | 执行 shell 命令 |

---

## 5. CLI 入口与交互模式

### 参数设计

```
steven [options] [prompt]

Options:
  -p, --print     one-shot 模式（非交互，输出后退出）
  --provider      指定 provider（anthropic | openai）
  --model         指定模型

Examples:
  steven "帮我写一个 hello world"        # one-shot
  steven                                  # 启动 REPL
  echo "写个排序函数" | steven -p         # pipe 模式（one-shot）
```

### 模式切换逻辑

- 有 `prompt` 参数 或 `-p` 标志 → one-shot，执行完退出
- 无参数，stdin 是 TTY → 启动 REPL（readline 多轮对话）
- stdin 非 TTY（pipe）→ 自动进入 one-shot 模式

---

## 6. 错误处理原则

- 工具执行出错：包装为 `tool_result(is_error: true)` 返给 LLM，由 LLM 决策如何继续（对标 Claude Code）
- LLM API 错误：yield error 事件，engine 层决定是否重试或退出
- 未知工具名：返回 `tool_result(is_error: true, content: "Unknown tool: xxx")`

---

## 参考项目

| 文件 | 说明 |
|------|------|
| `references/claude-code/src/query.ts` | Agent loop 主参考 |
| `references/claude-code/src/QueryEngine.ts` | 会话编排主参考 |
| `references/claude-code/src/Tool.ts` | Tool 接口 + buildTool 模式 |
| `references/claude-code/src/services/api/claude.ts` | API 客户端实现 |
| `references/claude-code/src/utils/model/providers.ts` | Provider 切换模式 |
| `references/claude-code/src/services/tools/toolOrchestration.ts` | 工具并发策略 |
