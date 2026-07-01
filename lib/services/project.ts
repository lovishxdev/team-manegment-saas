import { cache } from "react";
import {
  Prisma,
  TaskPriority,
  TaskScope,
  TaskStatus,
} from "@/lib/generated/prisma/client";
import { formatTaskTitle, normalizeTaskTitleAndDescription } from "@/lib/format-task-title";
import { prisma } from "@/lib/prisma";
import { ASSETS_BUCKET, getSupabaseAdmin } from "@/lib/supabase";
import { displayUser } from "@/lib/username";
import { notifyTaskAssigned } from "@/lib/whatsapp-notify";

/**
 * Core business logic shared by all three interfaces (Web, WhatsApp, MCP).
 * Every interface is a thin adapter over these functions.
 */

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "NO_WORKSPACE"
      | "AMBIGUOUS_WORKSPACE"
      | "UPLOAD_FAILED"
      | "INVALID_INPUT"
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * The acting user's membership, memoized per request with React.cache.
 * Pages often hit several service functions that each re-check membership
 * (e.g. getBoardView + fetchWorkspaceMemberLabelsAction); within one render
 * pass that now costs a single membership query.
 */
export const getActorMembership = cache(
  async (userId: string, workspaceId: string) =>
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    })
);

/** Asserts the user belongs to the workspace; returns their membership. */
async function assertMembership(userId: string, workspaceId: string) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }
  return membership;
}

/** Records the workspace a user last acted in (powers context resolution). */
export async function touchLastActiveWorkspace(userId: string, workspaceId: string) {
  // updateMany so the no-op case (already the active workspace, by far the
  // most common) skips the row write entirely.
  await prisma.user.updateMany({
    where: { id: userId, NOT: { lastActiveWorkspaceId: workspaceId } },
    data: { lastActiveWorkspaceId: workspaceId },
  });
}

/**
 * Determines which workspace the user is targeting when they don't name one
 * explicitly. Resolution order:
 *   1. `hint` - matched against workspace ID, then (case-insensitive) name
 *      among the user's memberships.
 *   2. The user's lastActiveWorkspaceId (most recently used).
 *   3. If the user belongs to exactly one workspace, that one.
 *   4. Most recently joined membership.
 */
export async function resolveUserWorkspaceContext(
  userId: string,
  hint?: string
): Promise<{ workspaceId: string; workspaceName: string }> {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
  });

  if (memberships.length === 0) {
    throw new ServiceError(
      "You don't belong to any workspace yet",
      "NO_WORKSPACE"
    );
  }

  const pick = (id: string, name: string) => ({
    workspaceId: id,
    workspaceName: name,
  });

  if (hint) {
    const byId = memberships.find((m) => m.workspaceId === hint);
    if (byId) return pick(byId.workspace.id, byId.workspace.name);

    const needle = hint.trim().toLowerCase();
    const byName = memberships.filter((m) =>
      m.workspace.name.toLowerCase().includes(needle)
    );
    if (byName.length === 1) {
      return pick(byName[0].workspace.id, byName[0].workspace.name);
    }
    if (byName.length > 1) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastActiveWorkspaceId: true },
      });
      if (user?.lastActiveWorkspaceId) {
        const active = byName.find(
          (m) => m.workspaceId === user.lastActiveWorkspaceId
        );
        if (active) {
          return pick(active.workspace.id, active.workspace.name);
        }
      }
      // Prefer the most recently joined match when duplicates exist.
      return pick(byName[0].workspace.id, byName[0].workspace.name);
    }
    throw new ServiceError(
      `No workspace matching "${hint}" found among your memberships`,
      "NOT_FOUND"
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActiveWorkspaceId: true },
  });
  if (user?.lastActiveWorkspaceId) {
    const lastActive = memberships.find(
      (m) => m.workspaceId === user.lastActiveWorkspaceId
    );
    if (lastActive) {
      return pick(lastActive.workspace.id, lastActive.workspace.name);
    }
  }

  // Single membership, or fall back to most recently joined.
  return pick(memberships[0].workspace.id, memberships[0].workspace.name);
}

