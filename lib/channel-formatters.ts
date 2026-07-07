import type { TaskPriority, TaskStatus } from "@/lib/generated/prisma/client";
import { taskUrl } from "@/lib/app-url";
import { assetFileName } from "@/lib/services/project";
import { displayUser } from "@/lib/username";
import {
  formatTaskListLine,
  formatTaskRef,
} from "@/lib/whatsapp-task-ref";
import { markdownToPlainText } from "@/lib/markdown/parse";

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

export type Channel = "whatsapp" | "mcp" | "web";

function formatDescriptionForChannel(
  description: string | null | undefined,
  channel: Channel,
  emptyLabel: string
): string {
  const trimmed = description?.trim();
  if (!trimmed) return emptyLabel;
  if (channel === "whatsapp") return markdownToPlainText(trimmed);
  return trimmed;
}

function formatChatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

const STATUS_CHAT: Record<TaskStatus, string> = {
  TODO: "to do",
  IN_PROGRESS: "in progress",
  DONE: "done",
};

function formatTaskLine(task: BoardTask, channel: Channel): string {
  if (channel === "whatsapp") {
    const meta: string[] = [STATUS_CHAT[task.status]];
    if (task.priority === "HIGH") meta.push("high");
    if (task.tags?.length) meta.push(task.tags.slice(0, 3).join(", "));
    if (task.dueDate) meta.push(`due ${formatChatDate(task.dueDate)}`);
    if (task.assignees.length) {
      meta.push(task.assignees.map((u) => `@${displayUser(u)}`).join(", "));
    }
    return formatTaskListLine(task.title, meta);
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
    return `${label}:\n${tasks.map((t) => formatTaskLine(t, channel)).join("\n")}`;
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
      ? `*${workspaceName}* is empty — tell me a task to add.`
      : `Board for "${workspaceName}" is empty.`;
  }

  const header =
    channel === "whatsapp"
      ? `Here's your board · *${workspaceName}* (${totalTasks})`
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
    const meta: string[] = [];
    if (task.priority === "HIGH") meta.push("high");
    if (task.dueDate) meta.push(`due ${formatChatDate(task.dueDate)}`);
    if (assigneeUsers.length) {
      meta.push(assigneeUsers.map((u) => `@${displayUser(u)}`).join(", "));
    }
    return formatTaskListLine(task.title, meta);
  }

  return `#${task.shortId} "${task.title}" (${parts.join(", ")}) in ${workspaceName}`;
}

