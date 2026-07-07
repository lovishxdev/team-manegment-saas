import { prisma } from "@/lib/prisma";
import { getActorMembership, ServiceError } from "@/lib/services/project";
import { scheduleTaskUpdateEmbeddingIndex } from "@/lib/retrieval/update-index";
import { scheduleMemoryCapture } from "@/lib/memory/capture";
import { resolveAllMentionUserIds, mentionLabelsForUsers } from "@/lib/mentions";
import { notifyMentionedInUpdate } from "@/lib/whatsapp-notify";
import { displayUser } from "@/lib/username";

export const MAX_TASK_UPDATE_BODY = 8000;
export const DEFAULT_TASK_UPDATES_LIMIT = 50;
export const MAX_TASK_UPDATES_LIMIT = 100;

const authorSelect = {
  id: true,
  email: true,
  username: true,
} as const;

export type TaskUpdateRow = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; email: string | null; username: string };
  mentionedLabels: string[];
  saved: boolean;
};

function mapTaskUpdateRow(
  update: {
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; email: string | null; username: string };
    mentions: { user: { id: string; email: string | null; username: string } }[];
  },
  savedIds: Set<string>
): TaskUpdateRow {
  return {
    id: update.id,
    body: update.body,
    createdAt: update.createdAt,
    author: update.author,
    mentionedLabels: update.mentions.map((m) => displayUser(m.user)),
    saved: savedIds.has(update.id),
  };
}

async function savedUpdateIdsForTask(
  userId: string,
  taskId: string
): Promise<Set<string>> {
  const rows = await prisma.taskUpdateSave.findMany({
    where: { userId, update: { taskId } },
    select: { updateId: true },
  });
  return new Set(rows.map((row) => row.updateId));
}

async function resolveTaskInWorkspace(
  workspaceId: string,
  userId: string,
  shortId: number
) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }

  const task = await prisma.task.findFirst({
    where: { workspaceId, shortId },
    select: { id: true, shortId: true, title: true },
  });
  if (!task) {
    throw new ServiceError(
      `Task #${shortId} not found in this workspace`,
      "NOT_FOUND"
    );
  }
  return task;
}

export async function listTaskUpdates(
  workspaceId: string,
  userId: string,
  shortId: number,
  options?: { limit?: number; before?: Date }
): Promise<{ task: { shortId: number; title: string }; updates: TaskUpdateRow[] }> {
  const task = await resolveTaskInWorkspace(workspaceId, userId, shortId);
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_TASK_UPDATES_LIMIT),
    MAX_TASK_UPDATES_LIMIT
  );

  const savedIds = await savedUpdateIdsForTask(userId, task.id);

  const updates = await prisma.taskUpdate.findMany({
    where: {
      taskId: task.id,
      ...(options?.before ? { createdAt: { lt: options.before } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
      mentions: {
        select: {
          user: { select: authorSelect },
        },
      },
    },
  });

  return {
    task,
    updates: updates.map((u) => mapTaskUpdateRow(u, savedIds)),
  };
}

export async function createTaskUpdate(input: {
  workspaceId: string;
  userId: string;
  shortId: number;
  body: string;
  /** Member handles tagged by the agent from natural language (no @ in body). */
  mentionRefs?: string[];
}): Promise<TaskUpdateRow & { taskShortId: number; taskTitle: string }> {
  const body = input.body.trim();
  if (!body) {
    throw new ServiceError("Update message can't be empty", "INVALID_INPUT");
  }
  if (body.length > MAX_TASK_UPDATE_BODY) {
    throw new ServiceError(
      `Update is too long (max ${MAX_TASK_UPDATE_BODY} characters)`,
      "INVALID_INPUT"
    );
  }

  const task = await resolveTaskInWorkspace(
    input.workspaceId,
    input.userId,
    input.shortId
  );

  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId: input.workspaceId },
    include: { user: { select: authorSelect } },
  });
  const mentionedUserIds = resolveAllMentionUserIds(
    memberships,
    body,
    input.mentionRefs
  ).filter((id) => id !== input.userId);

  const update = await prisma.taskUpdate.create({
    data: {
      workspaceId: input.workspaceId,
      taskId: task.id,
      authorId: input.userId,
      body,
      ...(mentionedUserIds.length > 0
        ? {
            mentions: {
              create: mentionedUserIds.map((userId) => ({ userId })),
            },
          }
        : {}),
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
      mentions: {
        select: {
          user: { select: authorSelect },
        },
      },
    },
  });

  scheduleTaskUpdateEmbeddingIndex(update.id);
  scheduleMemoryCapture(update.id);

  if (mentionedUserIds.length > 0) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { name: true },
    });
    void notifyMentionedInUpdate({
      mentionedUserIds,
      actorUserId: input.userId,
      workspaceId: input.workspaceId,
      workspaceName: workspace?.name ?? "your workspace",
      taskShortId: task.shortId,
      taskTitle: task.title,
      body,
    }).catch((err) => console.error("WhatsApp mention notify failed:", err));
  }

  return {
    id: update.id,
    body: update.body,
    createdAt: update.createdAt,
    author: update.author,
    mentionedLabels: mentionLabelsForUsers(memberships, mentionedUserIds),
    saved: false,
    taskShortId: task.shortId,
    taskTitle: task.title,
  };
}

/** All updates on a task for bot context (oldest first). */
export async function getRecentTaskUpdates(
  workspaceId: string,
  userId: string,
  shortId: number
): Promise<TaskUpdateRow[]> {
  const task = await resolveTaskInWorkspace(workspaceId, userId, shortId);
  const savedIds = await savedUpdateIdsForTask(userId, task.id);
  return prisma.taskUpdate.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
      mentions: {
        select: {
          user: { select: authorSelect },
        },
      },
    },
  }).then((updates) =>
    updates.map((u) => mapTaskUpdateRow(u, savedIds))
  );
}

export async function deleteTaskUpdate(input: {
  workspaceId: string;
  userId: string;
  updateId: string;
}): Promise<void> {
  const update = await prisma.taskUpdate.findUnique({
    where: { id: input.updateId },
    select: { id: true, workspaceId: true, authorId: true },
  });
  if (!update || update.workspaceId !== input.workspaceId) {
    throw new ServiceError("Update not found", "NOT_FOUND");
  }

  await getActorMembership(input.userId, input.workspaceId);
  if (update.authorId !== input.userId) {
    throw new ServiceError("You can only delete your own updates", "FORBIDDEN");
  }

  await prisma.taskUpdate.delete({ where: { id: input.updateId } });
}

export async function setTaskUpdateSaved(input: {
  workspaceId: string;
  userId: string;
  updateId: string;
  saved: boolean;
}): Promise<boolean> {
  const update = await prisma.taskUpdate.findUnique({
    where: { id: input.updateId },
    select: { id: true, workspaceId: true },
  });
  if (!update || update.workspaceId !== input.workspaceId) {
    throw new ServiceError("Update not found", "NOT_FOUND");
  }

  await getActorMembership(input.userId, input.workspaceId);

  if (input.saved) {
    await prisma.taskUpdateSave.upsert({
      where: {
        updateId_userId: {
          updateId: input.updateId,
          userId: input.userId,
        },
      },
      create: {
        updateId: input.updateId,
        userId: input.userId,
      },
      update: {},
    });
    return true;
  }

  await prisma.taskUpdateSave.deleteMany({
    where: { updateId: input.updateId, userId: input.userId },
  });
  return false;
}
