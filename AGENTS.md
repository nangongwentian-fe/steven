# AGENTS.md

## Workspace

Bun monorepo with 3 workspace packages defined in root `package.json`:

- **steven-cli-typescript** — hand-rolled coding agent CLI on `@anthropic-ai/sdk`
- **steven-cli-langchain** — same agent built with LangChain toolchain
- **docs-site** — VitePress documentation site

References live in `references/` (claude-code, codex, opencode, deerflow-harness) — read-only, do not edit.

## Commands

```sh
bun install                          # install all workspace deps
bun run index.ts                      # run the TS CLI agent (from steven-cli-typescript/)
bunx biome check .                    # lint + format check
bunx biome check --write .           # lint + format fix
bunx biome format --write .          # format only
bun test                              # run tests (none exist yet)
```

Root scripts: `docs:dev`, `docs:build`, `docs:preview` — delegate to `docs-site`.

## steven-cli-typescript Architecture

```
index.ts              readline REPL, prompts "s01 >> "
src/agent.ts          agentic loop: calls Anthropic API, dispatches tools, injects todo reminder
src/api.ts            Anthropic SDK client init
src/config.ts         MODEL, WORKDIR, SYSTEM prompt
src/tools/
  index.ts            tool definitions + dispatch router
  bash.ts             shell execution (blocks dangerous commands)
  files.ts            read/write/edit with WORKDIR sandbox via safePath()
  todo.ts             TodoManager (max 20 items, 1 in_progress at a time)
```

- Agent loop continues until `stop_reason !== "tool_use"`
- After 3 consecutive non-todo rounds, injects `<reminder>Update your todos.</reminder>`
- `safePath()` rejects paths that escape `WORKDIR`
- `bash.ts` blocks: `rm -rf /`, `sudo`, `shutdown`, `reboot`, `> /dev/`

## Environment

Bun auto-loads `.env` — do NOT use `dotenv`. Required vars (see `.env.example`):

- `ANTHROPIC_API_KEY` — required for official Anthropic API
- `ANTHROPIC_BASE_URL` — optional, for proxy/compatible endpoints
- `MODEL_ID` — optional, defaults to `claude-sonnet-4-6`

## Style & Conventions

- **Formatter**: Biome — indent with tabs, double quotes
- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- **Comments**: Do NOT add comments unless explicitly requested
- **Runtime**: Always use Bun, never Node.js directly
  - `bun <file>` not `node <file>` or `ts-node`
  - `bun install` not `npm install`
  - `bun test` not `jest` or `vitest`
  - `bunx <pkg>` not `npx`
- **TS config**: `strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noEmit`

## Testing

No tests exist yet. When adding them, use `bun:test`:

```ts
import { test, expect } from "bun:test";
```