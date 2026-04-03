# 第二章：工具系统

## 背景

第一章结束时，你有了一个能真实对话的 Agent，但只有一个 mock `Echo` 工具。

**本章目标：** 实现 6 个真实工具，让 Agent 能真正操作文件、搜索代码、执行命令——成为一个名副其实的 Coding Agent。

## 本章内容

- [2.1 defineTool 工厂](./2.1-registry) — 工具的统一定义方式，参考 Claude Code 的 `buildTool()`
- [2.2 文件工具](./2.2-file-tools) — `Read`、`Write`、`ViewRange`
- [2.3 系统工具](./2.3-system-tools) — `Bash`、`LS`、`Grep`

## 本章结束后你能做什么

```bash
ANTHROPIC_API_KEY=sk-ant-... bun run bin/index.ts -p "读取 src/core/query.ts 的前 20 行"
ANTHROPIC_API_KEY=sk-ant-... bun run bin/index.ts -p "在当前目录创建一个 hello.ts，输出 hello world"
ANTHROPIC_API_KEY=sk-ant-... bun run bin/index.ts -p "搜索项目里所有包含 AsyncGenerator 的文件"
```
