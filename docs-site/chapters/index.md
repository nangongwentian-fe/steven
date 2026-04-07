---
layout: home

hero:
  name: "Steven Agent"
  text: "设计文档"
  tagline: "一个从零构建的 Coding Agent CLI，7 个源文件，完整的 Agent Loop 实现。"
  actions:
    - theme: brand
      text: 架构总览
      link: /overview
    - theme: alt
      text: 查看源码
      link: https://github.com/zhengwenjie/steven

features:
  - title: 入口层 (index.ts)
    details: readline REPL + 共享 history 数组，把多轮对话状态收拢到一个地方管理。
    link: /modules/entry
  - title: Agent Loop
    details: while 循环驱动，stop_reason 控制终止，roundsSinceTodo 计数器确保任务追踪不失控。
    link: /modules/agent-loop
  - title: API 层
    details: 极简的 Anthropic SDK 封装，支持 baseURL 覆盖，一行代码切换代理或本地部署。
    link: /modules/api-provider
  - title: 系统配置
    details: MODEL / WORKDIR / SYSTEM 三个常量，环境变量优先，零魔法字符串。
    link: /modules/config
  - title: 工具系统
    details: 统一的 (name, input) → string 接口，中央分发器模式，4 类工具覆盖文件、命令、任务。
    link: /modules/tools/
  - title: 安全边界
    details: safePath 路径沙箱 + DANGEROUS 命令黑名单 + 超时截断，防御性工具设计。
    link: /modules/tools/bash
---
