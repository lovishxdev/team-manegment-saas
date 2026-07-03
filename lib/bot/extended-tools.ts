import {
  TaskPriority,
  TaskStatus,
} from "@/lib/generated/prisma/client";
import {
  assetFileName,
  bulkUpdateTasks,
  deleteAsset,
  getAsset,
  listMyTasks,
  MAX_BULK_TASK_UPDATES,
  searchTasks,
  ServiceError,
  unassignTask,
} from "@/lib/services/project";
import {
  createWorkspaceCategory,
  listWorkspaceCategories,
} from "@/lib/services/categories";
import {
  deleteWorkspaceLink,
  resolveWorkspaceLink,
  setWorkspaceLinkPin,
  updateWorkspaceLink,
} from "@/lib/services/links";
import {
  renderWhiteboardScreenshots,
  uploadWhiteboardImages,
  type ExcalidrawPersistedState,
} from "@/lib/excalidraw-screenshots";
import { getExcalidrawState } from "@/lib/services/workspace";
import {
  getWorkspaceSummary,
  leaveWorkspace,
  listUserWorkspaceChoices,
  removeMember,
  resolveWorkspaceMember,
  switchWorkspace,
} from "@/lib/services/workspace";
import { buildTaskContextPack } from "@/lib/retrieval/task-context";
import { retrieveTasksByQuery } from "@/lib/retrieval/task-retriever";
import {
  createTaskUpdate,
  listTaskUpdates,
} from "@/lib/services/task-updates";
import {
  formatAssetDetail,
  formatBulkTaskUpdateResult,
  formatCategoryList,
  formatTaskUpdates,
  formatTaskContextFailure,
  formatTaskContextPack,
  formatTaskRetrievalResults,
  formatTaskSearchResults,
  formatWorkspaceList,
  formatWorkspaceSummary,
  toBoardTask,
  type Channel,
} from "@/lib/channel-formatters";
import { displayUser } from "@/lib/username";

export type BotWorkspaceCtx = {
  workspaceId: string;
  workspaceName: string;
};

function parseStatus(
  value: unknown
): TaskStatus | TaskStatus[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) {
    return value.map((s) => String(s).toUpperCase() as TaskStatus);
  }
  const s = String(value).toUpperCase();
  if (s === "OPEN") return ["TODO", "IN_PROGRESS"] as TaskStatus[];
  if (s === "TODO" || s === "IN_PROGRESS" || s === "DONE") return s;
  return undefined;
}

export async function runListMyTasks(
  ctx: BotWorkspaceCtx,
  userId: string,
  input: Record<string, unknown>,
  channel: Channel
): Promise<string> {
  const tasks = await listMyTasks(ctx.workspaceId, userId, {
    status: parseStatus(input.status),
    limit: input.limit ? Number(input.limit) : undefined,
  });
  const label =
    channel === "whatsapp" ? "Your open tasks" : "Your open tasks";
  return formatTaskSearchResults(
    ctx.workspaceName,
    tasks.map(toBoardTask),
    channel,
    label
  );
}

export async function runSearchTasks(
  ctx: BotWorkspaceCtx,
  userId: string,
  input: Record<string, unknown>,
  channel: Channel
): Promise<string> {
  const tasks = await searchTasks({
    workspaceId: ctx.workspaceId,
    userId,
    query: input.query ? String(input.query) : undefined,
    status: parseStatus(input.status),
    category: input.category ? String(input.category) : undefined,
    tag: input.tag ? String(input.tag) : undefined,
    assignee: input.assignee ? String(input.assignee) : undefined,
    priority: input.priority
      ? (String(input.priority).toUpperCase() as TaskPriority)
      : undefined,
    dueBefore: input.dueBefore ? String(input.dueBefore) : undefined,
    dueAfter: input.dueAfter ? String(input.dueAfter) : undefined,
    limit: input.limit ? Number(input.limit) : undefined,
  });
  return formatTaskSearchResults(
    ctx.workspaceName,
    tasks.map(toBoardTask),
    channel,
    "Matching tasks"
  );
}

/** Semantic + keyword task lookup for natural-language references. */
export async function runFindTask(
  ctx: BotWorkspaceCtx,
  userId: string,
  query: string,
  channel: Channel,
  limit?: number
): Promise<string> {
  const hits = await retrieveTasksByQuery({
    workspaceId: ctx.workspaceId,
    userId,
    query,
    limit: limit ?? 3,
  });
  return formatTaskRetrievalResults(ctx.workspaceName, hits, channel);
}

