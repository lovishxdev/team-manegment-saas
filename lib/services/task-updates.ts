import { prisma } from "@/lib/prisma";
import { getActorMembership, ServiceError } from "@/lib/services/project";

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
};

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
    },
  });

  return { task, updates };
}

export async function createTaskUpdate(input: {
  workspaceId: string;
  userId: string;
  shortId: number;
  body: string;
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

  const update = await prisma.taskUpdate.create({
    data: {
      workspaceId: input.workspaceId,
      taskId: task.id,
      authorId: input.userId,
      body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
    },
  });

  return {
    ...update,
    taskShortId: task.shortId,
    taskTitle: task.title,
  };
}

/** Recent updates for read_task / quick context (newest last). */
export async function getRecentTaskUpdates(
  workspaceId: string,
  userId: string,
  shortId: number,
  limit = 10
): Promise<TaskUpdateRow[]> {
  const task = await resolveTaskInWorkspace(workspaceId, userId, shortId);
  const rows = await prisma.taskUpdate.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
    },
  });
  return rows.reverse();
}
