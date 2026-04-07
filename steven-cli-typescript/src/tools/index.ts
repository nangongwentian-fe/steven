import Anthropic from "@anthropic-ai/sdk";
import { runBash } from "./bash";
import { runRead, runWrite, runEdit } from "./files";
import { runTodo, type TodoItem } from "./todo";

export const TOOLS: Anthropic.Tool[] = [
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
  },
  {
    name: "todo",
    description: "Update task list. Track progress on multi-step tasks.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"] }
            },
            required: ["id", "text", "status"]
          }
        }
      },
      required: ["items"]
    }
  }
];

export function runTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "bash": {
      const cmd = input.command as string;
      console.log(`\x1b[33m$ ${cmd}\x1b[0m`);
      return runBash(cmd);
    }
    case "read_file":
      return runRead(input.path as string, input.limit as number | undefined);
    case "write_file":
      return runWrite(input.path as string, input.content as string);
    case "edit_file":
      return runEdit(input.path as string, input.old_text as string, input.new_text as string);
    case "todo":
      return runTodo(input.items as TodoItem[]);
    default:
      return `Unknown tool: ${name}`;
  }
}
