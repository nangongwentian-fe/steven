# steven TUI 实现计划

## 1 现状分析

### 当前 REPL 问题

steven 当前使用 Node.js 原生 `readline` 阻塞式循环：

- **单行输入** — `rl.question()` 只支持单行，无法多行编辑
- **全量阻塞** — `agentLoop` 期间 REPL 完全阻塞，无法接受新输入
- **无流式输出** — agent 全部执行完才一次性打印结果
- **无滚动** — 输出超出终端高度后只能靠终端回滚
- **无工具可视化** — 工具调用仅 `console.log` 打印摘要
- **无交互控件** — 无权限确认、无命令补全、无搜索

### 当前代码结构

```
index.ts              readline REPL, "s01 >> " 提示符
src/agent.ts          agentLoop: 同步 while 循环, 直接修改 messages 数组
src/api.ts            Anthropic SDK client 初始化
src/config.ts         MODEL / WORKDIR / SYSTEM prompt
src/tools/
  index.ts            5 个工具定义 + switch 路由
  bash.ts             execSync 同步执行, 黑名单拦截
  files.ts            read/write/edit, safePath() 沙箱
  todo.ts             TodoManager 单例, max 20 项
```

### Claude Code TUI 架构参考

Claude Code 在自建深度定制的 Ink 框架基础上构建 TUI：

| 层 | 技术 | 说明 |
|---|---|---|
| 渲染引擎 | React 19 + react-reconciler + Yoga | 自定义 React 渲染器 → 终端单元格 |
| 布局 | Yoga Flexbox | CSS Flexbox 子集，原生性能 |
| 双缓冲 | frontFrame / backFrame diff | 只写变化的单元格 |
| 输入 | Kitty 键盘协议 + xterm modifyOtherKeys | 精确组合键检测 |
| 核心组件 | ScrollBox, VirtualMessageList, PromptInput | 全部自建 |
| 流式输出 | stream API + throttle(16ms) | 逐 token 更新 React state |

关键自建组件（Ink 不提供）：

- **ScrollBox** — 可滚动区域，虚拟化渲染
- **VirtualMessageList** — 只渲染可视区消息，overscan 缓冲
- **PromptInput** — 多行输入、光标管理、历史导航、IME 兼容
- **StreamingMarkdown** — 流式 Markdown 渲染
- **AltScreen** — 全屏模式切换（退出后恢复终端历史）

---

## 2 技术选型

### 框架：Ink 7.x + React 19

| 选项 | 优势 | 劣势 |
|---|---|---|
| **Ink（推荐）** | React 声明式、Flexbox 布局、生态成熟、Claude Code 已验证 | 滚动/全屏需自建 |
| blessed/neoblessed | 完整终端原语、内置滚动 | 命令式、不维护、无 TS |
| 终端裸 ANSI | 完全控制 | 所有组件从零写 |

### 新增依赖

```
ink@^7.0.0              TUI 框架
react@^19.2.0           组件模型（Ink 7 依赖）
react-reconciler@^0.33  Ink 内部依赖
chalk@^5.3.0            终端着色
lodash.throttle@^4.1.1  渲染节流
```

> 注意：Bun 原生支持 `jsx: "react-jsx"`（tsconfig.json 已配置），无需额外 JSX 转换配置。

### 自建 vs 依赖

| 组件 | Ink 内置 | 需要自建 | 难度 |
|---|---|---|---|
| Box / Text / Flexbox 布局 | ✅ | — | — |
| 键盘输入 (useInput) | ✅ | 多行光标管理 | 中 |
| 全屏模式 | ⚠️ 有限 | Alt-screen 管理 | 高 |
| 滚动区域 | ❌ | ScrollBox | **高** |
| 虚拟列表 | ❌ | VirtualMessageList | **高** |
| Markdown 渲染 | ❌ | StreamingMarkdown | 中 |
| 流式 Token | ❌ | throttle + state | 低 |
| 工具卡片 | ❌ | ToolCard | 低 |
| 权限对话框 | ❌ | Dialog | 低 |

---

## 3 分阶段路线图

### 阶段 1：基础 TUI 框架

**目标**：替换 readline，实现 Ink 渲染的上下分区布局，基本消息展示 + 单行输入。

**完成标准**：
- [ ] Ink 应用启动，终端进入全屏模式
- [ ] 上半区显示消息列表（文本内容，暂不做滚动优化）
- [ ] 下半区显示输入提示符，接受用户输入
- [ ] 用户输入 → 触发 agent loop → 消息追加到列表
- [ ] agent 响应文本实时显示在消息区
- [ ] `q` / `exit` / Ctrl+C 正常退出
- [ ] 当前所有工具功能不受影响

**新增文件**：

```
src/tui/
  app.tsx              Ink 根组件，管理消息状态与 agent loop 生命周期
  layout.tsx           FullscreenLayout：上 ScrollRegion + 下 InputRegion
  message-list.tsx     消息列表（初期：全量渲染，不做虚拟化）
  message-item.tsx     单条消息渲染（text / tool_use / tool_result）
  input-area.tsx       输入区域（初期：单行输入 + 提交按钮）
  status-bar.tsx       底部状态栏（模型名、working 目录）
  types.ts             类型定义：Message, AgentState, 等
  hooks/
    use-agent.ts       agent loop 状态管理 hook
    use-messages.ts    消息列表状态管理 hook（useReducer）
```

