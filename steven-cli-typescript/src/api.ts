import Anthropic from "@anthropic-ai/sdk";

export const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  apiKey: process.env.ANTHROPIC_API_KEY || undefined,
});

export { Anthropic };
