# steven 文档站设计文档

**日期：** 2026-04-03  
**目标：** 用 VitePress 构建一个承载"从 0 到 1 构建 Coding Agent CLI"学习过程的文档站，部署到 Vercel

---

## 1. Monorepo 结构

将 `steven/` 根目录改造为 Bun workspace monorepo，`docs-site/` 作为独立 workspace。

```
steven/                               ← monorepo 根
├── package.json                      ← Bun workspace 配置 + 根脚本
├── docs-site/                        ← VitePress 文档站（部署 Vercel）
│   ├── package.json
│   ├── .vitepress/
│   │   └── config.ts                 ← 站点配置、导航、侧边栏
│   └── chapters/
│       ├── index.md                  ← 首页：项目介绍 + 学习路线图
│       ├── 01-agent-loop/
│       ├── 02-tools/
│       └── 03-providers/
├── steven-cli-typescript/            ← 学习者自己实现的 CLI
├── steven-cli-langchain/             ← 后续路线
├── references/                       ← 参考项目源码
└── docs/                             ← 内部设计文档（spec/plan，不对外）
```

**根 `package.json`（Bun workspace）：**
```json
{
  "name": "steven",
  "private": true,
  "workspaces": ["docs-site", "steven-cli-typescript", "steven-cli-langchain"],
  "scripts": {
    "docs:dev":   "bun --cwd docs-site run dev",
    "docs:build": "bun --cwd docs-site run build",
    "docs:preview": "bun --cwd docs-site run preview"
  }
}
```

---

## 2. VitePress 配置

**`docs-site/package.json`：**
```json
{
  "name": "steven-docs",
  "private": true,
  "scripts": {
    "dev":     "vitepress dev chapters",
    "build":   "vitepress build chapters",
    "preview": "vitepress preview chapters"
  },
  "devDependencies": {
    "vitepress": "^1.6.0"
  }
}
```

**`docs-site/.vitepress/config.ts` 关键配置：**
- `srcDir: 'chapters'`
- 侧边栏按三章组织，每章含小节列表
- 顶部导航：首页 / GitHub

---

## 3. 章节内容结构

### 学习节奏设计

```
跑起来（第一章）→ 扩展（第二章）→ 重构（第三章）
```

这条路径模拟真实工程演进过程：先有能跑的东西，再感受到局限，再做抽象。

---

### 第一章：最小可运行 Agent

**目标：** 章节末尾 `bun run bin/index.ts -p "hello"` 跑通真实对话

| 文件 | 内容 |
|------|------|
| `index.md` | 章节概述：什么是最小可运行 Agent，本章学到什么 |
| `1.1-scaffold.md` | Bun 项目初始化，目录结构，tsconfig |
| `1.2-types.md` | Message 类型体系设计 |
| `1.3-anthropic-direct.md` | 直接接入 Anthropic SDK（不抽象，先跑通） |
| `1.4-query-loop.md` | `query()` AsyncGenerator + mock tool 验证循环 |
| `1.5-engine-cli.md` | Engine + CLI 入口，串联所有模块 |
| `notes.md` | 设计决策记录（见下方格式） |

---

### 第二章：工具系统

**目标：** Agent 能真正读写文件、执行命令，完成简单 coding 任务

| 文件 | 内容 |
|------|------|
| `index.md` | 什么是工具，工具系统的设计哲学 |
| `2.1-registry.md` | `defineTool()` 工厂，Zod inputSchema |
| `2.2-file-tools.md` | Read、Write、ViewRange 实现 |
| `2.3-system-tools.md` | Bash、LS、Grep 实现 |
| `notes.md` | 设计决策记录 |

---

### 第三章：Provider 抽象与扩展

**目标：** `STEVEN_PROVIDER=openai` 无缝切换 provider

| 文件 | 内容 |
|------|------|
| `index.md` | 为什么需要抽象：先感受只有 Anthropic 的局限 |
| `3.1-interface.md` | 提取 `LLMProvider` 接口，重构第一章的直连代码 |
| `3.2-anthropic.md` | 将直连代码重构为 `AnthropicProvider` 类 |
| `3.3-openai.md` | 实现 `OpenAIProvider`，验证抽象有效 |
| `notes.md` | 设计决策记录 |

---

## 4. 每章 notes.md 固定格式

```markdown
# 实现笔记

## 设计决策记录

### [决策主题，如：为什么用 AsyncGenerator 而不是 callback/Promise]

**问题：** 这里遇到了什么需要决策的问题

**市面上的做法：**
- **LangChain：** ...
- **Codex（OpenAI）：** ...
- **Claude Code：** ...（附源码路径）

**我们的选择：** ...

**理由：** ...

**代价与取舍：** ...
```

每章可以有多个决策条目，按实现顺序排列。

---

## 5. 每个小节的内容格式

每个小节统一结构：

```
## 背景与目标
（这一节要解决什么问题）

## 原理讲解
（Why before How：先讲为什么这样设计）

## 参考：Claude Code 是怎么做的
（指向具体源码文件和关键行，供学习者对比）

## 动手实现
（要做什么，不给代码，只给方向）
- 需要创建的文件
- 需要实现的接口/函数
- 可以参考的位置

## 验证
（如何确认自己实现正确了）
```

---

## 6. Vercel 部署配置

**`docs-site/vercel.json`：**
```json
{
  "buildCommand": "bun run build",
  "outputDirectory": ".vitepress/dist",
  "installCommand": "bun install"
}
```

Vercel 项目设置：
- **Root Directory：** `docs-site`
- **Framework Preset：** VitePress（或 Other）
- 每次 push `main` 分支自动触发部署

---

## 7. 内容原则

1. **Why before How**：每节先讲设计动机，再讲实现
2. **只给方向，不给代码**：动手练习给出要实现的接口和参考位置，学习者自己写
3. **对比学习**：每个关键设计都和 Claude Code / Codex / LangChain 对比
4. **真实运行验证**：每章末尾有明确的可运行验证目标
