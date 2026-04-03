# Docs Site Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 steven 根目录改造为 Bun workspace monorepo，搭建 VitePress 文档站框架并部署到 Vercel。

**Architecture:** 根目录 `package.json` 管理 Bun workspace，`docs-site/` 作为独立 package 运行 VitePress，所有章节内容放在 `docs-site/chapters/`，Vercel 指向 `docs-site/` 构建。

**Tech Stack:** Bun workspace, VitePress 1.x, Vercel

---

## File Map

| 文件 | 职责 |
|------|------|
| `package.json` | 根 workspace 配置，统一开发脚本 |
| `docs-site/package.json` | VitePress 依赖 |
| `docs-site/.vitepress/config.ts` | 站点标题、导航、侧边栏 |
| `docs-site/chapters/index.md` | 首页：项目介绍 + 学习路线图 |
| `docs-site/chapters/01-agent-loop/index.md` | 第一章概述 |
| `docs-site/chapters/01-agent-loop/1.1-scaffold.md` | 1.1 占位 |
| `docs-site/chapters/01-agent-loop/1.2-types.md` | 1.2 占位 |
| `docs-site/chapters/01-agent-loop/1.3-anthropic-direct.md` | 1.3 占位 |
| `docs-site/chapters/01-agent-loop/1.4-query-loop.md` | 1.4 占位 |
| `docs-site/chapters/01-agent-loop/1.5-engine-cli.md` | 1.5 占位 |
| `docs-site/chapters/01-agent-loop/notes.md` | 第一章实现笔记占位 |
| `docs-site/chapters/02-tools/index.md` | 第二章概述 |
| `docs-site/chapters/02-tools/2.1-registry.md` | 2.1 占位 |
| `docs-site/chapters/02-tools/2.2-file-tools.md` | 2.2 占位 |
| `docs-site/chapters/02-tools/2.3-system-tools.md` | 2.3 占位 |
| `docs-site/chapters/02-tools/notes.md` | 第二章实现笔记占位 |
| `docs-site/chapters/03-providers/index.md` | 第三章概述 |
| `docs-site/chapters/03-providers/3.1-interface.md` | 3.1 占位 |
| `docs-site/chapters/03-providers/3.2-anthropic.md` | 3.2 占位 |
| `docs-site/chapters/03-providers/3.3-openai.md` | 3.3 占位 |
| `docs-site/chapters/03-providers/notes.md` | 第三章实现笔记占位 |
| `docs-site/vercel.json` | Vercel 构建配置 |

---

## Task 1: 根目录 Bun Workspace 配置

**Files:**
- Create/Modify: `package.json`（根目录）

- [ ] **Step 1: 检查根目录是否已有 package.json**

```bash
ls /Users/zhengwenjie/Documents/People/steven/package.json 2>/dev/null && echo "exists" || echo "not found"
```

- [ ] **Step 2: 创建根 package.json**

在 `/Users/zhengwenjie/Documents/People/steven/package.json` 写入：

```json
{
  "name": "steven",
  "private": true,
  "workspaces": [
    "docs-site",
    "steven-cli-typescript",
    "steven-cli-langchain"
  ],
  "scripts": {
    "docs:dev": "bun --cwd docs-site run dev",
    "docs:build": "bun --cwd docs-site run build",
    "docs:preview": "bun --cwd docs-site run preview"
  }
}
```

- [ ] **Step 3: 验证 Bun 能识别 workspace 配置**

```bash
cd /Users/zhengwenjie/Documents/People/steven && bun install
```

Expected: `bun install` 完成，无报错（workspace 包可以为空）。

