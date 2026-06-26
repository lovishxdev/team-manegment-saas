import type { TaskPriority, TaskScope, TaskStatus } from "@/lib/generated/prisma/client";
import { taskUrl } from "@/lib/app-url";
import { displayUser } from "@/lib/username";

export type BoardTask = {
  shortId: number;
  title: string;
  status: TaskStatus;
  scope: TaskScope;
  priority: TaskPriority;
  dueDate: Date | null;
  tags: string[];
  assignedTo: { email: string | null; username: string | null } | null;
};

export type BoardSnapshot = {
  workspaceId: string;
  workspaceName: string;
  board: Record<"TODO" | "IN_PROGRESS" | "DONE", BoardTask[]>;
  totalTasks: number;
};

export type Channel = "whatsapp" | "mcp";

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

function formatTaskLine(task: BoardTask, channel: Channel): string {
  if (channel === "whatsapp") {
    let line = `#${task.shortId} ${task.title}`;
    if (task.priority === "HIGH") line += " ⚠";
    if (task.dueDate) line += ` (due ${task.dueDate.toISOString().slice(0, 10)})`;
    if (task.assignedTo) line += ` @${displayUser(task.assignedTo)}`;
    return line;
  }

  let line = `  #${task.shortId} ${task.title} [${task.scope}, ${task.priority}]`;
  if (task.tags.length) line += ` {${task.tags.join(", ")}}`;
  if (task.dueDate) line += ` due ${task.dueDate.toISOString().slice(0, 10)}`;
  if (task.assignedTo) line += ` -> @${displayUser(task.assignedTo)}`;
  return line;
}

function formatSection(
  label: string,
  tasks: BoardTask[],
  channel: Channel
): string | null {
  if (tasks.length === 0) return null;

  if (channel === "whatsapp") {
    return `*${label}*\n${tasks.map((t) => formatTaskLine(t, channel)).join("\n")}`;
  }

  return `${label} (${tasks.length})\n${tasks.map((t) => formatTaskLine(t, channel)).join("\n")}`;
}

export function formatBoardState(snapshot: BoardSnapshot, channel: Channel): string {
  const { workspaceName, board, totalTasks } = snapshot;

  if (totalTasks === 0) {
    return channel === "whatsapp"
      ? `📋 *${workspaceName}* is empty. Send me a task to get started.`
      : `Board for "${workspaceName}" is empty.`;
  }

  const header =
    channel === "whatsapp"
      ? `📋 Board · *${workspaceName}* (${totalTasks} tasks)`
      : `Board for "${workspaceName}" - ${totalTasks} task(s)`;

  const sections = [
    formatSection(STATUS_LABEL.TODO, board.TODO, channel),
    formatSection(STATUS_LABEL.IN_PROGRESS, board.IN_PROGRESS, channel),
    formatSection(STATUS_LABEL.DONE, board.DONE, channel),
  ].filter(Boolean);

  return [header, ...sections].join("\n\n");
}

export function formatTaskSummary(
  task: {
    shortId: number;
    title: string;
    status: TaskStatus;
    scope: TaskScope;
    priority: TaskPriority;
    dueDate: Date | null;
    assignedTo: { email: string | null; username: string | null } | null;
  },
  workspaceName: string,
  channel: Channel
): string {
  const parts = [`${task.scope}`, `${task.priority}`];
  if (task.dueDate) parts.push(`due ${task.dueDate.toISOString().slice(0, 10)}`);
  if (task.assignedTo) parts.push(`@${displayUser(task.assignedTo)}`);

  if (channel === "whatsapp") {
    return `#${task.shortId} *${task.title}* (${parts.join(", ")}) · ${workspaceName}`;
  }

  return `#${task.shortId} "${task.title}" (${parts.join(", ")}) in ${workspaceName}`;
}

export function formatTaskDeepLink(
  workspaceId: string,
  shortId: number,
  channel: Channel
): string {
  const url = taskUrl(workspaceId, shortId);
  return channel === "whatsapp" ? `\nOpen: ${url}` : `\nLink: ${url}`;
}

export function formatActionSummary(
  actionResults: string[],
  budgetExhausted: boolean,
  channel: Channel
): string {
  if (actionResults.length === 0) {
    return channel === "whatsapp"
      ? 'I can create tasks, tag uploaded photos/files, or show your board. Try: "add a task to fix the login bug" or send *menu*.'
      : "No actions were taken.";
  }

  const lines = actionResults.map((r, i) => `${i + 1}. ${r}`);
  const header = budgetExhausted
    ? "I ran out of action budget before finishing everything. Here's what actually happened:"
    : channel === "whatsapp"
      ? "✅ Done. Here's what happened:"
      : "Done. Here's what happened:";
  const footer = budgetExhausted
    ? "\n\nSend any remaining steps as a new message and I'll continue."
    : "";

  return `${header}\n\n${lines.join("\n")}${footer}`;
}
