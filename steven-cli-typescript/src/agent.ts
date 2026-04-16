import { Agent, createAnthropicProvider, type Message } from "steven-agent-sdk";
import { MODEL, SYSTEM } from "./config";
import { TOOLS } from "./tools/index";

const agent = new Agent({
	provider: createAnthropicProvider({
		apiKey: process.env.ANTHROPIC_API_KEY,
		baseURL: process.env.ANTHROPIC_BASE_URL,
	}),
	model: MODEL,
	system: SYSTEM,
	tools: TOOLS,
	maxTokens: 8000,
	onToolCall: (name, output) => {
		console.log(`> ${name}: ${output.slice(0, 200)}`);
	},
});

export async function agentLoop(messages: Message[]) {
	await agent.run(messages);
}