- [ ] **Step 4: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add package.json
git -C /Users/zhengwenjie/Documents/People/steven commit -m "chore: init bun workspace monorepo"
```

---

## Task 2: VitePress 初始化

**Files:**
- Create: `docs-site/package.json`
- Create: `docs-site/.vitepress/config.ts`

- [ ] **Step 1: 创建 docs-site 目录结构**

```bash
mkdir -p /Users/zhengwenjie/Documents/People/steven/docs-site/.vitepress
mkdir -p /Users/zhengwenjie/Documents/People/steven/docs-site/chapters
```

- [ ] **Step 2: 创建 docs-site/package.json**

```json
{
  "name": "steven-docs",
  "private": true,
  "scripts": {
    "dev": "vitepress dev chapters",
    "build": "vitepress build chapters",
    "preview": "vitepress preview chapters"
  },
  "devDependencies": {
    "vitepress": "^1.6.0"
  }
}
```

- [ ] **Step 3: 安装 VitePress**

```bash
cd /Users/zhengwenjie/Documents/People/steven/docs-site && bun install
```

Expected: `node_modules/vitepress` 安装成功。

- [ ] **Step 4: 创建 docs-site/.vitepress/config.ts**

```typescript
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Build Your Own Coding Agent',
  description: '从 0 到 1 构建 Coding Agent CLI — 参考 Claude Code 架构，手写底层机制',
  srcDir: 'chapters',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
    ],
    sidebar: [
      {
        text: '第一章：最小可运行 Agent',
        items: [
          { text: '章节概述', link: '/01-agent-loop/' },
          { text: '1.1 项目脚手架', link: '/01-agent-loop/1.1-scaffold' },
          { text: '1.2 类型系统', link: '/01-agent-loop/1.2-types' },
          { text: '1.3 Anthropic 直连', link: '/01-agent-loop/1.3-anthropic-direct' },
          { text: '1.4 Agent Loop', link: '/01-agent-loop/1.4-query-loop' },
          { text: '1.5 Engine + CLI 串联', link: '/01-agent-loop/1.5-engine-cli' },
          { text: '实现笔记', link: '/01-agent-loop/notes' },
        ],
      },
      {
        text: '第二章：工具系统',
        items: [
          { text: '章节概述', link: '/02-tools/' },
          { text: '2.1 defineTool 工厂', link: '/02-tools/2.1-registry' },
          { text: '2.2 文件工具', link: '/02-tools/2.2-file-tools' },
          { text: '2.3 系统工具', link: '/02-tools/2.3-system-tools' },
          { text: '实现笔记', link: '/02-tools/notes' },
        ],
      },
      {
        text: '第三章：Provider 抽象',
        items: [
          { text: '章节概述', link: '/03-providers/' },
          { text: '3.1 LLMProvider 接口', link: '/03-providers/3.1-interface' },
          { text: '3.2 重构 Anthropic', link: '/03-providers/3.2-anthropic' },
          { text: '3.3 接入 OpenAI', link: '/03-providers/3.3-openai' },
          { text: '实现笔记', link: '/03-providers/notes' },
        ],
      },
    ],
    socialLinks: [],
    footer: {
      message: '从 0 到 1，理解 Coding Agent 的每一行代码',
    },
  },
})
```

- [ ] **Step 5: 验证 VitePress 配置语法正确**

```bash
cd /Users/zhengwenjie/Documents/People/steven/docs-site && bun run build 2>&1 | head -5
```

Expected: build 会因为缺少 `chapters/index.md` 报错，但不会有 TypeScript 语法错误。

- [ ] **Step 6: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add docs-site/
git -C /Users/zhengwenjie/Documents/People/steven commit -m "chore: init vitepress docs-site"
```

---

## Task 3: 首页内容

**Files:**
- Create: `docs-site/chapters/index.md`

- [ ] **Step 1: 创建首页 index.md**

```markdown
---
layout: home

hero:
  name: "Build Your Own Coding Agent"
  text: "从 0 到 1，手写一个 Coding Agent CLI"
  tagline: 参考 Claude Code 架构，不依赖任何 Agent 框架，彻底理解底层机制
  actions:
    - theme: brand
      text: 开始第一章
      link: /01-agent-loop/
    - theme: alt
      text: 查看 GitHub
      link: https://github.com

features:
  - title: 第一章：最小可运行 Agent
    details: Scaffold + Types + Anthropic 直连 + Agent Loop + CLI 入口，章节末尾真实对话跑通
  - title: 第二章：工具系统
    details: 实现 6 个真实工具（Read、Write、Bash、LS、Grep、ViewRange），Agent 能读写文件、执行命令
  - title: 第三章：Provider 抽象
    details: 将直连代码重构为可切换的 Provider 接口，加入 OpenAI，验证抽象设计
---
```

