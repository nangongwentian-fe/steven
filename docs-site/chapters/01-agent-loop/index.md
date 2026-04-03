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