/**
 * Resolves an assignee within a workspace by user id or (partial) email.
 * Returns the user id, or throws if no unambiguous member matches.
 */
async function resolveAssignee(
  workspaceId: string,
  idOrEmail: string
): Promise<string> {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, email: true, username: true } } },
  });

  const byId = memberships.find((m) => m.user.id === idOrEmail);
  if (byId) return byId.user.id;

  const needle = idOrEmail.trim().toLowerCase();

  // Exact username match wins outright.
  const byUsername = memberships.find((m) => m.user.username === needle);
  if (byUsername) return byUsername.user.id;

  const matches = memberships.filter(
    (m) =>
      m.user.email?.toLowerCase().includes(needle) ||
      m.user.username?.includes(needle)
  );
  if (matches.length === 1) return matches[0].user.id;
  if (matches.length > 1) {
    throw new ServiceError(
      `Multiple members match "${idOrEmail}": ${matches
        .map((m) => displayUser(m.user))
        .join(", ")}. Be more specific.`,
      "AMBIGUOUS_WORKSPACE"
    );
  }
  throw new ServiceError(
    `No workspace member matches "${idOrEmail}"`,
    "NOT_FOUND"
  );
}

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;

/**
 * Normalizes free-form tags: trims, drops empties, dedupes
 * case-insensitively (first spelling wins), caps count and length.
 */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

export interface CreateTaskInput {
  workspaceId: string;
  title: string;
  description?: string;
  scope?: TaskScope;
  priority?: TaskPriority;
  dueDate?: Date | null;
  assignedToId?: string;
  tags?: string[];
  /** The acting user (becomes createdBy and gets membership-checked). */
  userId: string;
}

export async function createTask(input: CreateTaskInput) {
  const {
    workspaceId,
    title,
    description,
    scope,
    priority,
    dueDate,
    assignedToId,
    tags,
    userId,
  } = input;
  await assertMembership(userId, workspaceId);

  const normalized = normalizeTaskTitleAndDescription(title, description);

  // shortId is allocated per workspace inside a transaction. The
  // @@unique([workspaceId, shortId]) constraint catches concurrent races,
  // which we retry a few times.
  const MAX_RETRIES = 3;
  for (let attempt = 0; ; attempt++) {
    try {
      const task = await prisma.$transaction(async (tx) => {
        const last = await tx.task.findFirst({
          where: { workspaceId },
          orderBy: { shortId: "desc" },
          select: { shortId: true },
        });
        return tx.task.create({
          data: {
            workspaceId,
            shortId: (last?.shortId ?? 0) + 1,
            title: formatTaskTitle(normalized.title),
            description: normalized.description,
            scope: scope ?? TaskScope.GENERAL,
            priority: priority ?? TaskPriority.MEDIUM,
            dueDate: dueDate ?? null,
            tags: tags ? normalizeTags(tags) : [],
            assignedToId: assignedToId ?? null,
            createdById: userId,
          },
          include: { assignedTo: { select: { id: true, email: true, username: true } } },
        });
      });
      await touchLastActiveWorkspace(userId, workspaceId);

      if (assignedToId && assignedToId !== userId) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        });
        if (workspace) {
          void notifyTaskAssigned({
            assigneeUserId: assignedToId,
            actorUserId: userId,
            workspaceId,
            workspaceName: workspace.name,
            taskShortId: task.shortId,
            taskTitle: task.title,
          }).catch((err) => console.error("WhatsApp assign notify failed:", err));
        }
      }

      return task;
    } catch (err) {
      const isUniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002";
      if (!isUniqueViolation || attempt >= MAX_RETRIES) throw err;
    }
  }
}

export interface UpdateTaskInput {
  workspaceId: string;
  userId: string;
  /** Identify the task either by its UUID or by its per-workspace shortId. */
  taskId?: string;
  shortId?: number;
  // Fields to change; undefined = leave untouched, null = clear (where nullable)
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  scope?: TaskScope;
  priority?: TaskPriority;
  dueDate?: Date | null;
  /** Full replacement list of free-form tags. */
  tags?: string[];
  /** Member user id or email; null clears the assignment. */
  assignee?: string | null;
}

