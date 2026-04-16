import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface ToolDefinition {
	name: string;
	description: string;
	input_schema: {
		type: "object";
		properties?: unknown | null;
		required?: string[] | null;
		[key: string]: unknown;
	};
}

export interface Tool<T extends z.ZodType = z.ZodType> {
	name: string;
	description: string;
	schema: T;
	handler(input: z.infer<T>): string;
	definition: ToolDefinition;
}

export function defineTool<T extends z.ZodType>(options: {
	name: string;
	description: string;
	schema: T;
	handler: (input: z.infer<T>) => string;
}): Tool<T> {
	const inputSchema = zodToJsonSchema(options.schema, {
		target: "openApi3",
		$refStrategy: "none",
	}) as Record<string, unknown>;

	return {
		name: options.name,
		description: options.description,
		schema: options.schema,
		handler: options.handler,
		definition: {
			name: options.name,
			description: options.description,
			input_schema: {
				type: "object",
				...inputSchema,
			},
		},
	};
}

export function executeTool(
	tools: readonly Tool[],
	name: string,
	rawInput: unknown,
): string {
	const tool = tools.find((item) => item.name === name);

	if (!tool) {
		throw new Error(`Unknown tool: ${name}`);
	}

	const input = tool.schema.parse(rawInput);
	return tool.handler(input);
}
