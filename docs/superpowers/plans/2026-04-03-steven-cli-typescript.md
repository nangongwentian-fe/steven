# steven-cli-typescript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Coding Agent CLI MVP in pure TypeScript/Bun with 6 tools, Anthropic + OpenAI providers, and both one-shot and REPL interaction modes.

**Architecture:** Agent loop (`core/query.ts`) is an `AsyncGenerator` yielding events (inspired by Claude Code's `query.ts`). Read-only tools run concurrently, write tools run serially (inspired by `toolOrchestration.ts`). Provider differences are encapsulated behind a `LLMProvider` interface. Session management lives in `engine.ts`.

**Tech Stack:** Bun runtime, TypeScript, Zod v4, `@anthropic-ai/sdk`, `openai`

---

## File Map

| File | Responsibility |
|------|----------------|
| `package.json` | Bun project config + dependencies |
| `tsconfig.json` | TypeScript compiler config |
| `src/types/message.ts` | `Message`, `ContentBlock` type hierarchy |
| `src/types/tool.ts` | `Tool`, `ToolResult`, `ToolDef` types |
| `src/tools/registry.ts` | `defineTool()` factory + `ALL_TOOLS` registry |
| `src/tools/read-file.ts` | Read entire file |
| `src/tools/view-range.ts` | Read file line range |
| `src/tools/list-dir.ts` | List directory contents |
| `src/tools/grep.ts` | Search file content by pattern |
| `src/tools/write-file.ts` | Write/create file |
| `src/tools/run-command.ts` | Execute shell command via Bun |
| `src/services/api/interface.ts` | `LLMProvider`, `LLMEvent`, `ToolDefinition` types |
| `src/services/api/anthropic.ts` | Anthropic SDK provider implementation |
| `src/services/api/openai.ts` | OpenAI SDK provider implementation |
| `src/config.ts` | Read provider + API key from env / config file |
| `src/core/query.ts` | `query()` AsyncGenerator loop + `runTools()` |
| `src/core/engine.ts` | Session state, one-shot and REPL modes |
| `bin/index.ts` | CLI entry: parse args, start engine |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `steven-cli-typescript/package.json`
- Create: `steven-cli-typescript/tsconfig.json`

- [ ] **Step 1: Create the project directory and package.json**

```bash
cd /Users/zhengwenjie/Documents/People/steven/steven-cli-typescript
```

Create `package.json`:
```json
{
  "name": "steven-cli-typescript",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "steven": "./bin/index.ts"
  },
  "scripts": {
    "dev": "bun run bin/index.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.51.0",
    "openai": "^4.85.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "bin/**/*"]
}
```

- [ ] **Step 3: Install dependencies**

```bash
bun install
```

Expected: `bun install` completes, `node_modules/` and `bun.lockb` created.

- [ ] **Step 4: Create directory structure**

```bash
mkdir -p src/types src/tools src/services/api src/core bin
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/
git -C /Users/zhengwenjie/Documents/People/steven commit -m "chore: scaffold steven-cli-typescript project"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/message.ts`
- Create: `src/types/tool.ts`
- Create: `src/types/message.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/types/message.test.ts`:
```typescript
import { describe, test, expect } from 'bun:test'
import type { Message, TextBlock, ToolUseBlock, ToolResultBlock } from './message'

describe('Message types', () => {
  test('user message with string content is valid', () => {
    const msg: Message = { role: 'user', content: 'hello' }
    expect(msg.role).toBe('user')
    expect(msg.content).toBe('hello')
  })

  test('assistant message with ContentBlock array is valid', () => {
    const textBlock: TextBlock = { type: 'text', text: 'hello' }
    const msg: Message = { role: 'assistant', content: [textBlock] }
    expect(Array.isArray(msg.content)).toBe(true)
  })

  test('tool_use block has id, name, input', () => {
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_01',
      name: 'Read',
      input: { file_path: '/tmp/foo.ts' },
    }
    expect(block.type).toBe('tool_use')
    expect(block.id).toBe('toolu_01')
  })

  test('tool_result block has tool_use_id, content, optional is_error', () => {
    const block: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'toolu_01',
      content: 'file contents',
    }
    expect(block.is_error).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/zhengwenjie/Documents/People/steven/steven-cli-typescript && bun test src/types/message.test.ts
```

Expected: error — `Cannot find module './message'`

- [ ] **Step 3: Write message.ts**

Create `src/types/message.ts`:
```typescript
export type TextBlock = {
  type: 'text'
  text: string
}

export type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

export type Message = {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}
```

- [ ] **Step 4: Write tool.ts**

Create `src/types/tool.ts`:
```typescript
import type { z } from 'zod'

export type ToolResult = {
  content: string
  isError?: boolean
}

export interface Tool<TInput = unknown> {
  name: string
  description: string
  inputSchema: z.ZodObject<z.ZodRawShape>
  isReadOnly: boolean
  call(input: TInput): Promise<ToolResult>
}

// ToolDef is what callers pass to defineTool() — isReadOnly is optional (defaults to false)
export type ToolDef<TInput> = Omit<Tool<TInput>, 'isReadOnly'> & {
  isReadOnly?: boolean
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun test src/types/message.test.ts
```

Expected:
```
✓ user message with string content is valid
✓ assistant message with ContentBlock array is valid
✓ tool_use block has id, name, input
✓ tool_result block has tool_use_id, content, optional is_error

4 pass, 0 fail
```

- [ ] **Step 6: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/src/types/
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add Message and Tool type definitions"
```

---

## Task 3: Tool Registry

**Files:**
- Create: `src/tools/registry.ts`
- Create: `src/tools/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tools/registry.test.ts`:
```typescript
import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
import { defineTool } from './registry'

describe('defineTool', () => {
  test('fills isReadOnly default to false', () => {
    const tool = defineTool({
      name: 'TestTool',
      description: 'A test tool',
      inputSchema: z.object({ value: z.string() }),
      async call(input) {
        return { content: input.value }
      },
    })
    expect(tool.isReadOnly).toBe(false)
  })

  test('preserves explicit isReadOnly: true', () => {
    const tool = defineTool({
      name: 'ReadTool',
      description: 'A read tool',
      inputSchema: z.object({ path: z.string() }),
      isReadOnly: true,
      async call() {
        return { content: '' }
      },
    })
    expect(tool.isReadOnly).toBe(true)
  })

  test('call() returns ToolResult', async () => {
    const tool = defineTool({
      name: 'EchoTool',
      description: 'Echoes input',
      inputSchema: z.object({ msg: z.string() }),
      async call(input) {
        return { content: input.msg }
      },
    })
    const result = await tool.call({ msg: 'hello' })
    expect(result.content).toBe('hello')
    expect(result.isError).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/tools/registry.test.ts
```

Expected: `Cannot find module './registry'`

- [ ] **Step 3: Write registry.ts**

Create `src/tools/registry.ts`:
```typescript
import type { Tool, ToolDef } from '../types/tool'

export function defineTool<TInput>(def: ToolDef<TInput>): Tool<TInput> {
  return {
    isReadOnly: false,
    ...def,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/tools/registry.test.ts
```

Expected:
```
✓ fills isReadOnly default to false
✓ preserves explicit isReadOnly: true
✓ call() returns ToolResult

3 pass, 0 fail
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/src/tools/registry.ts steven-cli-typescript/src/tools/registry.test.ts
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add defineTool factory"
```

---

## Task 4: File Tools (read-file, write-file, view-range)

**Files:**
- Create: `src/tools/read-file.ts`
- Create: `src/tools/write-file.ts`
- Create: `src/tools/view-range.ts`
- Create: `src/tools/file-tools.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tools/file-tools.test.ts`:
```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { readFileTool } from './read-file'
import { writeFileTool } from './write-file'
import { viewRangeTool } from './view-range'

const TMP = '/tmp/steven-cli-test'

beforeEach(() => {
  mkdirSync(TMP, { recursive: true })
})

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
})

describe('readFileTool', () => {
  test('reads file contents', async () => {
    const path = join(TMP, 'hello.txt')
    writeFileSync(path, 'hello world')
    const result = await readFileTool.call({ file_path: path })
    expect(result.content).toBe('hello world')
    expect(result.isError).toBeUndefined()
  })

  test('returns error for nonexistent file', async () => {
    const result = await readFileTool.call({ file_path: '/tmp/nonexistent_file_abc123.txt' })
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Error')
  })

  test('isReadOnly is true', () => {
    expect(readFileTool.isReadOnly).toBe(true)
  })
})

describe('writeFileTool', () => {
  test('writes file contents', async () => {
    const path = join(TMP, 'out.txt')
    const result = await writeFileTool.call({ file_path: path, content: 'written content' })
    expect(result.isError).toBeUndefined()
    const read = await readFileTool.call({ file_path: path })
    expect(read.content).toBe('written content')
  })

  test('creates parent directories if needed', async () => {
    const path = join(TMP, 'nested/dir/file.txt')
    const result = await writeFileTool.call({ file_path: path, content: 'nested' })
    expect(result.isError).toBeUndefined()
  })

  test('isReadOnly is false', () => {
    expect(writeFileTool.isReadOnly).toBe(false)
  })
})

describe('viewRangeTool', () => {
  test('returns lines start_line to end_line (1-indexed, inclusive)', async () => {
    const path = join(TMP, 'lines.txt')
    writeFileSync(path, 'line1\nline2\nline3\nline4\nline5')
    const result = await viewRangeTool.call({ file_path: path, start_line: 2, end_line: 4 })
    expect(result.content).toBe('line2\nline3\nline4')
    expect(result.isError).toBeUndefined()
  })

  test('returns error for nonexistent file', async () => {
    const result = await viewRangeTool.call({ file_path: '/no/such/file.txt', start_line: 1, end_line: 5 })
    expect(result.isError).toBe(true)
  })

  test('isReadOnly is true', () => {
    expect(viewRangeTool.isReadOnly).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/tools/file-tools.test.ts
```

Expected: `Cannot find module './read-file'`

- [ ] **Step 3: Write read-file.ts**

Create `src/tools/read-file.ts`:
```typescript
import { readFileSync } from 'fs'
import { z } from 'zod'
import { defineTool } from './registry'

export const readFileTool = defineTool({
  name: 'Read',
  description: 'Read the full contents of a file at the given absolute path.',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute path to the file to read'),
  }),
  isReadOnly: true,
  async call({ file_path }) {
    try {
      const content = readFileSync(file_path, 'utf-8')
      return { content }
    } catch (err) {
      return { content: `Error reading file: ${(err as Error).message}`, isError: true }
    }
  },
})
```

- [ ] **Step 4: Write write-file.ts**

Create `src/tools/write-file.ts`:
```typescript
import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { z } from 'zod'
import { defineTool } from './registry'

export const writeFileTool = defineTool({
  name: 'Write',
  description: 'Write content to a file at the given absolute path. Creates parent directories if needed.',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute path to the file to write'),
    content: z.string().describe('Content to write to the file'),
  }),
  isReadOnly: false,
  async call({ file_path, content }) {
    try {
      mkdirSync(dirname(file_path), { recursive: true })
      writeFileSync(file_path, content, 'utf-8')
      return { content: `File written successfully: ${file_path}` }
    } catch (err) {
      return { content: `Error writing file: ${(err as Error).message}`, isError: true }
    }
  },
})
```

- [ ] **Step 5: Write view-range.ts**

Create `src/tools/view-range.ts`:
```typescript
import { readFileSync } from 'fs'
import { z } from 'zod'
import { defineTool } from './registry'

export const viewRangeTool = defineTool({
  name: 'ViewRange',
  description: 'Read a specific line range of a file (1-indexed, inclusive).',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    start_line: z.number().int().min(1).describe('First line to read (1-indexed)'),
    end_line: z.number().int().min(1).describe('Last line to read (1-indexed, inclusive)'),
  }),
  isReadOnly: true,
  async call({ file_path, start_line, end_line }) {
    try {
      const content = readFileSync(file_path, 'utf-8')
      const lines = content.split('\n')
      const selected = lines.slice(start_line - 1, end_line)
      return { content: selected.join('\n') }
    } catch (err) {
      return { content: `Error reading file: ${(err as Error).message}`, isError: true }
    }
  },
})
```

- [ ] **Step 6: Run test to verify it passes**

```bash
bun test src/tools/file-tools.test.ts
```

Expected:
```
✓ reads file contents
✓ returns error for nonexistent file
✓ isReadOnly is true
✓ writes file contents
✓ creates parent directories if needed
✓ isReadOnly is false
✓ returns lines start_line to end_line (1-indexed, inclusive)
✓ returns error for nonexistent file
✓ isReadOnly is true

9 pass, 0 fail
```

- [ ] **Step 7: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/src/tools/read-file.ts steven-cli-typescript/src/tools/write-file.ts steven-cli-typescript/src/tools/view-range.ts steven-cli-typescript/src/tools/file-tools.test.ts
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add read-file, write-file, view-range tools"
```

---

## Task 5: System Tools (run-command, list-dir, grep)

**Files:**
- Create: `src/tools/run-command.ts`
- Create: `src/tools/list-dir.ts`
- Create: `src/tools/grep.ts`
- Create: `src/tools/system-tools.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tools/system-tools.test.ts`:
```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { runCommandTool } from './run-command'
import { listDirTool } from './list-dir'
import { grepTool } from './grep'

const TMP = '/tmp/steven-cli-system-test'

beforeEach(() => {
  mkdirSync(TMP, { recursive: true })
  writeFileSync(join(TMP, 'a.ts'), 'export const foo = 1\nexport const bar = 2')
  writeFileSync(join(TMP, 'b.ts'), 'import { foo } from "./a"\nconsole.log(foo)')
  mkdirSync(join(TMP, 'sub'), { recursive: true })
  writeFileSync(join(TMP, 'sub/c.ts'), 'const x = 3')
})

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
})

describe('runCommandTool', () => {
  test('runs a command and returns stdout', async () => {
    const result = await runCommandTool.call({ command: 'echo hello' })
    expect(result.content).toContain('hello')
    expect(result.isError).toBeUndefined()
  })

  test('returns error output for failing command', async () => {
    const result = await runCommandTool.call({ command: 'cat /nonexistent_file_abc123' })
    expect(result.isError).toBe(true)
  })

  test('isReadOnly is false', () => {
    expect(runCommandTool.isReadOnly).toBe(false)
  })
})

describe('listDirTool', () => {
  test('lists directory contents', async () => {
    const result = await listDirTool.call({ path: TMP })
    expect(result.content).toContain('a.ts')
    expect(result.content).toContain('b.ts')
    expect(result.content).toContain('sub')
    expect(result.isError).toBeUndefined()
  })

  test('returns error for nonexistent directory', async () => {
    const result = await listDirTool.call({ path: '/no/such/dir_abc123' })
    expect(result.isError).toBe(true)
  })

  test('isReadOnly is true', () => {
    expect(listDirTool.isReadOnly).toBe(true)
  })
})

describe('grepTool', () => {
  test('finds matching lines', async () => {
    const result = await grepTool.call({ pattern: 'foo', path: TMP })
    expect(result.content).toContain('foo')
    expect(result.isError).toBeUndefined()
  })

  test('returns empty result when no matches', async () => {
    const result = await grepTool.call({ pattern: 'zzz_no_match_xyz', path: TMP })
    expect(result.content).toBe('No matches found.')
    expect(result.isError).toBeUndefined()
  })

  test('isReadOnly is true', () => {
    expect(grepTool.isReadOnly).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/tools/system-tools.test.ts
```

Expected: `Cannot find module './run-command'`

- [ ] **Step 3: Write run-command.ts**

Create `src/tools/run-command.ts`:
```typescript
import { z } from 'zod'
import { defineTool } from './registry'

export const runCommandTool = defineTool({
  name: 'Bash',
  description: 'Run a shell command. Returns stdout on success, stderr on failure.',
  inputSchema: z.object({
    command: z.string().describe('Shell command to execute'),
  }),
  isReadOnly: false,
  async call({ command }) {
    const proc = Bun.spawnSync(['sh', '-c', command], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const stdout = proc.stdout.toString()
    const stderr = proc.stderr.toString()
    if (proc.exitCode !== 0) {
      return {
        content: stderr || `Command exited with code ${proc.exitCode}`,
        isError: true,
      }
    }
    return { content: stdout }
  },
})
```

- [ ] **Step 4: Write list-dir.ts**

Create `src/tools/list-dir.ts`:
```typescript
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { defineTool } from './registry'

export const listDirTool = defineTool({
  name: 'LS',
  description: 'List the contents of a directory.',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the directory to list'),
  }),
  isReadOnly: true,
  async call({ path }) {
    try {
      const entries = readdirSync(path)
      const lines = entries.map(name => {
        const fullPath = join(path, name)
        const stat = statSync(fullPath)
        return stat.isDirectory() ? `${name}/` : name
      })
      return { content: lines.join('\n') }
    } catch (err) {
      return { content: `Error listing directory: ${(err as Error).message}`, isError: true }
    }
  },
})
```

- [ ] **Step 5: Write grep.ts**

Create `src/tools/grep.ts`:
```typescript
import { z } from 'zod'
import { defineTool } from './registry'

export const grepTool = defineTool({
  name: 'Grep',
  description: 'Search for a pattern in files under a directory. Returns matching file:line pairs.',
  inputSchema: z.object({
    pattern: z.string().describe('Regular expression pattern to search for'),
    path: z.string().describe('Directory or file to search in'),
  }),
  isReadOnly: true,
  async call({ pattern, path }) {
    const proc = Bun.spawnSync(['grep', '-rn', '--include=*', pattern, path], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const output = proc.stdout.toString().trim()
    if (!output) return { content: 'No matches found.' }
    return { content: output }
  },
})
```

- [ ] **Step 6: Run test to verify it passes**

```bash
bun test src/tools/system-tools.test.ts
```

Expected:
```
✓ runs a command and returns stdout
✓ returns error output for failing command
✓ isReadOnly is false
✓ lists directory contents
✓ returns error for nonexistent directory
✓ isReadOnly is true
✓ finds matching lines
✓ returns empty result when no matches
✓ isReadOnly is true

9 pass, 0 fail
```

- [ ] **Step 7: Add ALL_TOOLS registry to registry.ts**

Update `src/tools/registry.ts` (append at the bottom):
```typescript
import { readFileTool } from './read-file'
import { writeFileTool } from './write-file'
import { viewRangeTool } from './view-range'
import { listDirTool } from './list-dir'
import { grepTool } from './grep'
import { runCommandTool } from './run-command'
import type { Tool } from '../types/tool'

export const ALL_TOOLS: Tool[] = [
  readFileTool,
  viewRangeTool,
  listDirTool,
  grepTool,
  writeFileTool,
  runCommandTool,
]
```

- [ ] **Step 8: Run all tool tests to confirm nothing broke**

```bash
bun test src/tools/
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/src/tools/
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add run-command, list-dir, grep tools and ALL_TOOLS registry"
```

---

## Task 6: Provider Interface + Anthropic Implementation

**Files:**
- Create: `src/services/api/interface.ts`
- Create: `src/services/api/anthropic.ts`
- Create: `src/services/api/anthropic.test.ts`

- [ ] **Step 1: Write interface.ts**

(No test — it's a pure type file.)

Create `src/services/api/interface.ts`:
```typescript
import type { z } from 'zod'
import type { Message } from '../../types/message'

export type ProviderType = 'anthropic' | 'openai'

// Sent to the provider so it can build the API-specific tool schema
export type ToolDefinition = {
  name: string
  description: string
  inputSchema: z.ZodObject<z.ZodRawShape>
}

// Streaming events yielded by LLMProvider.chat()
export type LLMEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }

export interface LLMProvider {
  chat(
    messages: Message[],
    tools: ToolDefinition[],
    systemPrompt: string,
  ): AsyncIterable<LLMEvent>
}
```

- [ ] **Step 2: Write the failing test for Anthropic provider**

Create `src/services/api/anthropic.test.ts`:
```typescript
import { describe, test, expect, mock } from 'bun:test'
import { z } from 'zod'
import { AnthropicProvider } from './anthropic'
import type { Message } from '../../types/message'

describe('AnthropicProvider', () => {
  test('constructs without throwing', () => {
    expect(() => new AnthropicProvider('test-key')).not.toThrow()
  })

  test('messagesToAnthropic converts string content', () => {
    // Access private method via cast for unit test
    const provider = new AnthropicProvider('test-key') as any
    const messages: Message[] = [{ role: 'user', content: 'hello' }]
    const converted = provider.messagesToAnthropic(messages)
    expect(converted[0].role).toBe('user')
    expect(converted[0].content).toBe('hello')
  })

  test('messagesToAnthropic converts tool_result blocks to user message', () => {
    const provider = new AnthropicProvider('test-key') as any
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_01',
            content: 'file contents',
          },
        ],
      },
    ]
    const converted = provider.messagesToAnthropic(messages)
    expect(converted[0].role).toBe('user')
    expect(Array.isArray(converted[0].content)).toBe(true)
    expect(converted[0].content[0].type).toBe('tool_result')
    expect(converted[0].content[0].tool_use_id).toBe('toolu_01')
  })

  test('buildToolDefs converts Zod schema to Anthropic input_schema', () => {
    const provider = new AnthropicProvider('test-key') as any
    const toolDefs = [
      {
        name: 'Read',
        description: 'Read a file',
        inputSchema: z.object({ file_path: z.string() }),
      },
    ]
    const result = provider.buildToolDefs(toolDefs)
    expect(result[0].name).toBe('Read')
    expect(result[0].input_schema.type).toBe('object')
    expect(result[0].input_schema.properties.file_path).toBeDefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
bun test src/services/api/anthropic.test.ts
```

Expected: `Cannot find module './anthropic'`

- [ ] **Step 4: Write anthropic.ts**

Create `src/services/api/anthropic.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Message, ContentBlock } from '../../types/message'
import type { LLMEvent, LLMProvider, ToolDefinition } from './interface'

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model = 'claude-opus-4-5') {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async *chat(
    messages: Message[],
    tools: ToolDefinition[],
    systemPrompt: string,
  ): AsyncIterable<LLMEvent> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8096,
      system: systemPrompt,
      messages: this.messagesToAnthropic(messages),
      tools: this.buildToolDefs(tools),
    })

    let currentToolId: string | null = null
    let currentToolName: string | null = null
    let currentToolInput = ''

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolId = event.content_block.id
          currentToolName = event.content_block.name
          currentToolInput = ''
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text }
        } else if (event.delta.type === 'input_json_delta') {
          currentToolInput += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolId && currentToolName) {
          yield {
            type: 'tool_use',
            id: currentToolId,
            name: currentToolName,
            input: JSON.parse(currentToolInput || '{}'),
          }
          currentToolId = null
          currentToolName = null
          currentToolInput = ''
        }
      }
    }
  }

  private messagesToAnthropic(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content }
      }
      return {
        role: msg.role,
        content: msg.content.map(block => this.contentBlockToAnthropic(block)),
      }
    })
  }

  private contentBlockToAnthropic(block: ContentBlock): Anthropic.ContentBlockParam | Anthropic.ToolResultBlockParam {
    if (block.type === 'text') {
      return { type: 'text', text: block.text }
    }
    if (block.type === 'tool_use') {
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input as Record<string, unknown> }
    }
    // tool_result
    return {
      type: 'tool_result',
      tool_use_id: block.tool_use_id,
      content: block.content,
      is_error: block.is_error,
    }
  }

  private buildToolDefs(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: z.toJSONSchema(t.inputSchema) as Anthropic.Tool['input_schema'],
    }))
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun test src/services/api/anthropic.test.ts
```

Expected:
```
✓ constructs without throwing
✓ messagesToAnthropic converts string content
✓ messagesToAnthropic converts tool_result blocks to user message
✓ buildToolDefs converts Zod schema to Anthropic input_schema

4 pass, 0 fail
```

- [ ] **Step 6: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/src/services/api/
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add LLMProvider interface and Anthropic implementation"
```

---

## Task 7: OpenAI Provider

**Files:**
- Create: `src/services/api/openai.ts`
- Create: `src/services/api/openai.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/api/openai.test.ts`:
```typescript
import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
import { OpenAIProvider } from './openai'
import type { Message } from '../../types/message'

describe('OpenAIProvider', () => {
  test('constructs without throwing', () => {
    expect(() => new OpenAIProvider('test-key')).not.toThrow()
  })

  test('messagesToOpenAI converts simple user string', () => {
    const provider = new OpenAIProvider('test-key') as any
    const messages: Message[] = [{ role: 'user', content: 'hello' }]
    const result = provider.messagesToOpenAI(messages)
    expect(result[0].role).toBe('user')
    expect(result[0].content).toBe('hello')
  })

  test('messagesToOpenAI converts tool_result blocks to role:tool messages', () => {
    const provider = new OpenAIProvider('test-key') as any
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'call_01', content: 'file contents' },
        ],
      },
    ]
    const result = provider.messagesToOpenAI(messages)
    expect(result[0].role).toBe('tool')
    expect(result[0].tool_call_id).toBe('call_01')
    expect(result[0].content).toBe('file contents')
  })

  test('messagesToOpenAI converts assistant tool_use blocks to tool_calls', () => {
    const provider = new OpenAIProvider('test-key') as any
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call_01', name: 'Read', input: { file_path: '/tmp/foo.ts' } },
        ],
      },
    ]
    const result = provider.messagesToOpenAI(messages)
    expect(result[0].role).toBe('assistant')
    expect(result[0].tool_calls[0].id).toBe('call_01')
    expect(result[0].tool_calls[0].function.name).toBe('Read')
  })

  test('buildToolDefs wraps schema in OpenAI function format', () => {
    const provider = new OpenAIProvider('test-key') as any
    const tools = [
      { name: 'Read', description: 'Read a file', inputSchema: z.object({ file_path: z.string() }) },
    ]
    const result = provider.buildToolDefs(tools)
    expect(result[0].type).toBe('function')
    expect(result[0].function.name).toBe('Read')
    expect(result[0].function.parameters.type).toBe('object')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/services/api/openai.test.ts
```

Expected: `Cannot find module './openai'`

- [ ] **Step 3: Write openai.ts**

Create `src/services/api/openai.ts`:
```typescript
import OpenAI from 'openai'
import { z } from 'zod'
import type { Message, TextBlock, ToolUseBlock, ToolResultBlock } from '../../types/message'
import type { LLMEvent, LLMProvider, ToolDefinition } from './interface'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey })
    this.model = model
  }

  async *chat(
    messages: Message[],
    tools: ToolDefinition[],
    systemPrompt: string,
  ): AsyncIterable<LLMEvent> {
    const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...this.messagesToOpenAI(messages),
    ]

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openAIMessages,
      tools: this.buildToolDefs(tools),
      stream: true,
    })

    const toolCallAccumulators: Record<string, { name: string; args: string }> = {}

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue

      if (delta.content) {
        yield { type: 'text_delta', text: delta.content }
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          if (!toolCallAccumulators[idx]) {
            toolCallAccumulators[idx] = { name: tc.function?.name ?? '', args: '' }
          }
          if (tc.function?.name) toolCallAccumulators[idx].name = tc.function.name
          if (tc.function?.arguments) toolCallAccumulators[idx].args += tc.function.arguments
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        for (const [idx, acc] of Object.entries(toolCallAccumulators)) {
          yield {
            type: 'tool_use',
            id: `call_${idx}`,
            name: acc.name,
            input: JSON.parse(acc.args || '{}'),
          }
        }
      }
    }
  }

  private messagesToOpenAI(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.ChatCompletionMessageParam[] = []

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({ role: msg.role, content: msg.content })
        continue
      }

      const toolResults = msg.content.filter(b => b.type === 'tool_result') as ToolResultBlock[]
      const textBlocks = msg.content.filter(b => b.type === 'text') as TextBlock[]
      const toolUseBlocks = msg.content.filter(b => b.type === 'tool_use') as ToolUseBlock[]

      // tool_result blocks → individual role:'tool' messages
      for (const tr of toolResults) {
        result.push({ role: 'tool', tool_call_id: tr.tool_use_id, content: tr.content })
      }

      // assistant message with tool calls
      if (msg.role === 'assistant' && toolUseBlocks.length > 0) {
        result.push({
          role: 'assistant',
          content: textBlocks.map(b => b.text).join('') || null,
          tool_calls: toolUseBlocks.map((b, i) => ({
            id: b.id,
            type: 'function' as const,
            function: { name: b.name, arguments: JSON.stringify(b.input) },
          })),
        })
      } else if (textBlocks.length > 0) {
        result.push({ role: msg.role, content: textBlocks.map(b => b.text).join('') })
      }
    }

    return result
  }

  private buildToolDefs(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: z.toJSONSchema(t.inputSchema) as Record<string, unknown>,
      },
    }))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/services/api/openai.test.ts
