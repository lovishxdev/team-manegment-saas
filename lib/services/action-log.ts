import type { TaskPriority, TaskStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError, deleteTask, updateTask } from "@/lib/services/project";
import { formatTaskRef } from "@/lib/whatsapp-task-ref";

/**
 * Undo journal. Mutating bot tools record a typed inverse; "undo that"
 * executes it. Code owns what reverting means — the model only decides
 * WHEN the user asked for an undo (via the undo_last_action tool).
 */

/** How far back "undo" reaches. Older actions are history, not mistakes. */
const UNDO_WINDOW_MS = 60 * 60 * 1000;

/** Field snapshot for reverting a task edit. Only changed fields are stored. */
export type TaskFieldSnapshot = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  tags?: string[];
  categoryId?: string;
  assigneeIds?: string[];
};

export type UndoInverse =
  | { kind: "delete_task"; taskId: string; taskTitle: string }
  | {
      kind: "restore_task";
      taskId: string;
      taskTitle: string;
      prev: TaskFieldSnapshot;
    }
  | { kind: "delete_update"; updateId: string; taskTitle: string }
  | { kind: "delete_link"; linkId: string; linkTitle: string };

export type RecordUndoableInput = {
  userId: string;
  workspaceId: string;
  channel: "whatsapp" | "mcp";
  tool: string;
  /** User-facing description of the ORIGINAL action, e.g. `Added *X*`. */
  summary: string;
  inverse: UndoInverse;
};

/** Fire-and-forget: journaling must never fail the action it describes. */
export function recordUndoable(input: RecordUndoableInput): void {
  void prisma.botActionLog
    .create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        channel: input.channel,
        tool: input.tool,
        summary: input.summary,
        inverse: input.inverse,
      },
    })
    .catch((err) => console.error("[action-log] record failed:", err));
}

export type UndoResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Revert the caller's most recent journaled action in this workspace.
 * Repeated calls keep popping the stack within the undo window.
 */
export async function undoLastAction(
  userId: string,
  workspaceId: string
): Promise<UndoResult> {
  const entry = await prisma.botActionLog.findFirst({
    where: {
      userId,
      workspaceId,
      undoneAt: null,
      createdAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!entry) {
    return {
      ok: false,
      message:
        "Nothing recent to undo — I only revert changes made in the last hour.",
    };
  }

  const inverse = entry.inverse as UndoInverse;

  try {
    const message = await executeInverse(userId, workspaceId, inverse, entry.summary);
    await prisma.botActionLog.update({
      where: { id: entry.id },
      data: { undoneAt: new Date() },
    });
    return { ok: true, message };
  } catch (err) {
    // Target may have been changed/removed since (e.g. task deleted on web).
    await prisma.botActionLog.update({
      where: { id: entry.id },
      data: { undoneAt: new Date() },
    });
    const detail =
      err instanceof ServiceError ? ` (${err.message})` : "";
    return {
      ok: false,
      message: `I couldn't undo "${entry.summary}" — it may have changed since${detail}. Nothing was modified.`,
    };
  }
}

async function executeInverse(
  userId: string,
  workspaceId: string,
  inverse: UndoInverse,
  originalSummary: string
): Promise<string> {
  switch (inverse.kind) {
    case "delete_task": {
      await deleteTask({ workspaceId, userId, taskId: inverse.taskId });
      return `Undone — deleted ${formatTaskRef(inverse.taskTitle)} (was: ${originalSummary}).`;
    }

    case "restore_task": {
      const prev = inverse.prev;
      await updateTask({
        workspaceId,
        userId,
        taskId: inverse.taskId,
        title: prev.title,
        description: prev.description,
        status: prev.status,
        priority: prev.priority,
        dueDate:
          prev.dueDate === undefined
            ? undefined
            : prev.dueDate === null
              ? null
              : new Date(prev.dueDate),
        tags: prev.tags,
        categoryId: prev.categoryId,
        assigneeIds: prev.assigneeIds,
      });
      return `Undone — restored ${formatTaskRef(inverse.taskTitle)} to how it was.`;
    }

    case "delete_update": {
      const update = await prisma.taskUpdate.findFirst({
        where: { id: inverse.updateId, workspaceId, authorId: userId },
      });
      if (!update) {
        throw new ServiceError("That note no longer exists", "NOT_FOUND");
      }
      // MemoryEvent.sourceUpdateId is SetNull on delete — provenance detaches
      // cleanly, but a captured event from this note should not outlive it.
      await prisma.memoryEvent.deleteMany({
        where: { sourceUpdateId: inverse.updateId },
      });
      await prisma.taskUpdate.delete({ where: { id: inverse.updateId } });
      return `Undone — removed your note on ${formatTaskRef(inverse.taskTitle)}.`;
    }

    case "delete_link": {
      const link = await prisma.workspaceLink.findFirst({
        where: { id: inverse.linkId, workspaceId },
      });
      if (!link) {
        throw new ServiceError("That link no longer exists", "NOT_FOUND");
      }
      await prisma.workspaceLink.delete({ where: { id: inverse.linkId } });
      return `Undone — removed the link *${inverse.linkTitle}*.`;
    }
  }
}

/** Snapshot only the fields an update is about to change. */
export function buildTaskSnapshot(
  existing: {
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    tags: string[];
    categoryId: string;
    assigneeIds: string[];
  },
  changing: {
    title?: unknown;
    description?: unknown;
    status?: unknown;
    priority?: unknown;
    dueDate?: unknown;
    tags?: unknown;
    category?: unknown;
    assignees?: unknown;
    assignee?: unknown;
  }
): TaskFieldSnapshot {
  const prev: TaskFieldSnapshot = {};
  if (changing.title !== undefined) prev.title = existing.title;
  if (changing.description !== undefined) prev.description = existing.description;
  if (changing.status !== undefined) prev.status = existing.status;
  if (changing.priority !== undefined) prev.priority = existing.priority;
  if (changing.dueDate !== undefined) {
    prev.dueDate = existing.dueDate ? existing.dueDate.toISOString() : null;
  }
  if (changing.tags !== undefined) prev.tags = existing.tags;
  if (changing.category !== undefined) prev.categoryId = existing.categoryId;
  if (changing.assignees !== undefined || changing.assignee !== undefined) {
    prev.assigneeIds = existing.assigneeIds;
  }
  return prev;
}
