import type { Message, Provider, ToolResultBlock } from "./provider";
import { executeTool, type Tool } from "./tool";

export interface AgentOptions {
	provider: Provider;
	model: string;
	system: string;
	tools: Tool[];
	maxTokens?: number;
	onToolCall?: (name: string, output: string) => void;
}

export class Agent {
	private readonly provider: Provider;
	private readonly model: string;
	private readonly system: string;
	private readonly tools: Tool[];
	private readonly maxTokens: number;
	private readonly onToolCall?: (name: string, output: string) => void;

	constructor(options: AgentOptions) {
		this.provider = options.provider;
		this.model = options.model;
		this.system = options.system;
		this.tools = options.tools;
		this.maxTokens = options.maxTokens ?? 8000;
		this.onToolCall = options.onToolCall;
	}

	async run(messages: Message[]): Promise<void> {
		const definitions = this.tools.map((tool) => tool.definition);

		while (true) {
			const response = await this.provider.generate({
				model: this.model,
				system: this.system,
				messages,
				tools: definitions,
				maxTokens: this.maxTokens,
			});

			messages.push({
				role: "assistant",
				content: response.content,
			});

			if (response.stopReason !== "tool_use") {
				return;
			}

			const results: ToolResultBlock[] = [];

			for (const block of response.content) {
				if (block.type !== "tool_use") {
					continue;
				}

				let output: string;

				try {
					output = executeTool(this.tools, block.name, block.input);
				} catch (error) {
					output =
						error instanceof Error
							? `Error: ${error.message}`
							: `Error: ${String(error)}`;
				}

				this.onToolCall?.(block.name, output);
				results.push({
					type: "tool_result",
					tool_use_id: block.id,
					content: output,
				});
			}

			messages.push({
				role: "user",
				content: results,
			});
		}
	}
}
