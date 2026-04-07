import { execSync } from "child_process";

const DANGEROUS = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];

export function runBash(command: string): string {
  if (DANGEROUS.some(d => command.includes(d))) {
    return "Error: Dangerous command blocked";
  }
  try {
    const r = execSync(command, {
      encoding: "utf-8",
      cwd: process.cwd(),
      timeout: 120_000,
    });
    const out = r.trim();
    return out.slice(0, 50000) || "(no output)";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
