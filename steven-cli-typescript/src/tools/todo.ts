export interface TodoItem {
	id: string;
	text: string;
	status: "pending" | "in_progress" | "completed";
}

export class TodoManager {
	private items: TodoItem[] = [];

	update(items: TodoItem[]): string {
		if (items.length > 20) {
			throw new Error("Max 20 todos allowed");
		}
		const validated: TodoItem[] = [];
		let inProgressCount = 0;
		for (const [index, item] of items.entries()) {
			const text = String(item.text ?? "").trim();
			const status = String(
				item.status ?? "pending",
			).toLowerCase() as TodoItem["status"];
			const itemId = String(item.id ?? String(index + 1));
			if (!text) {
				throw new Error(`Item ${itemId}: text required`);
			}
			if (!["pending", "in_progress", "completed"].includes(status)) {
				throw new Error(`Item ${itemId}: invalid status '${status}'`);
			}
			if (status === "in_progress") {
				inProgressCount++;
			}
			validated.push({ id: itemId, text, status });
		}
		if (inProgressCount > 1) {
			throw new Error("Only one task can be in_progress at a time");
		}
		this.items = validated;
		return this.render();
	}

	render(): string {
		if (this.items.length === 0) {
			return "No todos.";
		}
		const lines: string[] = [];
		for (const item of this.items) {
			const marker: Record<TodoItem["status"], string> = {
				pending: "[ ]",
				in_progress: "[>]",
				completed: "[x]",
			};
			lines.push(`${marker[item.status]} #${item.id}: ${item.text}`);
		}
		const done = this.items.filter((t) => t.status === "completed").length;
		lines.push(`\n(${done}/${this.items.length} completed)`);
		return lines.join("\n");
	}
}

export const TODO = new TodoManager();

export function runTodo(items: TodoItem[]): string {
	try {
		return TODO.update(items);
	} catch (e) {
		return `Error: ${e instanceof Error ? e.message : String(e)}`;
	}
}