**关键改动**：

1. **`index.ts`** — 从 readline 循环改为 `render(<App />)`：
   ```ts
   import { render } from "ink";
   import { App } from "./src/tui/app";

   render(<App />);
   ```

2. **`src/agent.ts`** — 重构为状态机 / generator 模式：
   - 不再直接修改 `messages` 数组和 `console.log`
   - 改为 yield 中间状态（`"text_delta"`, `"tool_use"`, `"tool_result"`）
   - 由 React hook 消费 yield 的事件并更新 state
   - 流式 API：`client.messages.stream()` 逐 token 产出

3. **`src/tools/index.ts`** — `runTool` 不再返回 string，改为 yield 事件：
   - 工具开始时 yield `{ type: "tool_start", name, input }`
   - 工具结束时 yield `{ type: "tool_end", name, output }`
   - 由 TUI 层消费并渲染为卡片

**关键接口定义**：

```ts
// src/tui/types.ts

type AgentEventType =
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_end"; id: string; name: string; output: string }
  | { type: "thinking_delta"; text: string }
  | { type: "done"; stopReason: string };

interface MessageBlock {
  id: string;
  type: "text" | "tool_use" | "tool_result";
  // ... 各类型特有字段
}

interface Message {
  id: string;
  role: "user" | "assistant";
  blocks: MessageBlock[];
}

type AgentState = "idle" | "running" | "streaming" | "tool_running";
```

**Agent loop 重构伪代码**：

```ts
// src/agent.ts — 改为 async generator
export async function* agentLoop(
  messages: Anthropic.MessageParam[],
): AsyncGenerator<AgentEventType> {
  const stream = client.messages.stream({
    model: MODEL,
    system: SYSTEM,
    messages,
    tools: TOOLS,
    max_tokens: 8000,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      yield { type: "text_delta", text: event.delta.text };
    }
    // ... 处理其他事件类型
  }

  // 处理 tool_use → yield tool_start → runTool → yield tool_end
  // 递归调用 agentLoop 处理后续轮次
}
```

---

### 阶段 2：流式输出 + 工具卡片

**目标**：接入 Anthropic stream API，逐 token 渲染；工具调用展示为可折叠卡片。

**完成标准**：
- [ ] Anthropic `messages.stream()` 接入，逐 token 更新 UI
- [ ] 流式 Markdown 渲染（代码块、粗体、列表等基本语法）
- [ ] 工具调用渲染为独立卡片（显示工具名、输入摘要、输出摘要）
- [ ] 工具卡片可折叠/展开（按 Enter 切换）
- [ ] Bash 工具输出用边框包裹，保留 ANSI 着色
- [ ] 流式渲染使用 throttle（16ms）避免过度重绘

**新增文件**：

```
src/tui/
  streaming-markdown.tsx   流式 Markdown 渲染组件
  tool-card.tsx            工具调用卡片组件（折叠/展开）
  bash-output.tsx          Bash 输出渲染（ANSI 保留）
  hooks/
    use-stream.ts          流式 API 事件消费 hook
```

**关键改动**：

1. **`src/tui/app.tsx`** — 使用 `useStream` hook 消费流式事件：
   - `text_delta` 事件追加到当前 assistant 消息的文本 buffer
   - `tool_start` 创建新卡片，进入折叠态
   - `tool_end` 更新卡片内容，自动展开
   - 使用 `lodash.throttle` 合并多个 delta 为一帧

2. **流式 Markdown** — 初期实现策略：
   - 维护一个累积文本 buffer
   - 每个 throttle 帧，将完整 buffer 解析为简单 Markdown AST
   - 渲染为 Ink `<Text>` + `<Box>` 树
   - 支持的语法：段落、粗体、代码块（\`行内\` 和 \`\`\`围栏\`\`\`）、列表、标题

3. **工具卡片** — 使用 Ink `<Box borderStyle>` 包裹：
   ```
   ┌─ bash ──────────────────────────┐
   │ $ npm test                       │
   │ 3 passed, 0 failed              │
   └──────────────────────────────────┘
   ```

---

### 阶段 3：滚动 + 交互

**目标**：虚拟滚动、键盘/鼠标滚动、搜索高亮、新消息提示。

**完成标准**：
- [ ] VirtualMessageList：只渲染可视区消息 + overscan 缓冲
- [ ] 滚轮和键盘（↑/↓, PageUp/PageDown, Home/End）滚动
- [ ] 新消息自动滚动到底部
- [ ] 用户向上滚动时暂停自动滚动，显示 "N new messages" 提示
- [ ] `/` 进入搜索模式，高亮匹配结果
- [ ] 窗口 resize 正确处理
- [ ] 长对话（1000+ 消息）性能稳定

**新增文件**：

```
src/tui/
  virtual-message-list.tsx   虚拟化消息列表组件
  scroll-region.tsx          滚动区域容器
  new-messages-pill.tsx      新消息提示浮层
  search-bar.tsx             搜索输入栏
  hooks/
    use-virtual-scroll.ts    虚拟滚动逻辑 hook
    use-scroll-position.ts   滚动位置追踪 hook