/** Resolve task + full update thread in one step. */
export async function runAskTask(
  ctx: BotWorkspaceCtx,
  userId: string,
  input: { query: string; shortId?: number },
  channel: Channel
): Promise<string> {
  const result = await buildTaskContextPack({
    workspaceId: ctx.workspaceId,
    userId,
    query: input.query,
    shortId: input.shortId,
  });

  if (!result.ok) {
    return formatTaskContextFailure(
      result.reason,
      result.message,
      (result.alternatives ?? []).map((a) => ({
        shortId: a.shortId,
        title: a.title,
        score: a.score,
      })),
      channel
    );
  }

  return formatTaskContextPack(ctx.workspaceName, result.pack, channel);
}

export async function runListWorkspaces(
  userId: string,
  channel: Channel
): Promise<string> {
  const workspaces = await listUserWorkspaceChoices(userId);
  return formatWorkspaceList(workspaces, channel);
}

export async function runSwitchWorkspace(
  userId: string,
  input: Record<string, unknown>,
  channel: Channel
): Promise<string> {
  const name = String(input.workspace ?? input.name ?? "").trim();
  if (!name) {
    return "Which workspace should I switch to?";
  }
  const ctx = await switchWorkspace(userId, name);
  return channel === "whatsapp"
    ? `Switched to *${ctx.workspaceName}*. Future actions use this workspace unless you name another.`
    : `Switched to workspace "${ctx.workspaceName}". Future actions use this workspace unless you name another.`;
}

export async function runWorkspaceSummary(
  ctx: BotWorkspaceCtx,
  userId: string,
  channel: Channel
): Promise<string> {
  const summary = await getWorkspaceSummary(ctx.workspaceId, userId);
  return formatWorkspaceSummary(summary, channel);
}

export async function runReadAsset(
  ctx: BotWorkspaceCtx,
  userId: string,
  input: Record<string, unknown>,
  channel: Channel
): Promise<string> {
  const asset = await getAsset({
    workspaceId: ctx.workspaceId,
    userId,
    assetId: input.assetId ? String(input.assetId) : undefined,
    fileName: input.fileName ? String(input.fileName) : undefined,
    latest: input.latest === true,
  });
  return formatAssetDetail(asset, ctx.workspaceName, channel);
}

export type RemoveMemberStage = {
  workspaceId: string;
  workspaceName: string;
  targetUserId: string;
  targetLabel: string;
};

export async function prepareRemoveMember(
  ctx: BotWorkspaceCtx,
  userId: string,
  memberRef: string
): Promise<RemoveMemberStage> {
  const target = await resolveWorkspaceMember(ctx.workspaceId, memberRef);
  if (target.userId === userId) {
    throw new ServiceError("You cannot remove yourself", "INVALID_INPUT");
  }
  return {
    workspaceId: ctx.workspaceId,
    workspaceName: ctx.workspaceName,
    targetUserId: target.userId,
    targetLabel: displayUser(target.user),
  };
}

export async function runRemoveMemberConfirmed(
  pending: RemoveMemberStage,
  actorId: string,
  channel: Channel
): Promise<string> {
  await removeMember(pending.workspaceId, actorId, pending.targetUserId);
  return channel === "whatsapp"
    ? `Removed *@${pending.targetLabel}* from ${pending.workspaceName}.`
    : `Removed @${pending.targetLabel} from workspace "${pending.workspaceName}".`;
}

export type DeleteAssetStage = {
  workspaceId: string;
  workspaceName: string;
  assetId: string;
  fileName: string;
};

export async function prepareDeleteAsset(
  ctx: BotWorkspaceCtx,
  userId: string,
  input: Record<string, unknown>
): Promise<DeleteAssetStage> {
  const asset = await getAsset({
    workspaceId: ctx.workspaceId,
    userId,
    assetId: input.assetId ? String(input.assetId) : undefined,
    fileName: input.fileName ? String(input.fileName) : undefined,
    latest: input.latest === true || !input.fileName,
  });
  return {
    workspaceId: ctx.workspaceId,
    workspaceName: ctx.workspaceName,
    assetId: asset.id,
    fileName: assetFileName(asset.url),
  };
}

