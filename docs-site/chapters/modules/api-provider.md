# API 层

**文件：** `src/api.ts` · 8 行

API 层是 Anthropic SDK 的最小封装，只做一件事：初始化一个全局 `client` 实例，并把配置入口暴露出来。

## 模块职责

- 初始化 `Anthropic` SDK 客户端
- 支持通过环境变量覆盖 `baseURL` 和 `apiKey`
- 重新导出 `Anthropic` 类型，让其他模块无需重复引入

## 核心代码

```typescript
import Anthropic from "@anthropic-ai/sdk";

export const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  apiKey: process.env.ANTHROPIC_API_KEY || undefined,
});

export { Anthropic };
```

## 设计决策

### 为什么单独抽一层，而不是在 `agent.ts` 里直接 `new Anthropic()`？

两个原因：

1. **可替换性**：将来如果要切换到 OpenAI 兼容接口或本地模型，只需改 `api.ts` 这一个文件，其余模块不受影响。
2. **单例保证**：`client` 作为模块级常量只初始化一次，避免在循环中重复创建客户端对象。

### `ANTHROPIC_BASE_URL` 覆盖的用途

```bash
# 使用代理
ANTHROPIC_BASE_URL=https://my-proxy.example.com bun index.ts

# 本地部署（如 LM Studio、Ollama 的 Anthropic 兼容端点）
ANTHROPIC_BASE_URL=http://localhost:11434/v1 bun index.ts
```

SDK 会把所有请求发到这个 base URL，路径结构保持不变（`/v1/messages` 等）。

### `|| undefined` 而不是直接省略

```typescript
baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
```

如果环境变量未设置，`process.env.X` 返回 `undefined`，但如果显式设为空字符串 `""`，SDK 可能会用空字符串覆盖默认值。`|| undefined` 确保空字符串也走默认逻辑。

### 重新导出 `Anthropic`

```typescript
export { Anthropic };
```

`agent.ts` 需要 `Anthropic.MessageParam` 等类型，从 `./api` 统一导入，避免每个文件都写 `import Anthropic from "@anthropic-ai/sdk"`。

## 关键细节

| 环境变量 | 默认行为 | 覆盖场景 |
|----------|----------|----------|
| `ANTHROPIC_API_KEY` | 读取 `~/.anthropic/api_key` 或报错 | CI 环境、密钥轮换 |
| `ANTHROPIC_BASE_URL` | 直连 `api.anthropic.com` | 代理、本地部署、测试 mock |