- [ ] **Step 2: 验证首页构建**

```bash
cd /Users/zhengwenjie/Documents/People/steven/docs-site && bun run build 2>&1 | grep -E "error|Error|✓" | head -10
```

Expected: 仍有章节页面缺失的 warning，但首页本身无 error。

- [ ] **Step 3: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add docs-site/chapters/index.md
git -C /Users/zhengwenjie/Documents/People/steven commit -m "docs: add docs site homepage"
```

---

## Task 4: 章节占位页面

**Files:** 所有 `chapters/0*/` 下的 markdown 文件

- [ ] **Step 1: 创建所有章节目录**

```bash
mkdir -p /Users/zhengwenjie/Documents/People/steven/docs-site/chapters/01-agent-loop
mkdir -p /Users/zhengwenjie/Documents/People/steven/docs-site/chapters/02-tools
mkdir -p /Users/zhengwenjie/Documents/People/steven/docs-site/chapters/03-providers
```

- [ ] **Step 2: 创建第一章占位文件**

`docs-site/chapters/01-agent-loop/index.md`:
```markdown
# 第一章：最小可运行 Agent

**目标：** 章节末尾 `bun run bin/index.ts -p "hello"` 跑通真实对话。

本章将从零开始搭建一个能真实运行的 Coding Agent CLI。不追求完美，只追求**能跑**。

## 本章内容

- [1.1 项目脚手架](./1.1-scaffold) — Bun 项目初始化
- [1.2 类型系统](./1.2-types) — Message 类型体系
- [1.3 Anthropic 直连](./1.3-anthropic-direct) — 不抽象，先跑通
- [1.4 Agent Loop](./1.4-query-loop) — query() AsyncGenerator 核心
- [1.5 Engine + CLI 串联](./1.5-engine-cli) — 把所有模块连起来
- [实现笔记](./notes) — 设计决策记录
```

`docs-site/chapters/01-agent-loop/1.1-scaffold.md`:
```markdown
# 1.1 项目脚手架

> 本节内容正在撰写中。
```

`docs-site/chapters/01-agent-loop/1.2-types.md`:
```markdown
# 1.2 类型系统

> 本节内容正在撰写中。
```

`docs-site/chapters/01-agent-loop/1.3-anthropic-direct.md`:
```markdown
# 1.3 Anthropic 直连

> 本节内容正在撰写中。
```

`docs-site/chapters/01-agent-loop/1.4-query-loop.md`:
```markdown
# 1.4 Agent Loop

> 本节内容正在撰写中。
```

`docs-site/chapters/01-agent-loop/1.5-engine-cli.md`:
```markdown
# 1.5 Engine + CLI 串联

> 本节内容正在撰写中。
```

`docs-site/chapters/01-agent-loop/notes.md`:
```markdown
# 第一章实现笔记

> 本节内容正在撰写中。
```

- [ ] **Step 3: 创建第二章占位文件**

`docs-site/chapters/02-tools/index.md`:
```markdown
# 第二章：工具系统

**目标：** Agent 能真正读写文件、执行命令，完成简单 coding 任务。

## 本章内容

- [2.1 defineTool 工厂](./2.1-registry)
- [2.2 文件工具](./2.2-file-tools) — Read、Write、ViewRange
- [2.3 系统工具](./2.3-system-tools) — Bash、LS、Grep
- [实现笔记](./notes)
```

`docs-site/chapters/02-tools/2.1-registry.md`:
```markdown
# 2.1 defineTool 工厂

> 本节内容正在撰写中。
```

`docs-site/chapters/02-tools/2.2-file-tools.md`:
```markdown
# 2.2 文件工具

> 本节内容正在撰写中。
```

`docs-site/chapters/02-tools/2.3-system-tools.md`:
```markdown
# 2.3 系统工具

