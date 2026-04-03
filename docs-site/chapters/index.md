---
layout: home

hero:
  name: "Build Your Own Coding Agent"
  text: "从 0 到 1，手写一个 Coding Agent CLI"
  tagline: 参考 Claude Code 架构，不依赖任何 Agent 框架——彻底理解底层机制
  actions:
    - theme: brand
      text: 开始第一章
      link: /01-agent-loop/
    - theme: alt
      text: GitHub
      link: https://github.com/nangongwentian-fe/steven

features:
  - icon: 🔁
    title: 第一章：最小可运行 Agent
    details: Scaffold + Types + Anthropic 直连 + Agent Loop + CLI 入口。章节末尾 Agent 能真实对话，用 AsyncGenerator 驱动流式输出。
    link: /01-agent-loop/
    linkText: 开始学习
  - icon: 🔧
    title: 第二章：工具系统
    details: 实现 6 个真实工具（Read、Write、Bash、LS、Grep、ViewRange）。Agent 能读写文件、搜索代码、执行命令——成为真正的 Coding Agent。
    link: /02-tools/
    linkText: 开始学习
  - icon: ⚡
    title: 第三章：Provider 抽象
    details: 将直连代码重构为可切换的 LLMProvider 接口，接入 OpenAI。改一个环境变量 STEVEN_PROVIDER=openai 即可切换，Agent Loop 代码一行不改。
    link: /03-providers/
    linkText: 开始学习
---
