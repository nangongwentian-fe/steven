# 系统配置

**文件：** `src/config.ts` · 5 行

配置层只有 3 个导出常量，但它们是整个系统的"锚点"——模型选择、工作目录、行为指导都从这里来。

## 核心代码

```typescript
export const MODEL = process.env.MODEL_ID || "claude-sonnet-4-6";
export const WORKDIR = process.cwd();
export const SYSTEM = `You are a coding agent at ${WORKDIR}.
Use the todo tool to plan multi-step tasks. Mark in_progress before starting, completed when done.
Prefer tools over prose.`;
```

## 三个常量的设计

### `MODEL`：环境变量优先

```bash
# 默认使用 claude-sonnet-4-6
bun index.ts

# 切换到 claude-opus-4-6
MODEL_ID=claude-opus-4-6 bun index.ts
```

默认值硬编码 `claude-sonnet-4-6`，这是性价比最高的选择：速度快、上下文长、工具调用稳定。通过环境变量覆盖，无需改代码就能切换模型做对比测试。

### `WORKDIR`：启动时快照

```typescript
export const WORKDIR = process.cwd();
```

`process.cwd()` 在模块加载时执行一次，之后就是常量。这意味着：

- Agent 的文件操作沙箱（`safePath`）以启动目录为根
- 在哪个目录启动 CLI，工具就只能操作那个目录及其子目录

**实际效果：** 在项目根目录跑 `bun index.ts`，agent 就只能读写这个项目，不会越界。

### `SYSTEM`：三条指令的选择

```
You are a coding agent at ${WORKDIR}.
Use the todo tool to plan multi-step tasks. Mark in_progress before starting, completed when done.
Prefer tools over prose.
```

| 句子 | 作用 |
|------|------|
| `at ${WORKDIR}` | 告诉模型当前工作目录，让路径引用有上下文 |
| `Use the todo tool...` | 强制任务规划行为，防止模型直接动手却不追踪进度 |
| `Prefer tools over prose` | 避免模型用大段文字"解释"而不实际执行操作 |

## 设计决策

### 为什么 SYSTEM 里不列出所有可用工具？

Anthropic API 会把 `tools` 数组里的工具名和描述自动注入到 system prompt 的末尾。不需要手动重复列出——这样避免了两处描述不一致的风险。

### 为什么 WORKDIR 不是可配置的？

MVP 设计选择：`process.cwd()` 已经足够——用户在哪个目录启动，就在哪个目录工作。更复杂的多工作区支持可以后续加参数，但当前无需设计。

## 关键细节

- `config.ts` 是被多个模块引用的叶节点（`agent.ts`、`files.ts`），保持它无副作用、无异步操作很重要
- `MODEL` 变量名用于 Anthropic API 的 `model` 字段，拼写需与 API 支持的 model ID 完全一致
