import type { TaskPriority, TaskStatus } from "@/lib/generated/prisma/client";
import { taskUrl } from "@/lib/app-url";
import { assetFileName } from "@/lib/services/project";
import { displayUser } from "@/lib/username";

export type BoardTask = {
  shortId: number;
  title: string;
  status: TaskStatus;
  categoryName: string;
  priority: TaskPriority;
  dueDate: Date | null;
  tags: string[];
  assignees: { email: string | null; username: string | null }[];
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
    if (task.tags?.length) line += ` [${task.tags.join(", ")}]`;
    if (task.dueDate) line += ` (due ${task.dueDate.toISOString().slice(0, 10)})`;
    if (task.assignees.length) {
      line += ` ${task.assignees.map((u) => `@${displayUser(u)}`).join(", ")}`;
    }
    return line;
  }

  let line = `  #${task.shortId} ${task.title} [${task.categoryName}, ${task.priority}]`;
  if (task.tags.length) line += ` {${task.tags.join(", ")}}`;
  if (task.dueDate) line += ` due ${task.dueDate.toISOString().slice(0, 10)}`;
  if (task.assignees.length) {
    line += ` -> ${task.assignees.map((u) => `@${displayUser(u)}`).join(", ")}`;
  }
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

export function toBoardTask(task: {
  shortId: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  tags: string[];
  assignees: { user: { email: string | null; username: string | null } }[];
  category: { name: string };
}): BoardTask {
  return {
    shortId: task.shortId,
    title: task.title,
    status: task.status,
    categoryName: task.category.name,
    priority: task.priority,
    dueDate: task.dueDate,
    tags: task.tags,
    assignees: task.assignees.map((a) => a.user),
  };
}