export async function runDeleteAssetConfirmed(
  pending: DeleteAssetStage,
  userId: string,
  channel: Channel
): Promise<string> {
  await deleteAsset({
    workspaceId: pending.workspaceId,
    assetId: pending.assetId,
    userId,
  });
  return channel === "whatsapp"
    ? `Deleted file *${pending.fileName}* from ${pending.workspaceName}.`
    : `Deleted file "${pending.fileName}" from workspace "${pending.workspaceName}".`;
}

export async function runDeleteLink(
  ctx: BotWorkspaceCtx,
  userId: string,
  input: Record<string, unknown>,
  channel: Channel
): Promise<string> {
  const identifier = String(input.link ?? input.title ?? input.url ?? "").trim();
  if (!identifier) return "Which link should I delete?";
  const link = await resolveWorkspaceLink(
    ctx.workspaceId,
    userId,
    identifier
  );
  await deleteWorkspaceLink({
    workspaceId: ctx.workspaceId,
    linkId: link.id,
    userId,
  });
  return channel === "whatsapp"
    ? `Deleted link *${link.title}* from ${ctx.workspaceName}.`
    : `Deleted link "${link.title}" from workspace "${ctx.workspaceName}".`;
}

export async function runUpdateLink(
  ctx: BotWorkspaceCtx,
  userId: string,
  input: Record<string, unknown>,
  channel: Channel
): Promise<string> {
  const identifier = String(input.link ?? input.title ?? "").trim();
  if (!identifier) return "Which link should I update?";
  const link = await resolveWorkspaceLink(
    ctx.workspaceId,
    userId,
    identifier
  );
  const updated = await updateWorkspaceLink({
    workspaceId: ctx.workspaceId,
    userId,
    linkId: link.id,
    title: input.newTitle ? String(input.newTitle) : undefined,
    url: input.url ? String(input.url) : undefined,
    description:
      input.description !== undefined
        ? String(input.description)
        : undefined,
    pinned:
      input.pinned === true
        ? true
        : input.pinned === false
          ? false
          : undefined,
  });
  return channel === "whatsapp"
    ? `Updated link *${updated.title}* in ${ctx.workspaceName}:\n${updated.url}`
    : `Updated link "${updated.title}" in workspace "${ctx.workspaceName}": ${updated.url}`;
}

export async function runPinLink(
  ctx: BotWorkspaceCtx,
  userId: string,
  input: Record<string, unknown>,
  channel: Channel
): Promise<string> {
  const identifier = String(input.link ?? input.title ?? "").trim();
  if (!identifier) return "Which link should I pin or unpin?";
  const link = await resolveWorkspaceLink(
    ctx.workspaceId,
    userId,
    identifier
  );
  const pinned =
    input.pinned === false || input.unpin === true ? false : true;
  const updated = await setWorkspaceLinkPin({
    workspaceId: ctx.workspaceId,
    linkId: link.id,
    userId,
    pinned,
  });
  return channel === "whatsapp"
    ? `${updated.pinned ? "Pinned" : "Unpinned"} *${updated.title}* in ${ctx.workspaceName}.`
    : `${updated.pinned ? "Pinned" : "Unpinned"} link "${updated.title}" in workspace "${ctx.workspaceName}".`;
}

export async function runListCategories(
  ctx: BotWorkspaceCtx,
  channel: Channel
): Promise<string> {
  const categories = await listWorkspaceCategories(ctx.workspaceId);
  return formatCategoryList(ctx.workspaceName, categories, channel);
}

export async function runCreateCategory(
  ctx: BotWorkspaceCtx,
  input: Record<string, unknown>,
  channel: Channel
): Promise<string> {
  const name = String(input.name ?? "").trim();
  if (!name) return "What should the new category be called?";
  const category = await createWorkspaceCategory(ctx.workspaceId, name);
  return channel === "whatsapp"
    ? `Created category *${category.name}* in ${ctx.workspaceName}.`
    : `Created category "${category.name}" in workspace "${ctx.workspaceName}".`;
}

export async function runLeaveWorkspace(
  ctx: BotWorkspaceCtx,
  userId: string,
  channel: Channel
): Promise<string> {
  await leaveWorkspace(ctx.workspaceId, userId);
  return channel === "whatsapp"
    ? `You left *${ctx.workspaceName}*.`
    : `You left workspace "${ctx.workspaceName}".`;
}

