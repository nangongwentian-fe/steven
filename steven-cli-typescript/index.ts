import * as readline from "readline";
import Anthropic from "@anthropic-ai/sdk";
import { agentLoop } from "./src/agent";

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