```

Expected:
```
✓ constructs without throwing
✓ messagesToOpenAI converts simple user string
✓ messagesToOpenAI converts tool_result blocks to role:tool messages
✓ messagesToOpenAI converts assistant tool_use blocks to tool_calls
✓ buildToolDefs wraps schema in OpenAI function format

5 pass, 0 fail
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/src/services/api/openai.ts steven-cli-typescript/src/services/api/openai.test.ts
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add OpenAI provider implementation"
```

---

## Task 8: Config

**Files:**
- Create: `src/config.ts`
- Create: `src/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/config.test.ts`:
```typescript
import { describe, test, expect, beforeEach } from 'bun:test'

describe('loadConfig', () => {
  beforeEach(() => {
    // Clear relevant env vars
    delete process.env.STEVEN_PROVIDER
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.STEVEN_MODEL
  })

  test('defaults to anthropic provider', async () => {
    const { loadConfig } = await import('./config')
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    const config = loadConfig()
    expect(config.provider).toBe('anthropic')
  })

  test('reads STEVEN_PROVIDER env var', async () => {
    const { loadConfig } = await import('./config')
    process.env.STEVEN_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'sk-openai-test'
    const config = loadConfig()
    expect(config.provider).toBe('openai')
  })

  test('throws if no API key set for provider', async () => {
    const { loadConfig } = await import('./config')
    process.env.STEVEN_PROVIDER = 'anthropic'
    expect(() => loadConfig()).toThrow('ANTHROPIC_API_KEY')
  })

  test('reads STEVEN_MODEL env var', async () => {
    const { loadConfig } = await import('./config')
    process.env.STEVEN_PROVIDER = 'anthropic'
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    process.env.STEVEN_MODEL = 'claude-haiku-4-5'
    const config = loadConfig()
    expect(config.model).toBe('claude-haiku-4-5')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/config.test.ts
```

Expected: `Cannot find module './config'`

- [ ] **Step 3: Write config.ts**

Create `src/config.ts`:
```typescript
import type { ProviderType } from './services/api/interface'

export type Config = {
  provider: ProviderType
  apiKey: string
  model: string
}

const DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: 'claude-opus-4-5',
  openai: 'gpt-4o',
}

export function loadConfig(): Config {
  const provider = (process.env.STEVEN_PROVIDER ?? 'anthropic') as ProviderType

  let apiKey: string | undefined
  if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required')
  } else {
    apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const model = process.env.STEVEN_MODEL ?? DEFAULT_MODELS[provider]

  return { provider, apiKey, model }
}

export function createProvider(config: Config) {
  if (config.provider === 'anthropic') {
    const { AnthropicProvider } = require('./services/api/anthropic')
    return new AnthropicProvider(config.apiKey, config.model)
  } else {
    const { OpenAIProvider } = require('./services/api/openai')
    return new OpenAIProvider(config.apiKey, config.model)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/config.test.ts
```

Expected:
```
✓ defaults to anthropic provider
✓ reads STEVEN_PROVIDER env var
✓ throws if no API key set for provider
✓ reads STEVEN_MODEL env var

4 pass, 0 fail
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/src/config.ts steven-cli-typescript/src/config.test.ts
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add config loader with provider + API key resolution"
```

---

## Task 9: Agent Loop (core/query.ts)

**Files:**
- Create: `src/core/query.ts`
- Create: `src/core/query.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/query.test.ts`:
```typescript
import { describe, test, expect } from 'bun:test'
import { query } from './query'
import type { LLMProvider, LLMEvent } from '../services/api/interface'
import type { Message } from '../types/message'
import { z } from 'zod'
import { defineTool } from '../tools/registry'

// Mock provider that yields text then done (no tool calls)
function mockTextProvider(text: string): LLMProvider {
  return {
    async *chat() {
      yield { type: 'text_delta', text } satisfies LLMEvent
    },
  }
}

// Mock provider that first calls a tool, then returns text
function mockToolProvider(toolName: string, toolInput: unknown, toolResponse: string): LLMProvider {
  let callCount = 0
  return {
    async *chat() {
      if (callCount === 0) {
        callCount++
        yield { type: 'tool_use', id: 'toolu_01', name: toolName, input: toolInput } satisfies LLMEvent
      } else {
        yield { type: 'text_delta', text: 'Task complete.' } satisfies LLMEvent
      }
    },
  }
}

const echoTool = defineTool({
  name: 'Echo',
  description: 'Echoes the message back',
  inputSchema: z.object({ msg: z.string() }),
  isReadOnly: true,
  async call(input: { msg: string }) {
    return { content: `echo: ${input.msg}` }
  },
})

describe('query()', () => {
  test('yields text events and done when no tool calls', async () => {
    const events: string[] = []
    for await (const event of query({
      messages: [{ role: 'user', content: 'hello' }],
      provider: mockTextProvider('hi there'),
      tools: [],
      systemPrompt: 'You are a helpful assistant.',
    })) {
      events.push(event.type)
    }
    expect(events).toContain('text')
    expect(events).toContain('done')
  })

  test('yields tool_start, tool_result, then text and done when tool is called', async () => {
    const events: Array<{ type: string }> = []
    for await (const event of query({
      messages: [{ role: 'user', content: 'echo test' }],
      provider: mockToolProvider('Echo', { msg: 'hello' }, 'echo: hello'),
      tools: [echoTool as any],
      systemPrompt: 'You are a helpful assistant.',
    })) {
      events.push({ type: event.type })
    }
    const types = events.map(e => e.type)
    expect(types).toContain('tool_start')
    expect(types).toContain('tool_result')
    expect(types).toContain('done')
  })

  test('handles unknown tool gracefully (is_error: true in tool_result)', async () => {
    const events: any[] = []
    for await (const event of query({
      messages: [{ role: 'user', content: 'call unknown' }],
      provider: mockToolProvider('UnknownTool', {}, ''),
      tools: [],
      systemPrompt: 'You are a helpful assistant.',
    })) {
      events.push(event)
    }
    const toolResult = events.find(e => e.type === 'tool_result')
    expect(toolResult).toBeDefined()
    expect(toolResult.result.isError).toBe(true)
  })

  test('respects maxTurns limit', async () => {
    // Provider always calls a tool to keep the loop going
    const infiniteProvider: LLMProvider = {
      async *chat() {
        yield { type: 'tool_use', id: 'toolu_01', name: 'Echo', input: { msg: 'loop' } } satisfies LLMEvent
      },
    }
    const events: string[] = []
    for await (const event of query({
      messages: [{ role: 'user', content: 'loop' }],
      provider: infiniteProvider,
      tools: [echoTool as any],
      systemPrompt: 'You are a helpful assistant.',
      maxTurns: 3,
    })) {
      events.push(event.type)
    }
    // Should eventually yield 'done' instead of looping forever
    expect(events[events.length - 1]).toBe('done')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/core/query.test.ts
```

Expected: `Cannot find module './query'`

- [ ] **Step 3: Write query.ts**

Create `src/core/query.ts`:
```typescript
import type { LLMProvider, ToolDefinition } from '../services/api/interface'
import type { Message, ContentBlock, ToolUseBlock, ToolResultBlock } from '../types/message'
import type { Tool, ToolResult } from '../types/tool'

export type QueryEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; toolUseId: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; name: string; result: ToolResult }
  | { type: 'done' }

export type QueryParams = {
  messages: Message[]
  provider: LLMProvider
  tools: Tool[]
  systemPrompt: string
  maxTurns?: number
}

// Inspired by Claude Code's query.ts — AsyncGenerator, mutable state per iteration
export async function* query(params: QueryParams): AsyncGenerator<QueryEvent> {
  const messages: Message[] = [...params.messages]
  const maxTurns = params.maxTurns ?? 20

  for (let turn = 0; turn < maxTurns; turn++) {
    // Build tool definitions to send to the LLM
    const toolDefs: ToolDefinition[] = params.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))

    let textContent = ''
    const toolUseBlocks: ToolUseBlock[] = []

    // Stream from the LLM
    for await (const event of params.provider.chat(messages, toolDefs, params.systemPrompt)) {
      if (event.type === 'text_delta') {
        textContent += event.text
        yield { type: 'text', text: event.text }
      } else if (event.type === 'tool_use') {
        toolUseBlocks.push({
          type: 'tool_use',
          id: event.id,
          name: event.name,
          input: event.input,
        })
      }
    }

    // Append assistant message to history
    const assistantContent: ContentBlock[] = []
    if (textContent) assistantContent.push({ type: 'text', text: textContent })
    assistantContent.push(...toolUseBlocks)
    messages.push({ role: 'assistant', content: assistantContent })

    // No tool calls → conversation turn is complete
    if (toolUseBlocks.length === 0) {
      yield { type: 'done' }
      return
    }

    // Execute tools, yield events, collect results
    const toolResultContent: ToolResultBlock[] = []
    for await (const event of runTools(toolUseBlocks, params.tools)) {
      yield event
      if (event.type === 'tool_result') {
        toolResultContent.push({
          type: 'tool_result',
          tool_use_id: event.toolUseId,
          content: event.result.content,
          is_error: event.result.isError,
        })
      }
    }

    // Append tool results as next user message
    messages.push({ role: 'user', content: toolResultContent })
  }

  // maxTurns reached
  yield { type: 'done' }
}

// Inspired by Claude Code's toolOrchestration.ts:
// read-only tools run concurrently, write tools run serially
async function* runTools(
  blocks: ToolUseBlock[],
  tools: Tool[],
): AsyncGenerator<QueryEvent> {
  const readOnly = blocks.filter(b => tools.find(t => t.name === b.name)?.isReadOnly === true)
  const writes = blocks.filter(b => tools.find(t => t.name === b.name)?.isReadOnly !== true)

  // Emit tool_start for all before executing
  for (const block of blocks) {
    yield { type: 'tool_start', toolUseId: block.id, name: block.name, input: block.input }
  }

  // Run read-only concurrently
  if (readOnly.length > 0) {
    const results = await Promise.all(readOnly.map(b => executeTool(b, tools)))
    for (const [block, result] of results) {
      yield { type: 'tool_result', toolUseId: block.id, name: block.name, result }
    }
  }

  // Run writes serially
  for (const block of writes) {
    const [, result] = await executeTool(block, tools)
    yield { type: 'tool_result', toolUseId: block.id, name: block.name, result }
  }
}

async function executeTool(
  block: ToolUseBlock,
  tools: Tool[],
): Promise<[ToolUseBlock, ToolResult]> {
  const tool = tools.find(t => t.name === block.name)
  if (!tool) {
    return [block, { content: `Unknown tool: ${block.name}`, isError: true }]
  }
  try {
    const result = await tool.call(block.input)
    return [block, result]
  } catch (err) {
    return [block, { content: `Tool error: ${(err as Error).message}`, isError: true }]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/core/query.test.ts
```

Expected:
```
✓ yields text events and done when no tool calls
✓ yields tool_start, tool_result, then text and done when tool is called
✓ handles unknown tool gracefully (is_error: true in tool_result)
✓ respects maxTurns limit

4 pass, 0 fail
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/src/core/query.ts steven-cli-typescript/src/core/query.test.ts
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add agent loop core/query.ts with AsyncGenerator and concurrent tool execution"
```

---

## Task 10: Engine (core/engine.ts)

**Files:**
- Create: `src/core/engine.ts`
- Create: `src/core/engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/engine.test.ts`:
```typescript
import { describe, test, expect } from 'bun:test'
import { Engine } from './engine'
import type { LLMProvider, LLMEvent } from '../services/api/interface'

const mockProvider: LLMProvider = {
  async *chat() {
    yield { type: 'text_delta', text: 'Hello, world!' } satisfies LLMEvent
  },
}

describe('Engine', () => {
  test('runOnce() resolves with final text', async () => {
    const engine = new Engine({ provider: mockProvider, tools: [], systemPrompt: 'You are helpful.' })
    const result = await engine.runOnce('Say hello')
    expect(result).toBe('Hello, world!')
  })

  test('runOnce() accumulates text from multiple text_delta events', async () => {
    const multiChunkProvider: LLMProvider = {
      async *chat() {
        yield { type: 'text_delta', text: 'Hello' } satisfies LLMEvent
        yield { type: 'text_delta', text: ', ' } satisfies LLMEvent
        yield { type: 'text_delta', text: 'world!' } satisfies LLMEvent
      },
    }
    const engine = new Engine({ provider: multiChunkProvider, tools: [], systemPrompt: '' })
    const result = await engine.runOnce('hello')
    expect(result).toBe('Hello, world!')
  })

  test('chat() maintains conversation history across turns', async () => {
    let callCount = 0
    let secondCallMessages: any[] = []
    const trackingProvider: LLMProvider = {
      async *chat(messages) {
        callCount++
        if (callCount === 2) secondCallMessages = [...messages]
        yield { type: 'text_delta', text: `turn ${callCount}` } satisfies LLMEvent
      },
    }
    const engine = new Engine({ provider: trackingProvider, tools: [], systemPrompt: '' })
    await engine.chat('first message')
    await engine.chat('second message')
    // Second call should include messages from first turn
    expect(secondCallMessages.length).toBeGreaterThan(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/core/engine.test.ts
```

Expected: `Cannot find module './engine'`

- [ ] **Step 3: Write engine.ts**

Create `src/core/engine.ts`:
```typescript
import { query } from './query'
import type { LLMProvider } from '../services/api/interface'
import type { Tool } from '../types/tool'
import type { Message } from '../types/message'

type EngineOptions = {
  provider: LLMProvider
  tools: Tool[]
  systemPrompt: string
}

// Inspired by Claude Code's QueryEngine.ts — manages session state across turns
export class Engine {
  private provider: LLMProvider
  private tools: Tool[]
  private systemPrompt: string
  private history: Message[] = []

  constructor(opts: EngineOptions) {
    this.provider = opts.provider
    this.tools = opts.tools
    this.systemPrompt = opts.systemPrompt
  }

  // One-shot: run a single user message, return the final text response
  async runOnce(userInput: string): Promise<string> {
    const messages: Message[] = [{ role: 'user', content: userInput }]
    let finalText = ''
    for await (const event of query({
      messages,
      provider: this.provider,
      tools: this.tools,
      systemPrompt: this.systemPrompt,
    })) {
      if (event.type === 'text') finalText += event.text
    }
    return finalText
  }

  // Multi-turn: append to history, run, stream events via callback
  async chat(
    userInput: string,
    onEvent?: (event: { type: string; text?: string; name?: string }) => void,
  ): Promise<string> {
    this.history.push({ role: 'user', content: userInput })
    let finalText = ''

    for await (const event of query({
      messages: this.history,
      provider: this.provider,
      tools: this.tools,
      systemPrompt: this.systemPrompt,
    })) {
      onEvent?.(event)
      if (event.type === 'text') finalText += event.text
    }

    // Append assistant response to history
    this.history.push({ role: 'assistant', content: finalText })
    return finalText
  }

  clearHistory(): void {
    this.history = []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/core/engine.test.ts
```

Expected:
```
✓ runOnce() resolves with final text
✓ runOnce() accumulates text from multiple text_delta events
✓ chat() maintains conversation history across turns

3 pass, 0 fail
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/src/core/engine.ts steven-cli-typescript/src/core/engine.test.ts
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add Engine session manager"
```

---

## Task 11: CLI Entry Point

**Files:**
- Create: `bin/index.ts`

- [ ] **Step 1: Write bin/index.ts**

Create `bin/index.ts`:
```typescript
import { createInterface } from 'readline'
import { Engine } from '../src/core/engine'
import { loadConfig, createProvider } from '../src/config'
import { ALL_TOOLS } from '../src/tools/registry'

const SYSTEM_PROMPT = `You are Steven, a coding assistant CLI. You help users with programming tasks.
You have access to tools to read files, write files, search code, list directories, and run commands.
Always think step by step. When asked to create or modify code, use the appropriate tools.
Current working directory: ${process.cwd()}`

async function main() {
  // Parse args: `steven [-p] [--provider <p>] [--model <m>] [prompt]`
  const args = process.argv.slice(2)
  const isPrint = args.includes('-p') || args.includes('--print')
  const providerIdx = args.findIndex(a => a === '--provider')
  const modelIdx = args.findIndex(a => a === '--model')

  // Override env vars from flags
  if (providerIdx !== -1 && args[providerIdx + 1]) {
    process.env.STEVEN_PROVIDER = args[providerIdx + 1]
  }
  if (modelIdx !== -1 && args[modelIdx + 1]) {
    process.env.STEVEN_MODEL = args[modelIdx + 1]
  }

  // Remaining args (not flags) = inline prompt
  const flagArgs = new Set(['-p', '--print', '--provider', '--model'])
  const filtered = args.filter((a, i) => {
    if (flagArgs.has(a)) return false
    if (i > 0 && (args[i - 1] === '--provider' || args[i - 1] === '--model')) return false
    return true
  })
  const inlinePrompt = filtered.join(' ').trim()

  let config
  try {
    config = loadConfig()
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    process.exit(1)
  }

  const provider = createProvider(config)
  const engine = new Engine({ provider, tools: ALL_TOOLS, systemPrompt: SYSTEM_PROMPT })

  // Detect pipe mode (stdin is not a TTY)
  const ispiped = !process.stdin.isTTY

  if (inlinePrompt || isPrint || ispiped) {
    // One-shot mode
    let prompt = inlinePrompt
    if (!prompt && ispiped) {
      // Read all of stdin
      const chunks: string[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk.toString())
      }
      prompt = chunks.join('').trim()
    }
    if (!prompt) {
      console.error('Error: no prompt provided in one-shot mode')
      process.exit(1)
    }
    const result = await engine.runOnce(prompt)
    process.stdout.write(result + '\n')
  } else {
    // REPL mode
    console.log(`Steven CLI — provider: ${config.provider}, model: ${config.model}`)
    console.log('Type your message and press Enter. Ctrl+C to exit.\n')

    const rl = createInterface({ input: process.stdin, output: process.stdout })

    const askQuestion = () => {
      rl.question('> ', async input => {
        if (!input.trim()) {
          askQuestion()
          return
        }
        process.stdout.write('\n')
        await engine.chat(input.trim(), event => {
          if (event.type === 'text' && event.text) {
            process.stdout.write(event.text)
          } else if (event.type === 'tool_start') {
            process.stdout.write(`\n[Running ${event.name}...]\n`)
          }
        })
        process.stdout.write('\n\n')
        askQuestion()
      })
    }

    rl.on('close', () => {
      console.log('\nBye!')
      process.exit(0)
    })

    askQuestion()
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Smoke test — one-shot mode (requires real API key)**

```bash
cd /Users/zhengwenjie/Documents/People/steven/steven-cli-typescript
ANTHROPIC_API_KEY=sk-... bun run bin/index.ts -p "Say 'hello from steven' and nothing else"
```

Expected output: `hello from steven` (or similar short response)

- [ ] **Step 3: Smoke test — list directory via tool**

```bash
ANTHROPIC_API_KEY=sk-... bun run bin/index.ts -p "List the files in the current directory using the LS tool"
```

Expected: agent calls `LS` tool and responds with directory contents.

- [ ] **Step 4: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add steven-cli-typescript/bin/index.ts
git -C /Users/zhengwenjie/Documents/People/steven commit -m "feat: add CLI entry point with one-shot and REPL modes"
```

---

## Task 12: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
cd /Users/zhengwenjie/Documents/People/steven/steven-cli-typescript && bun test
```

Expected:
```
src/types/message.test.ts:
  4 pass, 0 fail

src/tools/registry.test.ts:
  3 pass, 0 fail

src/tools/file-tools.test.ts:
  9 pass, 0 fail

src/tools/system-tools.test.ts:
  9 pass, 0 fail

src/services/api/anthropic.test.ts:
  4 pass, 0 fail

src/services/api/openai.test.ts:
  5 pass, 0 fail

src/config.test.ts:
  4 pass, 0 fail

src/core/query.test.ts:
  4 pass, 0 fail

src/core/engine.test.ts:
  3 pass, 0 fail

45 pass, 0 fail
```

- [ ] **Step 2: Final commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add -A
git -C /Users/zhengwenjie/Documents/People/steven commit -m "chore: complete steven-cli-typescript MVP implementation"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Project structure matches spec Section 1
- ✅ Agent loop is AsyncGenerator, state object, tool concurrency (Section 2)
- ✅ Provider env var switching, LLMProvider interface (Section 3)
- ✅ `defineTool()` factory, Zod inputSchema, `isReadOnly` (Section 4)
- ✅ one-shot / REPL / pipe modes, `-p`, `--provider`, `--model` flags (Section 5)
- ✅ Tool errors wrapped as `is_error: true` tool_result (Section 6)
- ✅ All 6 tools: Read, Write, ViewRange, LS, Grep, Bash
- ✅ Bun runtime throughout

**Type consistency:**
- `defineTool()` → `Tool<TInput>` used consistently in registry.ts, query.ts, engine.ts
- `ToolResult` shape `{ content, isError? }` consistent across all tools and query.ts
- `LLMEvent` with `text_delta` and `tool_use` used in both providers and consumed in query.ts
- `QueryEvent` type names (`text`, `tool_start`, `tool_result`, `done`) consistent in query.ts, engine.ts, bin/index.ts