export type TaskDetail = {
  shortId: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  tags: string[];
  description: string | null;
  category: { name: string };
  assignees: { user: { email: string | null; username: string | null } }[];
  attachments: { url: string; fileType: string }[];
  createdBy?: { email: string | null; username: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskUpdateFeedItem = {
  body: string;
  createdAt: Date;
  author: { email: string | null; username: string | null };
};

export function formatTaskUpdates(
  shortId: number,
  title: string,
  updates: TaskUpdateFeedItem[],
  channel: Channel
): string {
  if (updates.length === 0) {
    return channel === "whatsapp"
      ? `No updates on *${title}* yet.`
      : `No updates on task #${shortId} "${title}" yet.`;
  }

  const lines = updates.map((u) => {
    const who = `@${displayUser(u.author)}`;
    const when = u.createdAt.toISOString().slice(0, 16).replace("T", " ");
    if (channel === "whatsapp") {
      return `• ${when} · ${who}\n  ${u.body}`;
    }
    return `[${when}] ${who}: ${u.body}`;
  });

  const header =
    channel === "whatsapp"
      ? `*Updates · ${formatTaskRef(title)}* (${updates.length})`
      : `Updates on task #${shortId} "${title}" (${updates.length}):`;

  return `${header}\n\n${lines.join("\n\n")}`;
}

/** Full task detail with labeled fields — model can answer partial questions (tags only, etc.). */
export function formatTaskDetail(
  task: TaskDetail,
  workspaceName: string,
  workspaceId: string,
  channel: Channel,
  recentUpdates?: TaskUpdateFeedItem[]
): string {
  const assigneeLine =
    task.assignees.length > 0
      ? task.assignees.map((a) => `@${displayUser(a.user)}`).join(", ")
      : channel === "whatsapp"
        ? "_Unassigned_"
        : "Unassigned";

  const tagsLine =
    task.tags.length > 0
      ? task.tags.join(", ")
      : channel === "whatsapp"
        ? "_None_"
        : "None";

  const dueLine = task.dueDate
    ? task.dueDate.toISOString().slice(0, 10)
    : channel === "whatsapp"
      ? "_None_"
      : "None";

  const description = formatDescriptionForChannel(
    task.description,
    channel,
    channel === "whatsapp" ? "_No description_" : "No description"
  );

  const attachmentLines =
    task.attachments.length > 0
      ? task.attachments.map((a) => {
          const name = assetFileName(a.url);
          return channel === "whatsapp"
            ? `• ${name} (${a.fileType})`
            : `- ${name} (${a.fileType})`;
        })
      : [channel === "whatsapp" ? "_None_" : "None"];

  const createdByLine = task.createdBy
    ? `@${displayUser(task.createdBy)}`
    : channel === "whatsapp"
      ? "_Unknown_"
      : "Unknown";

  const url = taskUrl(workspaceId, task.shortId);

  const updatesBlock = (() => {
    if (!recentUpdates || recentUpdates.length === 0) return "";
    const lines = recentUpdates.map((u) => {
      const who = `@${displayUser(u.author)}`;
      const when = u.createdAt.toISOString().slice(0, 16).replace("T", " ");
      return channel === "whatsapp"
        ? `• ${when} · ${who}: ${u.body}`
        : `[${when}] ${who}: ${u.body}`;
    });
    return channel === "whatsapp"
      ? `\nUpdates (${recentUpdates.length}):\n${lines.join("\n")}\n`
      : `\nUpdates (${recentUpdates.length}):\n${lines.join("\n")}\n`;
  })();

  if (channel === "whatsapp") {
    // No deep link here — the agent composes answers from this, and links in
    // intermediate context leak into replies. Board view keeps its link.
    return (
      `*${formatTaskRef(task.title)}*\n` +
      `Workspace: ${workspaceName}\n` +
      `Status: ${task.status.replace("_", " ")}\n` +
      `Category: ${task.category.name}\n` +
      `Priority: ${task.priority}\n` +
      `Due date: ${dueLine}\n` +
      `Tags: ${tagsLine}\n` +
      `Assignees: ${assigneeLine}\n` +
      `Created by: ${createdByLine}\n` +
      `Created: ${task.createdAt.toISOString().slice(0, 10)}\n` +
      `Updated: ${task.updatedAt.toISOString().slice(0, 10)}\n` +
      `Description:\n${description}\n` +
      updatesBlock +
      `\nAttachments (${task.attachments.length}):\n${attachmentLines.join("\n")}`
    );
  }

  return (
    `Task #${task.shortId} "${task.title}" in workspace "${workspaceName}"\n` +
    `Status: ${task.status}\n` +
    `Category: ${task.category.name}\n` +
    `Priority: ${task.priority}\n` +
    `Due date: ${dueLine}\n` +
    `Tags: ${tagsLine}\n` +
    `Assignees: ${assigneeLine}\n` +
    `Created by: ${createdByLine}\n` +
    `Created: ${task.createdAt.toISOString().slice(0, 10)}\n` +
    `Updated: ${task.updatedAt.toISOString().slice(0, 10)}\n` +
    `Description:\n${description}\n` +
    updatesBlock +
    `\nAttachments (${task.attachments.length}):\n${attachmentLines.join("\n")}\n\n` +
    `Link: ${url}`
  );
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
      ? `No uploads in *${workspaceName}* yet — send a photo or doc.`
      : `No assets in "${workspaceName}" yet.`;
  }

  const header =
    channel === "whatsapp"
      ? `Files in *${workspaceName}* (${assets.length})`
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

export type WorkspaceMemberRow = {
  role: string;
  user: { email: string | null; username: string | null };
};

export function formatWorkspaceMemberList(
  workspaceName: string,
  members: WorkspaceMemberRow[],
  channel: Channel
): string {
  if (members.length === 0) {
    return channel === "whatsapp"
      ? `No members in *${workspaceName}*.`
      : `No members in "${workspaceName}".`;
  }

  const header =
    channel === "whatsapp"
      ? `👥 *${workspaceName}* · ${members.length} member${members.length === 1 ? "" : "s"}`
      : `Members of "${workspaceName}" (${members.length}):`;

  const lines = members.map((m) => {
    const label = `@${displayUser(m.user)}`;
    if (channel === "whatsapp") {
      return `• ${label} (${m.role.replace("_", " ")})`;
    }
    return `- ${label} [${m.role}]`;
  });

  return `${header}\n${lines.join("\n")}`;
}

export function formatTaskSearchResults(
  workspaceName: string,
  tasks: BoardTask[],
  channel: Channel,
  label = "Tasks"
): string {
  if (tasks.length === 0) {
    return channel === "whatsapp"
      ? "Nothing matched that — try the task name or say *what's on the board*."
      : `No matching tasks in "${workspaceName}".`;
  }

  const header =
    channel === "whatsapp"
      ? `*${label} · ${workspaceName}* (${tasks.length})`
      : `${label} in "${workspaceName}" (${tasks.length}):`;

  const lines = tasks.map((t) => formatTaskLine(t, channel));
  return `${header}\n${lines.join("\n")}`;
}

export function formatTaskRetrievalResults(
  workspaceName: string,
  hits: {
    shortId: number;
    title: string;
    score: number;
    semanticScore: number | null;
    status: string;
  }[],
  channel: Channel
): string {
  if (hits.length === 0) {
    return channel === "whatsapp"
      ? `I couldn't find a task matching that in *${workspaceName}*. Try the task name or send *what's on the board*.`
      : `No task matched that query in "${workspaceName}".`;
  }

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  if (channel === "whatsapp") {
    const lines = hits.map((h) => {
      const match = pct(h.score);
      const status = h.status.replace("_", " ");
      return `${formatTaskRef(h.title, h.shortId, { id: hits.length > 1 ? "suffix" : "never" })} (${status}) — ${match} match`;
    });
    const header =
      hits.length === 1
        ? `Best match in *${workspaceName}*:`
        : `${hits.length} possible matches in *${workspaceName}*:`;
    const hint =
      hits.length > 1
        ? "\n\nWhich one did you mean? Say the task name."
        : `\n\nAsk me about *${hits[0].title}* for details or updates.`;
    return `${header}\n${lines.join("\n")}${hint}`;
  }

  const lines = hits.map(
    (h) =>
      `#${h.shortId} "${h.title}" (${Math.round(h.score * 100)}% match, ${h.status})`
  );
  return `Task matches in "${workspaceName}":\n${lines.join("\n")}`;
}

export type TaskContextSnapshot = {
  task: {
    shortId: number;
    title: string;
    status: string;
    priority: string;
    category: string;
    assignees: string[];
    description: string | null;
    tags: string[];
    totalUpdates: number;
  };
  matchScore: number | null;
  relevantUpdates: {
    body: string;
    author: string;
    createdAt: Date;
    relevance: number;
  }[];
  query: string;
};

/** Task metadata + full update thread for the model. */
export function formatTaskContextPack(
  workspaceName: string,
  pack: TaskContextSnapshot,
  channel: Channel
): string {
  const t = pack.task;
  const status = t.status.replace("_", " ");
  const assignees =
    t.assignees.length > 0
      ? t.assignees.map((a) => `@${a}`).join(", ")
      : channel === "whatsapp"
        ? "_Unassigned_"
        : "Unassigned";

  const matchLine =
    pack.matchScore !== null
      ? channel === "whatsapp"
        ? `Match: ${Math.round(pack.matchScore * 100)}%\n`
        : `Match confidence: ${Math.round(pack.matchScore * 100)}%\n`
      : "";

  const desc = formatDescriptionForChannel(
    t.description,
    channel,
    channel === "whatsapp" ? "_No description_" : "No description"
  );

  let updatesBlock: string;
  if (pack.relevantUpdates.length === 0) {
    updatesBlock =
      channel === "whatsapp"
        ? "_No updates on this task yet._"
        : "No updates on this task yet.";
  } else {
    const lines = pack.relevantUpdates.map((u) => {
      const when = u.createdAt.toISOString().slice(0, 16).replace("T", " ");
      if (channel === "whatsapp") {
        return `• ${when} · @${u.author}\n  ${u.body}`;
      }
      return `[${when}] @${u.author}: ${u.body}`;
    });
    const header =
      channel === "whatsapp"
        ? `Updates (${pack.relevantUpdates.length}):`
        : `Updates (${pack.relevantUpdates.length}):`;
    updatesBlock = `${header}\n${lines.join("\n\n")}`;
  }

  if (channel === "whatsapp") {
    return (
      `*${formatTaskRef(t.title)}* · ${workspaceName}\n` +
      matchLine +
      `Status: ${status} · ${t.category} · ${t.priority}\n` +
      `Assignees: ${assignees}\n` +
      `Description: ${desc}\n\n` +
      updatesBlock
    );
  }

  return (
    `Task #${t.shortId} "${t.title}" in "${workspaceName}"\n` +
    matchLine +
    `Status: ${status}, Category: ${t.category}, Priority: ${t.priority}\n` +
    `Assignees: ${assignees}\n` +
    `Description: ${desc}\n\n` +
    updatesBlock
  );
}

export function formatTaskContextFailure(
  reason: "not_found" | "ambiguous",
  message: string,
  alternatives: { shortId: number; title: string; score: number }[],
  channel: Channel
): string {
  if (reason === "ambiguous" && alternatives.length > 0) {
    const lines = alternatives.map((a) => {
      const pct = Math.round(a.score * 100);
      return channel === "whatsapp"
        ? `${formatTaskRef(a.title, a.shortId, { id: "suffix" })} (${pct}%)`
        : `#${a.shortId} "${a.title}" (${pct}%)`;
    });
    return channel === "whatsapp"
      ? `${message}\n${lines.join("\n")}`
      : `${message}\n${lines.join("\n")}`;
  }
  return message;
}

export function formatAssetDetail(
  asset: {
    url: string;
    fileType: string;
    tags: string[];
    createdAt: Date;
    uploadedBy: { email: string | null; username: string | null } | null;
    task: { shortId: number; title: string } | null;
  },
  workspaceName: string,
  channel: Channel
): string {
  const name = assetFileName(asset.url);
  const tagsLine =
    asset.tags.length > 0
      ? asset.tags.join(", ")
      : channel === "whatsapp"
        ? "_None_"
        : "None";
  const uploader = asset.uploadedBy
    ? `@${displayUser(asset.uploadedBy)}`
    : channel === "whatsapp"
      ? "_Unknown_"
      : "Unknown";
  const taskLine = asset.task
    ? formatTaskRef(asset.task.title)
    : channel === "whatsapp"
      ? "_Not attached to a task_"
      : "Not attached to a task";

  if (channel === "whatsapp") {
    return (
      `*File · ${name}*\n` +
      `Workspace: ${workspaceName}\n` +
      `Type: ${asset.fileType}\n` +
      `Tags: ${tagsLine}\n` +
      `Uploaded by: ${uploader}\n` +
      `Uploaded: ${asset.createdAt.toISOString().slice(0, 10)}\n` +
      `Attached to: ${taskLine}\n` +
      `URL: ${asset.url}`
    );
  }

  return (
    `Asset "${name}" in workspace "${workspaceName}"\n` +
    `Type: ${asset.fileType}\n` +
    `Tags: ${tagsLine}\n` +
    `Uploaded by: ${uploader}\n` +
    `Uploaded: ${asset.createdAt.toISOString().slice(0, 10)}\n` +
    `Attached to: ${taskLine}\n` +
    `URL: ${asset.url}`
  );
}

export function formatWorkspaceList(
  workspaces: {
    id: string;
    name: string;
    role: string;
    isActive: boolean;
  }[],
  channel: Channel
): string {
  if (workspaces.length === 0) {
    return channel === "whatsapp"
      ? "You don't belong to any workspace yet."
      : "You don't belong to any workspace yet.";
  }

  const header =
    channel === "whatsapp"
      ? `*Your workspaces* (${workspaces.length})`
      : `Your workspaces (${workspaces.length}):`;

  const lines = workspaces.map((w) => {
    const active = w.isActive
      ? channel === "whatsapp"
        ? " · _active_"
        : " [active]"
      : "";
    const role = w.role.replace("_", " ");
    if (channel === "whatsapp") {
      return `• *${w.name}* (${role})${active}`;
    }
    return `- ${w.name} (${role})${active}`;
  });

  return `${header}\n${lines.join("\n")}`;
}

export function formatWorkspaceSummary(
  summary: {
    workspace: { name: string };
    role: string;
    memberCount: number;
    openTasks: number;
    assignedToYou: number;
    tasksByStatus: Record<"TODO" | "IN_PROGRESS" | "DONE", number>;
  },
  channel: Channel
): string {
  const { workspace, role, memberCount, openTasks, assignedToYou, tasksByStatus } =
    summary;

  if (channel === "whatsapp") {
    return (
      `*${workspace.name}* summary\n` +
      `Your role: ${role.replace("_", " ")}\n` +
      `Members: ${memberCount}\n` +
      `Open tasks: ${openTasks}\n` +
      `Assigned to you: ${assignedToYou}\n` +
      `To Do: ${tasksByStatus.TODO} · In progress: ${tasksByStatus.IN_PROGRESS} · Done: ${tasksByStatus.DONE}`
    );
  }

  return (
    `Workspace "${workspace.name}" summary\n` +
    `Your role: ${role}\n` +
    `Members: ${memberCount}\n` +
    `Open tasks: ${openTasks}\n` +
    `Assigned to you: ${assignedToYou}\n` +
    `Tasks by status: TODO ${tasksByStatus.TODO}, IN_PROGRESS ${tasksByStatus.IN_PROGRESS}, DONE ${tasksByStatus.DONE}`
  );
}

export function formatCategoryList(
  workspaceName: string,
  categories: { name: string }[],
  channel: Channel
): string {
  if (categories.length === 0) {
    return channel === "whatsapp"
      ? `No categories in *${workspaceName}*.`
      : `No categories in "${workspaceName}".`;
  }

  const header =
    channel === "whatsapp"
      ? `*Categories · ${workspaceName}* (${categories.length})`
      : `Categories in "${workspaceName}" (${categories.length}):`;

  const lines = categories.map((c) =>
    channel === "whatsapp" ? `• ${c.name}` : `- ${c.name}`
  );
  return `${header}\n${lines.join("\n")}`;
}

export function formatBulkTaskUpdateResult(
  workspaceName: string,
  tasks: BoardTask[],
  channel: Channel
): string {
  if (tasks.length === 0) {
    return channel === "whatsapp"
      ? `No tasks updated in *${workspaceName}*.`
      : `No tasks updated in "${workspaceName}".`;
  }

  const header =
    channel === "whatsapp"
      ? `*Updated ${tasks.length} task${tasks.length === 1 ? "" : "s"} · ${workspaceName}*`
      : `Updated ${tasks.length} task(s) in "${workspaceName}":`;

  const lines = tasks.map((t) => formatTaskLine(t, channel));
  return `${header}\n${lines.join("\n")}`;
}
