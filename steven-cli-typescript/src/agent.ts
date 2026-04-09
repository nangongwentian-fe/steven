import Anthropic from "@anthropic-ai/sdk";
import { client } from "./api";
import { MODEL, SYSTEM } from "./config";
import { TOOLS, runTool } from "./tools/index";

export async function agentLoop(messages: Anthropic.MessageParam[]) {
	let roundsSinceTodo = 0;
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

		const results: (
			| Anthropic.ToolResultBlockParam
			| Anthropic.TextBlockParam
		)[] = [];
		let usedTodo = false;
		for (const block of response.content) {
			if (block.type === "tool_use") {
				const output = runTool(
					block.name,
					block.input as Record<string, unknown>,
				);
				if (block.name === "todo") usedTodo = true;
				console.log(`> ${block.name}: ${output.slice(0, 200)}`);
				results.push({
					type: "tool_result",
					tool_use_id: block.id,
					content: output,
				});
			}
		}
		roundsSinceTodo = usedTodo ? 0 : roundsSinceTodo + 1;
		if (roundsSinceTodo >= 3) {
			results.unshift({
				type: "text",
				text: "<reminder>Update your todos.</reminder>",
			});
		}
		messages.push({ role: "user", content: results });
	}
}
