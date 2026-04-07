export const MODEL = process.env.MODEL_ID || "claude-sonnet-4-6";
export const WORKDIR = process.cwd();
export const SYSTEM = `You are a coding agent at ${WORKDIR}.
Use the todo tool to plan multi-step tasks. Mark in_progress before starting, completed when done.
Prefer tools over prose.`;
