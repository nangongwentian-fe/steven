import * as fs from "node:fs";
import * as path from "node:path";
import { WORKDIR } from "../config";

export function safePath(p: string): string {
	const resolved = path.resolve(WORKDIR, p);
	if (!resolved.startsWith(WORKDIR)) {
		throw new Error(`Path escapes workspace: ${p}`);
	}
	return resolved;
}

export function runRead(filePath: string, limit?: number): string {
	try {
		const fp = safePath(filePath);
		const content = fs.readFileSync(fp, "utf-8");
		const lines = content.split("\n");
		if (limit && limit < lines.length) {
			return `${lines.slice(0, limit).join("\n")}\n... (${lines.length - limit} more lines)`;
		}
		return content.slice(0, 50000);
	} catch (e) {
		return `Error: ${e instanceof Error ? e.message : String(e)}`;
	}
}

export function runWrite(filePath: string, content: string): string {
	try {
		const fp = safePath(filePath);
		fs.mkdirSync(path.dirname(fp), { recursive: true });
		fs.writeFileSync(fp, content);
		return `Wrote ${content.length} bytes to ${filePath}`;
	} catch (e) {
		return `Error: ${e instanceof Error ? e.message : String(e)}`;
	}
}

export function runEdit(
	filePath: string,
	oldText: string,
	newText: string,
): string {
	try {
		const fp = safePath(filePath);
		const content = fs.readFileSync(fp, "utf-8");
		if (!content.includes(oldText)) {
			return `Error: Text not found in ${filePath}`;
		}
		fs.writeFileSync(fp, content.replace(oldText, newText));
		return `Edited ${filePath}`;
	} catch (e) {
		return `Error: ${e instanceof Error ? e.message : String(e)}`;
	}
}
