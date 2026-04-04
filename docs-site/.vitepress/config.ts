import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Build Your Own Coding Agent',
  description: '从 0 到 1 构建 Coding Agent CLI，先建立心智模型，再写最小实现',
  srcDir: './chapters',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
    ],
    sidebar: [],
    socialLinks: [],
    footer: {
      message: '先理解 Agent 为什么这样设计，再去实现它',
    },
  },
})
