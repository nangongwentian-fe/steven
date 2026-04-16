import type { ToolDefinition } from "./tool";

export interface TextBlock {
	type: "text";
	text: string;
}

export interface ToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: unknown;
}

export type ContentBlock = TextBlock | ToolUseBlock;

export interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: string;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens";

export interface Message {
	role: "user" | "assistant";
	content: string | (ContentBlock | ToolResultBlock)[];
}

export interface GenerateOptions {
	model: string;
	system: string;
	messages: Message[];
	tools: ToolDefinition[];
	maxTokens: number;
}

export interface GenerateResult {
	content: ContentBlock[];
	stopReason: StopReason;
}

export interface Provider {
	generate(options: GenerateOptions): Promise<GenerateResult>;
}
