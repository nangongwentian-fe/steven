import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  apiKey: process.env.ANTHROPIC_API_KEY || undefined,
});

const MODEL = process.env.MODEL_ID || "claude-sonnet-4-6";

const SYSTEM = `You are a coding agent at ${process.cwd()}. Use tools to solve tasks. Act, don't explain.`;

const WORKDIR = process.cwd();

function safePath(p: string): string {
  const resolved = path.resolve(WORKDIR, p);
  if (!resolved.startsWith(WORKDIR)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return resolved;
}

function runRead(filePath: string, limit?: number): string {
  try {
    const fp = safePath(filePath);
    const content = fs.readFileSync(fp, "utf-8");
    const lines = content.split('\n');
    if (limit && limit < lines.length) {
      return lines.slice(0, limit).join("\n") + `\n... (${lines.length - limit} more lines)`;
    }
    return content.slice(0, 50000);
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function runWrite(filePath: string, content: string): string {
  try {
    const fp = safePath(filePath);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, content);
    return `Wrote ${content.length} bytes to ${filePath}`;
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function runEdit(filePath: string, oldText: string, newText: string): string {
  try {
    const fp = safePath(filePath);
    const content = fs.readFileSync(fp, "utf-8");
    if (!content.includes(oldText)) {
      return `Error: Text not found in ${filePath}`;
    }
    fs.writeFileSync(fp, content.replace(oldText, newText));
    return `Edited ${filePath}`;
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "bash",
    description: "Run a shell command.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" }
      },
      required: ["command"]
    }
  },
  {
    name: "read_file",
    description: "Read file contents.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        limit: { type: "integer" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write content to file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "edit_file",
    description: "Replace exact text in file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" }
      },
      required: ["path", "old_text", "new_text"]
    }
  }
];

function runBash(command: string): string {
  const dangerous = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];
  if (dangerous.some(d => command.includes(d))) {
    return "Error: Dangerous command blocked";
  }
  try {
    const r = execSync(command, {
      encoding: "utf-8",
      cwd: process.cwd(),
      timeout: 120_000,
    });
    const out = r.trim();
    return out.slice(0, 50000) || "(no output)";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function agentLoop(messages: Anthropic.MessageParam[]) {
  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages,
      tools: TOOLS,
      max_tokens: 8000,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const input = block.input as Record<string, unknown>;
        let output: string;
        switch (block.name) {
          case "bash": {
            const cmd = input.command as string;
            console.log(`\x1b[33m$ ${cmd}\x1b[0m`);
            output = runBash(cmd);
            break;
          }
          case "read_file": {
            const fp = input.path as string;
            const limit = input.limit as number | undefined;
            output = runRead(fp, limit);
            break;
          }
          case "write_file": {
            const fp = input.path as string;
            const content = input.content as string;
            output = runWrite(fp, content);
            break;
          }
          case "edit_file": {
            const fp = input.path as string;
            const oldText = input.old_text as string;
            const newText = input.new_text as string;
            output = runEdit(fp, oldText, newText);
            break;
          }
          default:
            output = `Unknown tool: ${block.name}`;
        }
        console.log(`> ${block.name}: ${output.slice(0, 200)}`);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: output
        });
      }
    }
    messages.push({ role: "user", content: results });
  }
}

async function main() {
  const history: Anthropic.MessageParam[] = [];
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => new Promise<string>(resolve => rl.question("\x1b[36ms01 >> \x1b[0m", resolve));

  while (true) {
    const query = await prompt();
    if (["q", "exit", ""].includes(query.trim().toLowerCase())) {
      break;
    }
    history.push({ role: "user", content: query });
    await agentLoop(history);
    const lastMsg = history[history.length - 1]!;
    if (Array.isArray(lastMsg.content)) {
      for (const block of lastMsg.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
    }
    console.log();
  }
  rl.close();
}

main();
