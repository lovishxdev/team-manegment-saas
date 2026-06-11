import { cache } from "react";
import {
  Prisma,
  TaskPriority,
  TaskScope,
  TaskStatus,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ASSETS_BUCKET, getSupabaseAdmin } from "@/lib/supabase";

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
 * (e.g. getBoardState + getWorkspaceMembers); within one render pass that
 * now costs a single query. In route handlers cache() is a transparent
 * passthrough. Only use this for the ACTOR's permission checks -- target
 * lookups around mutations must stay uncached.
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
async function touchLastActiveWorkspace(userId: string, workspaceId: string) {
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
      throw new ServiceError(
        `Multiple workspaces match "${hint}": ${byName
          .map((m) => m.workspace.name)
          .join(", ")}. Please be more specific.`,
        "AMBIGUOUS_WORKSPACE"
      );
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
export async function resolveAssignee(
  workspaceId: string,
  idOrEmail: string
): Promise<string> {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, email: true } } },
  });

  const byId = memberships.find((m) => m.user.id === idOrEmail);
  if (byId) return byId.user.id;

  const needle = idOrEmail.trim().toLowerCase();
  const byEmail = memberships.filter((m) =>
    m.user.email?.toLowerCase().includes(needle)
  );
  if (byEmail.length === 1) return byEmail[0].user.id;
  if (byEmail.length > 1) {
    throw new ServiceError(
      `Multiple members match "${idOrEmail}": ${byEmail
        .map((m) => m.user.email)
        .join(", ")}. Be more specific.`,
      "AMBIGUOUS_WORKSPACE"
    );
  }
  throw new ServiceError(
    `No workspace member matches "${idOrEmail}"`,
    "NOT_FOUND"
  );
}

export interface CreateTaskInput {
  workspaceId: string;
  title: string;
  description?: string;
  scope?: TaskScope;
  priority?: TaskPriority;
  dueDate?: Date | null;
  assignedToId?: string;
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
    userId,
  } = input;
  await assertMembership(userId, workspaceId);

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
            title,
            description: description ?? null,
            scope: scope ?? TaskScope.GENERAL,
            priority: priority ?? TaskPriority.MEDIUM,
            dueDate: dueDate ?? null,
            assignedToId: assignedToId ?? null,
            createdById: userId,
          },
          include: { assignedTo: { select: { id: true, email: true } } },
        });
      });
      await touchLastActiveWorkspace(userId, workspaceId);
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
  /** Member user id or email; null clears the assignment. */
  assignee?: string | null;
}

export async function updateTask(input: UpdateTaskInput) {
  const { workspaceId, userId, taskId, shortId } = input;
  await assertMembership(userId, workspaceId);

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

  const data: Prisma.TaskUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.scope !== undefined) data.scope = input.scope;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;
  if (input.assignee !== undefined) {
    data.assignedToId =
      input.assignee === null
        ? null
        : await resolveAssignee(workspaceId, input.assignee);
  }

  const task = await prisma.task.update({
    where: { id: existing.id },
    data,
    include: { assignedTo: { select: { id: true, email: true } } },
  });
  await touchLastActiveWorkspace(userId, workspaceId);
  return task;
}

/** Convenience wrapper kept for existing callers. */
export async function updateTaskStatus(input: {
  workspaceId: string;
  status: TaskStatus;
  userId: string;
  taskId?: string;
  shortId?: number;
}) {
  return updateTask(input);
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
      tags: tags ?? [],
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

export interface AssignTaskInput {
  workspaceId: string;
  taskId: string;
  /** null clears the assignment */
  assigneeId: string | null;
  userId: string;
}

export async function assignTask(input: AssignTaskInput) {
  const { workspaceId, taskId, assigneeId, userId } = input;
  await assertMembership(userId, workspaceId);

  if (assigneeId) {
    const assigneeMembership = await prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: assigneeId, workspaceId } },
    });
    if (!assigneeMembership) {
      throw new ServiceError(
        "Assignee is not a member of this workspace",
        "INVALID_INPUT"
      );
    }
  }

  const existing = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!existing) {
    throw new ServiceError("Task not found in this workspace", "NOT_FOUND");
  }

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: { assignedToId: assigneeId },
    include: { assignedTo: { select: { id: true, email: true } } },
  });
  await touchLastActiveWorkspace(userId, workspaceId);
  return task;
}

export async function listAssets(workspaceId: string, userId: string) {
  await assertMembership(userId, workspaceId);
  return prisma.asset.findMany({
    where: { workspaceId },
    include: { uploadedBy: { select: { id: true, email: true } } },
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
        assignedTo: { select: { id: true, email: true } },
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