export function mapBoardSnapshot(board: Record<
  "TODO" | "IN_PROGRESS" | "DONE",
  Array<{
    shortId: number;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    tags: string[];
    assignees: { user: { email: string | null; username: string | null } }[];
    category: { name: string };
  }>
>): Record<"TODO" | "IN_PROGRESS" | "DONE", BoardTask[]> {
  return {
    TODO: board.TODO.map(toBoardTask),
    IN_PROGRESS: board.IN_PROGRESS.map(toBoardTask),
    DONE: board.DONE.map(toBoardTask),
  };
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
    categoryName?: string;
    category?: { name: string };
    assignees?: Array<
      | { email: string | null; username: string | null }
      | { user: { email: string | null; username: string | null } }
    >;
    priority: TaskPriority;
    dueDate: Date | null;
    tags?: string[];
  },
  workspaceName: string,
  channel: Channel
): string {
  const categoryName = task.categoryName ?? task.category?.name ?? "General";
  const assigneeUsers = (
    task.assignees?.map((row) => ("user" in row ? row.user : row)) ?? []
  ).filter(
    (u): u is { email: string | null; username: string | null } =>
      u !== null && u !== undefined
  );
  const parts = [`${categoryName}`, `${task.priority}`];
  if (task.tags?.length) parts.push(`tags: ${task.tags.join(", ")}`);
  if (task.dueDate) parts.push(`due ${task.dueDate.toISOString().slice(0, 10)}`);
  if (assigneeUsers.length) {
    parts.push(assigneeUsers.map((u) => `@${displayUser(u)}`).join(", "));
  }

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

export type ActionOutcome = {
  ok: boolean;
  message: string;
  action?: string;
};

function stripDonePrefix(message: string): string {
  return message.replace(/^Done\.\s*/i, "").trim();
}

export function formatActionSummary(
  outcomes: ActionOutcome[],
  budgetExhausted: boolean,
  channel: Channel,
  assistantNote?: string | null
): string {
  const withMessage = outcomes.filter((o) => o.message.trim());
  const successes = withMessage.filter((o) => o.ok);
  const failures = withMessage.filter((o) => !o.ok);

  if (withMessage.length === 0 && !assistantNote?.trim()) {
    return channel === "whatsapp"
      ? 'I can create tasks, save links, list files, tag uploads, or show your board. Try: "add a task to fix the login bug" or send *menu*.'
      : "No actions were taken.";
  }

  let header: string;
  if (failures.length === 0 && !budgetExhausted) {
    header =
      channel === "whatsapp"
        ? "✅ Done. Here's what happened:"
        : "Done. Here's what happened:";
  } else if (successes.length === 0) {
    header =
      channel === "whatsapp"
        ? "⚠️ I couldn't complete that:"
        : "I couldn't complete that:";
  } else {
    header = budgetExhausted
      ? "⚠️ Partially done (ran out of steps):"
      : channel === "whatsapp"
        ? "⚠️ Partially done — some steps couldn't be completed:"
        : "Partially done — some steps couldn't be completed:";
  }

  const lines: string[] = [];
  for (const o of successes) {
    lines.push(`✅ ${stripDonePrefix(o.message)}`);
  }
  for (const o of failures) {
    lines.push(`❌ ${o.message}`);
  }

  let body =
    lines.length > 0 ? `${header}\n\n${lines.join("\n")}` : header;

  if (budgetExhausted) {
    body += "\n\nSend any remaining steps as a new message and I'll continue.";
  } else if (failures.length > 0) {
    body +=
      channel === "whatsapp"
        ? "\n\nFix the ❌ items and try again, or send one step at a time."
        : "\n\nFix the failed items and try again.";
  }

  const note = assistantNote?.trim();
  if (note) {
    body += `\n\n${note}`;
  }

  return body;
}

export type AssetRow = {
  url: string;
  fileType: string;
  tags: string[];
  uploadedBy: { email: string | null; username: string | null } | null;
};

export function formatAssetList(
  workspaceName: string,
  assets: AssetRow[],
  channel: Channel
): string {
  if (assets.length === 0) {
    return channel === "whatsapp"
      ? `📎 No files in *${workspaceName}* yet. Send a photo or document to upload.`
      : `No assets in "${workspaceName}" yet.`;
  }

  const header =
    channel === "whatsapp"
      ? `📎 Files · *${workspaceName}* (${assets.length})`
      : `Assets in "${workspaceName}" (${assets.length}):`;

  const lines = assets.map((a) => {
    const name = assetFileName(a.url);
    if (channel === "whatsapp") {
      let line = `• ${name} (${a.fileType})`;
      if (a.tags.length) line += ` — ${a.tags.join(", ")}`;
      if (a.uploadedBy) line += ` · @${displayUser(a.uploadedBy)}`;
      return line;
    }
    return (
      `- ${name}\n  type: ${a.fileType}` +
      (a.tags.length ? `, tags: ${a.tags.join(", ")}` : "") +
      (a.uploadedBy ? `, by @${displayUser(a.uploadedBy)}` : "")
    );
  });

  return `${header}\n${lines.join("\n")}`;
}

export type LinkRow = {
  title: string;
  url: string;
  description: string | null;
  pinned: boolean;
  createdBy: { email: string | null; username: string | null };
};

export function formatLinkList(
  workspaceName: string,
  links: LinkRow[],
  channel: Channel
): string {
  if (links.length === 0) {
    return channel === "whatsapp"
      ? `🔗 No links in *${workspaceName}* yet.`
      : `No links saved in "${workspaceName}" yet.`;
  }

  const header =
    channel === "whatsapp"
      ? `🔗 Links · *${workspaceName}* (${links.length})`
      : `Links in "${workspaceName}" (${links.length}):`;

  const lines = links.map((link) => {
    if (channel === "whatsapp") {
      let line = `${link.pinned ? "📌 " : ""}*${link.title}*\n${link.url}`;
      if (link.description) line += `\n_${link.description}_`;
      return line;
    }
    return (
      `- ${link.pinned ? "[pinned] " : ""}${link.title}\n  ${link.url}` +
      (link.description ? `\n  note: ${link.description}` : "") +
      `\n  by @${displayUser(link.createdBy)}`
    );
  });

  return `${header}\n\n${lines.join("\n\n")}`;
}
