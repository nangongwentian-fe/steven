import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Build Your Own Coding Agent',
  description: '从 0 到 1 构建 Coding Agent CLI — 参考 Claude Code 架构，手写底层机制',
  srcDir: './chapters',
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
