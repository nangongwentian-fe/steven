# 工具系统概览

**文件：** `src/tools/index.ts` · 97 行

工具系统由两部分组成：**TOOLS 声明数组**（告诉模型有哪些工具）和 **runTool 分发器**（执行模型选择的工具）。

## 模块职责

- 用 Anthropic Tool Schema 格式声明所有可用工具
- 提供统一的 `runTool(name, input) → string` 接口
- 将工具调用路由到具体实现模块

## 工具清单

| 工具名 | 描述 | 实现文件 |
|--------|------|----------|
| `bash` | 执行 Shell 命令 | `tools/bash.ts` |
| `read_file` | 读取文件内容 | `tools/files.ts` |
| `write_file` | 写入文件 | `tools/files.ts` |
| `edit_file` | 替换文件中的精确文本 | `tools/files.ts` |
| `todo` | 更新任务列表 | `tools/todo.ts` |

## TOOLS 声明结构

```typescript
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "bash",
    description: "Run a shell command.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" }
      },
      required: ["command"]
    }
  },
  // ... 其余工具
];
```

每个工具遵循 **Anthropic Tool Schema** 格式：

- `name`：工具唯一标识，模型在 `tool_use` block 里用这个名字调用
- `description`：自然语言描述，模型根据这个决定什么时候调用
- `input_schema`：JSON Schema，定义工具接受的参数结构

## runTool 分发器

```typescript
export function runTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "bash": {
      const cmd = input.command as string;
      console.log(`\x1b[33m$ ${cmd}\x1b[0m`);
      return runBash(cmd);
    }
    case "read_file":
      return runRead(input.path as string, input.limit as number | undefined);
    case "write_file":
      return runWrite(input.path as string, input.content as string);
    case "edit_file":
      return runEdit(input.path as string, input.old_text as string, input.new_text as string);
    case "todo":
      return runTodo(input.items as TodoItem[]);
    default:
      return `Unknown tool: ${name}`;
  }
}
```

## 设计决策

### 统一 `(name, input) → string` 接口

所有工具的返回值都是 `string`。这个设计非常刻意：

1. **Anthropic API 的 `tool_result` content 是字符串**，统一返回字符串省去了序列化/反序列化
2. **错误也是字符串**：工具内部用 `try/catch` 捕获错误并返回 `"Error: ..."` 字符串，而不是抛出异常——模型可以看到错误信息并决定如何恢复
3. **测试简单**：`string` 输入、`string` 输出，无副作用接口天然易于单元测试

### 分发器模式 vs 注册表模式

这里用 `switch` 而不是 `Map<string, Function>` 注册表：

- **优点**：TypeScript 类型推断更直接，`input` 的类型转换在每个 case 里显式可见
- **代价**：添加新工具需要修改两处（TOOLS 数组 + switch case），但对于 MVP 规模，这是可接受的

### `bash` case 里为什么有额外的 `console.log`？

```typescript
case "bash": {
  console.log(`\x1b[33m$ ${cmd}\x1b[0m`);  // 黄色打印命令
  return runBash(cmd);
}
```

Bash 命令对用户最"危险"也最"有趣"，单独高亮打印出来，让用户实时看到 agent 在执行什么命令。文件操作则没有这层打印——因为 `agentLoop` 里已经有通用的 `> ${block.name}: ${output}` 日志。

## 关键细节

- `input` 参数类型是 `Record<string, unknown>`，与 Anthropic SDK 的 `tool_use` block input 类型对齐
- `default` 分支返回字符串而不是抛出异常，确保未知工具名不会崩溃整个 agent loop
