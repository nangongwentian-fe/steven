# 文件工具

**文件：** `src/tools/files.ts` · 50 行

文件工具提供 read / write / edit 三个操作，所有操作都通过 `safePath()` 做路径验证，把 agent 的文件访问限制在工作目录之内。

## 核心代码

```typescript
import * as fs from "fs";
import * as path from "path";
import { WORKDIR } from "../config";

export function safePath(p: string): string {
  const resolved = path.resolve(WORKDIR, p);
  if (!resolved.startsWith(WORKDIR)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return resolved;
}

export function runRead(filePath: string, limit?: number): string {
  const fp = safePath(filePath);
  const content = fs.readFileSync(fp, "utf-8");
  const lines = content.split('\n');
  if (limit && limit < lines.length) {
    return lines.slice(0, limit).join("\n") + `\n... (${lines.length - limit} more lines)`;
  }
  return content.slice(0, 50000);
}

export function runWrite(filePath: string, content: string): string {
  const fp = safePath(filePath);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
  return `Wrote ${content.length} bytes to ${filePath}`;
}

export function runEdit(filePath: string, oldText: string, newText: string): string {
  const fp = safePath(filePath);
  const content = fs.readFileSync(fp, "utf-8");
  if (!content.includes(oldText)) {
    return `Error: Text not found in ${filePath}`;
  }
  fs.writeFileSync(fp, content.replace(oldText, newText));
  return `Edited ${filePath}`;
}
```

## `safePath()` — 路径沙箱

```typescript
const resolved = path.resolve(WORKDIR, p);
if (!resolved.startsWith(WORKDIR)) {
  throw new Error(`Path escapes workspace: ${p}`);
}
```

这是**路径遍历攻击（Path Traversal）**的防御。攻击模式：

```
read_file("../../etc/passwd")
  → path.resolve("/project", "../../etc/passwd")
  → "/etc/passwd"
  → 不以 "/project" 开头 → 抛出错误
```

两步缺一不可：

1. `path.resolve()` 把相对路径（含 `../`）解析成绝对路径
2. `startsWith(WORKDIR)` 验证结果必须在沙箱内

**注意**：如果 `WORKDIR = "/project"`，路径 `/project-other/file` 会通过 `startsWith` 检查！更严格的做法是 `startsWith(WORKDIR + "/")` 或 `startsWith(WORKDIR + path.sep)`。这是当前实现的一个已知边界。

## 三个操作的设计

### `runRead` — 分行截断

```typescript
if (limit && limit < lines.length) {
  return lines.slice(0, limit).join("\n") + `\n... (${lines.length - limit} more lines)`;
}
return content.slice(0, 50000);
```

两层截断：
- **行数截断**（可选）：模型可以传 `limit` 参数，只读前 N 行，适合大文件
- **字节截断**（兜底）：50KB 上限，防止超大文件撑爆 token

提示信息 `(${lines.length - limit} more lines)` 让模型知道文件还有多少行未读，可以决定是否需要再次调用。

### `runWrite` — 自动建目录

```typescript
fs.mkdirSync(path.dirname(fp), { recursive: true });
fs.writeFileSync(fp, content);
```

`recursive: true` 确保 `write_file("src/new/dir/file.ts", content)` 会自动创建所有中间目录，agent 不需要先调用 `bash("mkdir -p src/new/dir")`。

### `runEdit` — 替换第一次出现

```typescript
fs.writeFileSync(fp, content.replace(oldText, newText));
```

`String.prototype.replace` **只替换第一次出现**（不像 `replaceAll`）。这是刻意的设计：

- 精确替换场景中，如果目标文本出现了多次，全部替换可能造成意外破坏
- 如果需要替换所有出现，调用方（模型）可以多次调用 `edit_file`

先检查 `content.includes(oldText)`，如果不存在就返回错误——比静默无操作更好，模型会知道替换失败了。

## 关键细节

| 操作 | 错误处理 | 边界行为 |
|------|----------|----------|
| `read_file` | try/catch → 返回错误字符串 | 文件不存在返回错误，不抛异常 |
| `write_file` | try/catch → 返回错误字符串 | 自动创建父目录 |
| `edit_file` | 显式检查 includes → 返回错误字符串 | 只替换第一次出现；oldText 不存在时不修改文件 |
