# Bash 工具

**文件：** `src/tools/bash.ts` · 20 行

Bash 工具让 agent 能够执行任意 Shell 命令——这是最强大也最危险的能力，所以需要若干边界设定。

## 核心代码

```typescript
import { execSync } from "child_process";

const DANGEROUS = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];

export function runBash(command: string): string {
  if (DANGEROUS.some(d => command.includes(d))) {
    return "Error: Dangerous command blocked";
  }
  try {
    const r = execSync(command, {
      encoding: "utf-8",
      cwd: process.cwd(),
      timeout: 120_000,        // 120 秒超时
    });
    const out = r.trim();
    return out.slice(0, 50000) || "(no output)";  // 50KB 截断
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
```

## 设计决策

### 为什么用 `execSync`（同步）而不是 `exec`（异步）？

`agentLoop` 的工具调用链是同步遍历 `response.content` 的——当时整个函数已经在 `async` 上下文里，但工具执行本身是顺序的，不需要并发。

`execSync` 的好处：
- 代码更简单，不需要 callback 或 Promise 包装
- 输出直接作为返回值，无需处理 stdout/stderr 流
- Agent 本质上是串行思考的，并发执行命令反而会让状态难以预测

**代价**：如果命令卡住，整个进程会阻塞直到超时（120s）。这是可接受的——超时后 `execSync` 会抛出异常，被 `catch` 捕获并返回错误字符串。

### DANGEROUS 黑名单

```typescript
const DANGEROUS = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];
```

这是**基于字符串匹配的黑名单**，不是沙箱隔离。设计意图是：

1. 防止模型犯"低级错误"（如意外删除根目录）
2. 阻止权限升级（`sudo`）
3. 防止系统级破坏（`shutdown`, `reboot`, `> /dev/`）

**它不是完整的安全屏障**：有人可以绕过（如 `rm  -rf /`，多一个空格）。这里的设计假设是：模型通常不会恶意绕过，黑名单只是防止意外。

### 超时 120s

`timeout: 120_000` 的考量：

- 足够长：编译大项目、运行测试套件通常在 2 分钟内完成
- 足够短：防止 `sleep infinity` 或网络请求无限等待

超时后 `execSync` 抛出错误，`catch` 块返回错误消息，agent 会看到超时提示并可以决定重试或放弃。

### 50KB 输出截断

```typescript
return out.slice(0, 50000) || "(no output)";
```

Anthropic API 对消息长度有限制，且过长的输出会消耗大量 token。截断到 50KB（约 12,500 个中文字或 50,000 个 ASCII 字符）通常足够看到关键信息。

`|| "(no output)"` 处理命令成功但无输出的情况（如 `touch file.txt`）——空字符串作为工具结果会让模型困惑。

## 关键细节

| 参数 | 值 | 原因 |
|------|----|------|
| `encoding` | `"utf-8"` | 直接返回字符串，无需手动 Buffer 转换 |
| `cwd` | `process.cwd()` | 命令在当前工作目录执行，与文件工具的基准路径一致 |
| `timeout` | 120,000ms | 2 分钟，足以完成大多数编译/测试任务 |
| 输出截断 | 50,000 字节 | 防止超长输出撑爆 token 上下文 |