/**
 * Looks up a task by UUID or per-workspace shortId, throwing a ServiceError
 * when neither identifier is provided or no task matches.
 */
async function findTaskInWorkspace(
  workspaceId: string,
  taskId?: string,
  shortId?: number
) {
  if (!taskId && shortId === undefined) {
    throw new ServiceError("Provide either taskId or shortId", "INVALID_INPUT");
  }

  const existing = await prisma.task.findFirst({
    where: taskId
      ? { id: taskId, workspaceId }
      : { workspaceId, shortId: shortId! },
  });
  if (!existing) {
    throw new ServiceError(
      `Task ${taskId ?? `#${shortId}`} not found in this workspace`,
      "NOT_FOUND"
    );
  }
  return existing;
}

/**
 * Resolves #N for update/delete in a compound request.
 * If #N already exists on the board, use it literally.
 * Otherwise treat N as a 1-based index into tasks created in this batch.
 */
export async function resolveBatchAwareTaskShortId(
  workspaceId: string,
  inputShortId: number,
  createdInBatch: number[]
): Promise<number> {
  const onBoard = await prisma.task.findFirst({
    where: { workspaceId, shortId: inputShortId },
    select: { shortId: true },
  });
  if (onBoard) return inputShortId;

  if (
    Number.isInteger(inputShortId) &&
    inputShortId >= 1 &&
    inputShortId <= createdInBatch.length
  ) {
    return createdInBatch[inputShortId - 1];
  }
  return inputShortId;
}

export async function updateTask(input: UpdateTaskInput) {
  const { workspaceId, userId, taskId, shortId } = input;
  await assertMembership(userId, workspaceId);

  const existing = await findTaskInWorkspace(workspaceId, taskId, shortId);

  const data: Prisma.TaskUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = formatTaskTitle(input.title);
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.scope !== undefined) data.scope = input.scope;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;
  if (input.tags !== undefined) data.tags = normalizeTags(input.tags);
  if (input.assignee !== undefined) {
    data.assignedToId =
      input.assignee === null
        ? null
        : await resolveAssignee(workspaceId, input.assignee);
  }

  const task = await prisma.task.update({
    where: { id: existing.id },
    data,
    include: { assignedTo: { select: { id: true, email: true, username: true } } },
  });
  await touchLastActiveWorkspace(userId, workspaceId);

  if (
    input.assignee !== undefined &&
    task.assignedToId &&
    task.assignedToId !== existing.assignedToId
  ) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    if (workspace) {
      void notifyTaskAssigned({
        assigneeUserId: task.assignedToId,
        actorUserId: userId,
        workspaceId,
        workspaceName: workspace.name,
        taskShortId: task.shortId,
        taskTitle: task.title,
      }).catch((err) => console.error("WhatsApp assign notify failed:", err));
    }
  }

  return task;
}

export interface UploadAssetInput {
  workspaceId: string;
  uploadedById: string;
  /** Raw file contents. */
  file: Buffer | Uint8Array;
  fileName: string;
  /** MIME type, e.g. "image/png". */
  fileType: string;
  tags?: string[];
  /** Attach to a task in the same workspace (by UUID or shortId). */
  taskId?: string;
  taskShortId?: number;
}