```

**关键设计**：

1. **VirtualMessageList** 原理：
   - 维护 `heightCache: Map<string, number>` 存储每条消息渲染后高度
   - 只渲染 `scrollTop` 到 `scrollTop + viewportHeight` 范围内的消息 + overscan
   - 上方留 `<Box height={topSpacer}>` 占位，下方留 `<Box height={bottomSpacer}>`
   - 新消息到来时，如果在底部则自动滚动，否则记录未读数

2. **滚动实现**（阶段 3 先用简易方案）：
   - 使用 Ink 的 `useInput` 捕获按键
   - 维护 `scrollTop` state
   - 渲染时根据 `scrollTop` 计算可见范围
   - 阶段 4 再考虑接入 Ink 内部滚动或自定义 ScrollBox

3. **搜索**：
   - `/` 键进入搜索模式，底部输入框切换为搜索框
   - `Enter` 跳转到下一个匹配
   - `Escape` 退出搜索
   - 匹配文本高亮（反转色）

---

### 阶段 4：打磨

**目标**：多行输入、IME 兼容、命令历史、权限确认、斜杠命令。

**完成标准**：
- [ ] 多行输入：Shift+Enter 换行，Enter 提交
- [ ] 粘贴处理：长文本自动折叠为 [Paste #N]
- [ ] 命令历史：↑/↓ 浏览历史命令
- [ ] IME 兼容：正确处理中文/日文输入法
- [ ] 权限确认对话框：危险操作（如 bash 删除命令）弹出确认
- [ ] 斜杠命令：/clear, /compact, /model 等
- [ ] 退出时正确恢复终端状态

**新增文件**：

```
src/tui/
  prompt-input.tsx          多行输入组件（光标、历史、粘贴）
  dialog-overlay.tsx        权限确认对话框浮层
  slash-commands.ts         斜杠命令注册与处理
  suggestion-overlay.tsx    命令补全浮层
  hooks/
    use-prompt-history.ts   命令历史管理 hook
    use-ime-cursor.ts       IME 光标定位 hook
```

**关键设计**：

1. **PromptInput** — 基于 Ink `useInput` 扩展：
   - 维护 `Cursor` 对象（offset + columns），支持光标移动、选择
   - `maxVisibleLines` 限制输入框最大高度
   - 视口滚动：超出部分只渲染可见行
   - 粘贴阈值：超过 500 字符自动折叠

2. **权限确认**：
   - 工具执行前检查是否需要确认（如 bash 危险命令）
   - 弹出 `<DialogOverlay>` 覆盖在消息区上方
   - 选项：Allow / Deny / Allow all for this session

3. **斜杠命令**：
   - `/clear` — 清空消息历史
   - `/compact` — 压缩历史上下文
   - `/model <name>` — 切换模型
   - `/help` — 显示帮助
   - 输入 `/` 时弹出补全菜单

---

## 4 渲染管线

```
用户输入 / Stream 事件
       ↓
  React dispatch (useReducer)
       ↓
  state 更新 → 触发组件重渲染
       ↓
  scheduleRender (throttle 16ms)
       ↓
  Ink reconciler → DOM 树 diff
       ↓
  Yoga Layout 计算 Flexbox
       ↓
  renderNodeToOutput → Screen buffer
       ↓
  diff (frontFrame ↔ backFrame)
       ↓
  写入终端 (ANSI escape sequences)
```

---

## 5 风险与缓解

| 风险 | 影响 | 缓解策略 |
|---|---|---|
| Ink 无原生滚动 | 无法长对话滚动 | 阶段 1 截断显示，阶段 3 自建虚拟滚动 |
| Ink fullscreen 模式 bug | 退出后终端异常 | 阶段 1 用 inline 模式，验证稳定后再切全屏 |
| 流式渲染性能 | 高频 token 导致卡顿 | throttle 16ms + React.memo + 稳定 key |
| 长对话内存 | OOM | VirtualMessageList 只渲染可见行 |
| Agent loop 与 React 集成 | 状态同步困难 | useReducer 管理消息，useRef 存 agent 实例 |
| 多行输入复杂度 | 光标/IME/历史交互复杂 | 阶段 1 先单行，阶段 4 再多行 |

---

## 6 参考

- [Ink GitHub](https://github.com/vadimdemedes/ink) — React for CLI
- [Ink 7.0 Breaking Changes](https://github.com/vadimdemedes/ink/releases) — React 19, Yoga 3.2
- [Claude Code 源码](../references/claude-code/) — 自定义 Ink + ScrollBox + VirtualMessageList
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — Ink 6 + MaxSizedBox workaround
- [Ink Issue #765](https://github.com/vadimdemedes/ink/issues/765) — 滚动支持提案