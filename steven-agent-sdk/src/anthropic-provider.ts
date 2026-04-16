import Anthropic from "@anthropic-ai/sdk";
import type {
	ContentBlock,
	GenerateOptions,
	GenerateResult,
	Message,
	Provider,
	StopReason,
} from "./provider";

function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
	return messages.map((message) => ({
		role: message.role,
		content:
			typeof message.content === "string"
				? message.content
				: message.content.map((block) => {
						if (block.type === "text") {
							return {
								type: "text",
								text: block.text,
							};
						}

						if (block.type === "tool_use") {
							return {
								type: "tool_use",
								id: block.id,
								name: block.name,
								input: block.input,
							};
						}

						return {
							type: "tool_result",
							tool_use_id: block.tool_use_id,
							content: block.content,
						};
					}),
	}));
}

function fromAnthropicContent(
	content: Anthropic.ContentBlock[],
): ContentBlock[] {
	const blocks: ContentBlock[] = [];

	for (const block of content) {
		if (block.type === "text") {
			blocks.push({
				type: "text",
				text: block.text,
			});
		}

		if (block.type === "tool_use") {
			blocks.push({
				type: "tool_use",
				id: block.id,
				name: block.name,
				input: block.input,
			});
		}
	}

	return blocks;
}

function fromAnthropicStopReason(
	stopReason: Anthropic.StopReason | null,
): StopReason {
	if (stopReason === "tool_use") {
		return "tool_use";
	}

	if (stopReason === "max_tokens") {
		return "max_tokens";
	}

	return "end_turn";
}

export function createAnthropicProvider(options?: {
	apiKey?: string;
	baseURL?: string;
}): Provider {
	const client = new Anthropic({
		apiKey: options?.apiKey,
		baseURL: options?.baseURL,
	});

	return {
		async generate(generateOptions: GenerateOptions): Promise<GenerateResult> {
			const response = await client.messages.create({
				model: generateOptions.model,
				system: generateOptions.system,
				messages: toAnthropicMessages(generateOptions.messages),
				tools: generateOptions.tools,
				max_tokens: generateOptions.maxTokens,
			});

			return {
				content: fromAnthropicContent(response.content),
				stopReason: fromAnthropicStopReason(response.stop_reason),
			};
		},
	};
}