export async function runBulkUpdateTasks(
  ctx: BotWorkspaceCtx,
  userId: string,
  input: Record<string, unknown>,
  channel: Channel
): Promise<string> {
  const shortIds = Array.isArray(input.shortIds)
    ? input.shortIds.map((id) => Number(id)).filter((n) => Number.isInteger(n))
    : undefined;

  const tasks = await bulkUpdateTasks({
    workspaceId: ctx.workspaceId,
    userId,
    shortIds: shortIds?.length ? shortIds : undefined,
    shortIdFrom:
      input.shortIdFrom !== undefined ? Number(input.shortIdFrom) : undefined,
    shortIdTo:
      input.shortIdTo !== undefined ? Number(input.shortIdTo) : undefined,
    category: input.category ? String(input.category) : undefined,
    tag: input.tag ? String(input.tag) : undefined,
    assignee: input.assignee ? String(input.assignee) : undefined,
    assignedToMe: input.assignedToMe === true,
    statusFilter: parseStatus(input.statusFilter ?? input.filterStatus),
    status: input.status
      ? (String(input.status).toUpperCase() as TaskStatus)
      : undefined,
    newCategory: input.newCategory
      ? String(input.newCategory)
      : undefined,
    priority: input.priority
      ? (String(input.priority).toUpperCase() as TaskPriority)
      : undefined,
    clearAssignees: input.clearAssignees === true,
  });

  return formatBulkTaskUpdateResult(
    ctx.workspaceName,
    tasks.map(toBoardTask),
    channel
  );
}

export async function runUnassignTask(
  ctx: BotWorkspaceCtx,
  userId: string,
  shortId: number,
  channel: Channel
): Promise<string> {
  const task = await unassignTask(ctx.workspaceId, userId, shortId);
  return channel === "whatsapp"
    ? `Unassigned everyone from #${task.shortId} *${task.title}* in ${ctx.workspaceName}.`
    : `Unassigned all members from task #${task.shortId} "${task.title}" in workspace "${ctx.workspaceName}".`;
}

export { MAX_BULK_TASK_UPDATES };

export async function runAddTaskUpdate(
  ctx: BotWorkspaceCtx,
  userId: string,
  shortId: number,
  body: string,
  channel: Channel
): Promise<string> {
  const created = await createTaskUpdate({
    workspaceId: ctx.workspaceId,
    userId,
    shortId,
    body,
  });
  const who = displayUser(created.author);
  if (channel === "whatsapp") {
    return `Posted update on #${created.taskShortId} *${created.taskTitle}* in ${ctx.workspaceName} as @${who}.`;
  }
  return `Posted update on task #${created.taskShortId} "${created.taskTitle}" in workspace "${ctx.workspaceName}".`;
}

export async function runListTaskUpdates(
  ctx: BotWorkspaceCtx,
  userId: string,
  shortId: number,
  channel: Channel,
  limit?: number
): Promise<string> {
  const { task, updates } = await listTaskUpdates(
    ctx.workspaceId,
    userId,
    shortId,
    { limit }
  );
  return formatTaskUpdates(task.shortId, task.title, updates, channel);
}

export async function runExportWhiteboard(
  ctx: BotWorkspaceCtx,
  userId: string,
  channel: Channel
): Promise<{ text: string; images?: Buffer[] }> {
  const workspace = await getExcalidrawState(ctx.workspaceId, userId);
  const raw = workspace.excalidrawState;
  const state: ExcalidrawPersistedState =
    raw && typeof raw === "object"
      ? (raw as ExcalidrawPersistedState)
      : {};

  const { images, empty } = await renderWhiteboardScreenshots(state);

  if (empty || images.length === 0) {
    return {
      text:
        channel === "whatsapp"
          ? `The whiteboard in *${ctx.workspaceName}* is empty.`
          : `The whiteboard in "${ctx.workspaceName}" is empty.`,
    };
  }

  if (channel === "mcp") {
    const urls = await uploadWhiteboardImages(ctx.workspaceId, images);
    const lines = urls.map((url, i) => `${i + 1}. ${url}`);
    return {
      text:
        `Whiteboard for "${ctx.workspaceName}" (${images.length} screenshot${images.length === 1 ? "" : "s"}):\n` +
        lines.join("\n"),
    };
  }

  return {
    text: `Sending ${images.length} whiteboard screenshot${images.length === 1 ? "" : "s"} from *${ctx.workspaceName}*.`,
    images,
  };
}