export async function uploadAsset(input: UploadAssetInput) {
  const {
    workspaceId,
    uploadedById,
    file,
    fileName,
    fileType,
    tags,
    taskId,
    taskShortId,
  } = input;
  await assertMembership(uploadedById, workspaceId);

  let attachTaskId: string | null = null;
  if (taskId || taskShortId !== undefined) {
    const task = await prisma.task.findFirst({
      where: taskId
        ? { id: taskId, workspaceId }
        : { workspaceId, shortId: taskShortId! },
      select: { id: true },
    });
    if (!task) {
      throw new ServiceError(
        `Task ${taskId ?? `#${taskShortId}`} not found in this workspace`,
        "NOT_FOUND"
      );
    }
    attachTaskId = task.id;
  }

  const supabase = getSupabaseAdmin();
  const storagePath = `${workspaceId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(storagePath, file, { contentType: fileType, upsert: false });
  if (error) {
    throw new ServiceError(`Storage upload failed: ${error.message}`, "UPLOAD_FAILED");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(storagePath);

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      taskId: attachTaskId,
      url: publicUrl,
      fileType,
      tags: normalizeAssetTags(tags ?? []),
      uploadedById,
    },
  });
  await touchLastActiveWorkspace(uploadedById, workspaceId);
  return asset;
}

export interface DeleteTaskInput {
  workspaceId: string;
  userId: string;
  taskId?: string;
  shortId?: number;
}

export async function deleteTask(input: DeleteTaskInput) {
  const { workspaceId, userId, taskId, shortId } = input;
  const membership = await assertMembership(userId, workspaceId);

  const existing = await findTaskInWorkspace(workspaceId, taskId, shortId);

  // Deletion is destructive: restricted to leaders/sub-leaders and the
  // task's creator (members can still create and update freely).
  const isLeadership =
    membership.role === "LEADER" || membership.role === "SUB_LEADER";
  if (!isLeadership && existing.createdById !== userId) {
    throw new ServiceError(
      "Only leaders, sub-leaders, or the task's creator can delete it",
      "FORBIDDEN"
    );
  }

  await prisma.task.delete({ where: { id: existing.id } });
  await touchLastActiveWorkspace(userId, workspaceId);
  return existing;
}

export async function listAssets(workspaceId: string, userId: string) {
  await assertMembership(userId, workspaceId);
  return prisma.asset.findMany({
    where: { workspaceId },
    include: { uploadedBy: { select: { id: true, email: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Same policy as task deletion: leadership or the uploader. */
export async function deleteAsset(input: {
  workspaceId: string;
  assetId: string;
  userId: string;
}) {
  const { workspaceId, assetId, userId } = input;
  const membership = await assertMembership(userId, workspaceId);

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, workspaceId },
  });
  if (!asset) {
    throw new ServiceError("Asset not found in this workspace", "NOT_FOUND");
  }

  const isLeadership =
    membership.role === "LEADER" || membership.role === "SUB_LEADER";
  if (!isLeadership && asset.uploadedById !== userId) {
    throw new ServiceError(
      "Only leaders, sub-leaders, or the uploader can delete an asset",
      "FORBIDDEN"
    );
  }

  // Best effort storage cleanup: the DB row is the source of truth.
  const supabase = getSupabaseAdmin();
  const prefix = `/storage/v1/object/public/${ASSETS_BUCKET}/`;
  const idx = asset.url.indexOf(prefix);
  if (idx !== -1) {
    const path = decodeURIComponent(asset.url.slice(idx + prefix.length));
    await supabase.storage
      .from(ASSETS_BUCKET)
      .remove([path])
      .catch(() => {});
  }

  await prisma.asset.delete({ where: { id: asset.id } });
  return asset;
}

export function assetFileName(url: string): string {
  return decodeURIComponent(
    url.split("/").pop()?.replace(/^\d+-/, "") ?? "file"
  );
}

export function normalizeAssetTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().slice(0, 24);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export async function updateAssetTags(input: {
  workspaceId: string;
  assetId: string;
  userId: string;
  tags: string[];
}) {
  const { workspaceId, assetId, userId, tags } = input;
  await assertMembership(userId, workspaceId);

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, workspaceId },
  });
  if (!asset) {
    throw new ServiceError("Asset not found in this workspace", "NOT_FOUND");
  }

  const updated = await prisma.asset.update({
    where: { id: asset.id },
    data: { tags: normalizeAssetTags(tags) },
  });
  await touchLastActiveWorkspace(userId, workspaceId);
  return updated;
}

export async function attachAssetToTask(input: {
  workspaceId: string;
  userId: string;
  taskShortId: number;
  fileName?: string;
  latest?: boolean;
}) {
  const { workspaceId, userId, taskShortId, fileName, latest } = input;
  const task = await findTaskInWorkspace(workspaceId, undefined, taskShortId);
  const asset = await resolveAssetForTagging({
    workspaceId,
    userId,
    fileName,
    latest: latest ?? !fileName,
  });

  const updated = await prisma.asset.update({
    where: { id: asset.id },
    data: { taskId: task.id },
  });
  await touchLastActiveWorkspace(userId, workspaceId);
  return { asset: updated, task };
}

export type AssetTagMode = "set" | "add" | "remove";

/** Resolve an asset by latest upload or partial file name (for WhatsApp / bots). */
export async function resolveAssetForTagging(input: {
  workspaceId: string;
  userId: string;
  fileName?: string;
  latest?: boolean;
}) {
  const { workspaceId, userId, fileName, latest } = input;
  const assets = await listAssets(workspaceId, userId);
  if (assets.length === 0) {
    throw new ServiceError("No assets in this workspace yet", "NOT_FOUND");
  }

  if (latest) return assets[0];

  const needle = fileName?.trim().toLowerCase();
  if (needle) {
    const match = assets.find((a) =>
      assetFileName(a.url).toLowerCase().includes(needle)
    );
    if (!match) {
      throw new ServiceError(
        `No asset matching "${fileName}" in this workspace`,
        "NOT_FOUND"
      );
    }
    return match;
  }

  throw new ServiceError(
    "Specify which asset to tag (file name or latest upload)",
    "INVALID_INPUT"
  );
}

export async function updateAssetTagsByRef(input: {
  workspaceId: string;
  userId: string;
  tags: string[];
  mode?: AssetTagMode;
  fileName?: string;
  latest?: boolean;
}) {
  const {
    workspaceId,
    userId,
    tags,
    mode = "add",
    fileName,
    latest,
  } = input;
  const asset = await resolveAssetForTagging({
    workspaceId,
    userId,
    fileName,
    latest,
  });

  const incoming = normalizeAssetTags(tags);
  let next: string[];
  if (mode === "set") {
    next = incoming;
  } else if (mode === "remove") {
    const remove = new Set(incoming.map((t) => t.toLowerCase()));
    next = asset.tags.filter((t) => !remove.has(t.toLowerCase()));
  } else {
    next = normalizeAssetTags([...asset.tags, ...incoming]);
  }

  return updateAssetTags({
    workspaceId,
    assetId: asset.id,
    userId,
    tags: next,
  });
}

/** Web board tab: tasks + workspace + caller role. No members/assets. */
export async function getBoardView(workspaceId: string, userId: string) {
  const membership = await assertMembership(userId, workspaceId);

  const [workspace, tasks] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { workspaceId },
      orderBy: { shortId: "asc" },
      include: {
        assignedTo: { select: { id: true, email: true, username: true } },
        attachments: {
          select: { id: true, url: true, fileType: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    touchLastActiveWorkspace(userId, workspaceId),
  ]);

  const grouped: Record<TaskStatus, typeof tasks> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };
  for (const task of tasks) grouped[task.status].push(task);

  return { workspace, board: grouped, selfRole: membership.role };
}

/** Web assets tab: assets + workspace + caller role. No members/tasks. */
export async function getAssetsView(workspaceId: string, userId: string) {
  const membership = await assertMembership(userId, workspaceId);

  const [workspace, assets] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true },
    }),
    prisma.asset.findMany({
      where: { workspaceId },
      include: {
        uploadedBy: { select: { id: true, email: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    touchLastActiveWorkspace(userId, workspaceId),
  ]);

  return { workspace, assets, selfRole: membership.role };
}

/** Full board snapshot: tasks grouped by status. Used by MCP + WhatsApp. */
export async function getBoardState(workspaceId: string, userId: string) {
  await assertMembership(userId, workspaceId);

  // The "touch" write doesn't depend on the reads -- run all three together
  // so the board view pays for one round trip, not two.
  const [workspace, tasks] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { workspaceId },
      orderBy: { shortId: "asc" },
      include: {
        assignedTo: { select: { id: true, email: true, username: true } },
        attachments: {
          select: { id: true, url: true, fileType: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    touchLastActiveWorkspace(userId, workspaceId),
  ]);

  const grouped: Record<TaskStatus, typeof tasks> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };
  for (const task of tasks) grouped[task.status].push(task);

  return { workspace, board: grouped, totalTasks: tasks.length };
}
