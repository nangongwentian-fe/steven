import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Steven Agent 设计文档',
  description: '从 0 到 1 构建 Coding Agent CLI，拆解每个模块的设计思路与实现细节',
  srcDir: './chapters',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '架构总览', link: '/overview' },
      { text: '模块拆解', link: '/modules/entry' },
    ],
    sidebar: [
      { text: '架构总览', link: '/overview' },
      {
        text: '模块拆解',
        items: [
          { text: '入口层 (index.ts)', link: '/modules/entry' },
          { text: 'Agent Loop', link: '/modules/agent-loop' },
          { text: 'API 层', link: '/modules/api-provider' },
          { text: '系统配置', link: '/modules/config' },
          {
            text: '工具系统',
            collapsed: false,
            items: [
              { text: '工具系统概览', link: '/modules/tools/' },
              { text: 'Bash 工具', link: '/modules/tools/bash' },
              { text: '文件工具', link: '/modules/tools/files' },
              { text: 'Todo 工具', link: '/modules/tools/todo' },
            ]
          }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/zhengwenjie/steven' }
    ],
    footer: {
      message: '先理解 Agent 为什么这样设计，再去实现它',
    },
  },
})
