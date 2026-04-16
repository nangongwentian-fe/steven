import { defineTool } from "steven-agent-sdk";
import { z } from "zod";
import { runBash } from "./bash";
import { runEdit, runRead, runWrite } from "./files";
import { runTodo } from "./todo";

const todoItemSchema = z.object({
	id: z.string(),
	text: z.string(),
	status: z.enum(["pending", "in_progress", "completed"]),
});

export const bashTool = defineTool({
	name: "bash",
	description: "Run a shell command.",
	schema: z.object({
		command: z.string(),
	}),
	handler: ({ command }) => {
		console.log(`\x1b[33m$ ${command}\x1b[0m`);
		return runBash(command);
	},
});

export const readFileTool = defineTool({
	name: "read_file",
	description: "Read file contents.",
	schema: z.object({
		path: z.string(),
		limit: z.number().int().optional(),
	}),
	handler: ({ path, limit }) => runRead(path, limit),
});

export const writeFileTool = defineTool({
	name: "write_file",
	description: "Write content to file.",
	schema: z.object({
		path: z.string(),
		content: z.string(),
	}),
	handler: ({ path, content }) => runWrite(path, content),
});

export const editFileTool = defineTool({
	name: "edit_file",
	description: "Replace exact text in file.",
	schema: z.object({
		path: z.string(),
		old_text: z.string(),
		new_text: z.string(),
	}),
	handler: ({ path, old_text, new_text }) => runEdit(path, old_text, new_text),
});

export const todoTool = defineTool({
	name: "todo",
	description: "Update task list. Track progress on multi-step tasks.",
	schema: z.object({
		items: z.array(todoItemSchema),
	}),
	handler: ({ items }) => runTodo(items),
});

export const TOOLS = [
	bashTool,
	readFileTool,
	writeFileTool,
	editFileTool,
	todoTool,
];