> 本节内容正在撰写中。
```

`docs-site/chapters/02-tools/notes.md`:
```markdown
# 第二章实现笔记

> 本节内容正在撰写中。
```

- [ ] **Step 4: 创建第三章占位文件**

`docs-site/chapters/03-providers/index.md`:
```markdown
# 第三章：Provider 抽象

**目标：** `STEVEN_PROVIDER=openai` 无缝切换，不改一行 Agent Loop 代码。

## 本章内容

- [3.1 LLMProvider 接口](./3.1-interface)
- [3.2 重构 Anthropic](./3.2-anthropic)
- [3.3 接入 OpenAI](./3.3-openai)
- [实现笔记](./notes)
```

`docs-site/chapters/03-providers/3.1-interface.md`:
```markdown
# 3.1 LLMProvider 接口

> 本节内容正在撰写中。
```

`docs-site/chapters/03-providers/3.2-anthropic.md`:
```markdown
# 3.2 重构 Anthropic

> 本节内容正在撰写中。
```

`docs-site/chapters/03-providers/3.3-openai.md`:
```markdown
# 3.3 接入 OpenAI

> 本节内容正在撰写中。
```

`docs-site/chapters/03-providers/notes.md`:
```markdown
# 第三章实现笔记

> 本节内容正在撰写中。
```

- [ ] **Step 5: 验证完整构建通过**

```bash
cd /Users/zhengwenjie/Documents/People/steven/docs-site && bun run build
```

Expected:
```
vitepress v1.x.x
✓ building client + server bundles...
✓ rendering pages...
build complete in X.XXs
```
无 error，无 404 warning（所有侧边栏链接都有对应文件）。

- [ ] **Step 6: 本地预览验证**

```bash
cd /Users/zhengwenjie/Documents/People/steven && bun run docs:dev
```

Expected: 浏览器打开 `http://localhost:5173`，能看到首页，左侧侧边栏显示三章结构。

- [ ] **Step 7: Commit**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add docs-site/
git -C /Users/zhengwenjie/Documents/People/steven commit -m "docs: add all chapter placeholder pages"
```

---

## Task 5: Vercel 部署配置

**Files:**
- Create: `docs-site/vercel.json`

- [ ] **Step 1: 创建 vercel.json**

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": ".vitepress/dist",
  "installCommand": "bun install"
}
```

- [ ] **Step 2: 在 Vercel 控制台创建项目**

1. 打开 [vercel.com](https://vercel.com) → New Project
2. Import 当前 GitHub 仓库（需先将 steven 推送到 GitHub）
3. **Root Directory** 设置为 `docs-site`
4. Framework Preset 选 **Other**（VitePress 不在预设列表，`vercel.json` 会覆盖）
5. 点击 Deploy

- [ ] **Step 3: 推送到 GitHub 触发部署**

```bash
# 假设已在 GitHub 创建仓库并设置了 remote
git -C /Users/zhengwenjie/Documents/People/steven remote add origin <your-github-repo-url>
git -C /Users/zhengwenjie/Documents/People/steven push -u origin main
```

Expected: Vercel 自动触发构建，部署成功后获得访问 URL。

- [ ] **Step 4: Commit vercel.json**

```bash
git -C /Users/zhengwenjie/Documents/People/steven add docs-site/vercel.json
git -C /Users/zhengwenjie/Documents/People/steven commit -m "chore: add vercel deployment config"
git -C /Users/zhengwenjie/Documents/People/steven push
```

---

## Self-Review

**Spec coverage:**
- ✅ 根目录 Bun workspace（Task 1）
- ✅ `docs-site/` 独立 package，VitePress 配置（Task 2）
- ✅ 首页：项目介绍 + 学习路线（Task 3）
- ✅ 三章完整占位结构，含 notes.md（Task 4）
- ✅ Vercel 部署，Root Directory 指向 `docs-site`（Task 5）
- ✅ 侧边栏结构与 spec Section 3 章节表完全对应

**Placeholder scan:** 无 TBD/TODO，占位文件使用明确的"本节内容正在撰写中"。

**Type consistency:** 纯配置文件，无类型一致性问题。
