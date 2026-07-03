import { prisma } from "@/lib/prisma";
import { retrieveRelevantUpdates } from "@/lib/retrieval/update-retriever";
import {
  resolveBestTaskMatch,
  retrieveTasksByQuery,
  type TaskRetrievalHit,
} from "@/lib/retrieval/task-retriever";
import {
  getActorMembership,
  getTask,
  ServiceError,
  taskAssigneeUsers,
} from "@/lib/services/project";
import { displayUser } from "@/lib/username";

export type TaskContextPack = {
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
  ambiguousAlternatives: { shortId: number; title: string; score: number }[];
  relevantUpdates: {
    body: string;
    author: string;
    createdAt: Date;
    relevance: number;
  }[];
  query: string;
};

export type BuildTaskContextInput = {
  workspaceId: string;
  userId: string;
  query: string;
  shortId?: number;
};

export async function buildTaskContextPack(
  input: BuildTaskContextInput
): Promise<
  | { ok: true; pack: TaskContextPack }
  | { ok: false; reason: "not_found" | "ambiguous"; message: string; alternatives?: TaskRetrievalHit[] }
> {
  const membership = await getActorMembership(
    input.userId,
    input.workspaceId
  );
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }

  const query = input.query.trim();
  let hit: TaskRetrievalHit | null = null;
  let alternatives: TaskRetrievalHit[] = [];

  if (input.shortId !== undefined) {
    const task = await getTask(
      input.workspaceId,
      input.userId,
      input.shortId
    );
    hit = {
      id: task.id,
      shortId: task.shortId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      tags: task.tags,
      score: 1,
      semanticScore: null,
      keywordScore: 1,
      assignees: task.assignees,
      category: task.category,
    };
  } else if (query) {
    const hits = await retrieveTasksByQuery({
      workspaceId: input.workspaceId,
      userId: input.userId,
      query,
      limit: 3,
    });
    if (hits.length === 0) {
      return {
        ok: false,
        reason: "not_found",
        message: "No task matched that description.",
      };
    }
    const best = await resolveBestTaskMatch({
      workspaceId: input.workspaceId,
      userId: input.userId,
      query,
    });
    if (!best && hits.length > 1) {
      return {
        ok: false,
        reason: "ambiguous",
        message: "Multiple tasks could match. Pick one:",
        alternatives: hits,
      };
    }
    hit = best ?? hits[0];
    alternatives = hits.filter((h) => h.id !== hit!.id);
  } else {
    throw new ServiceError(
      "Provide a task #N or describe what you're asking about",
      "INVALID_INPUT"
    );
  }

  const full = await prisma.task.findUnique({
    where: { id: hit.id },
    include: {
      category: { select: { name: true } },
      assignees: {
        include: {
          user: { select: { id: true, email: true, username: true } },
        },
      },
      _count: { select: { updates: true } },
    },
  });
  if (!full) {
    return {
      ok: false,
      reason: "not_found",
      message: "Task not found.",
    };
  }

  const relevantUpdates = await retrieveRelevantUpdates({
    workspaceId: input.workspaceId,
    userId: input.userId,
    taskId: hit.id,
    query: query || hit.title,
  });

  const pack: TaskContextPack = {
    task: {
      shortId: full.shortId,
      title: full.title,
      status: full.status,
      priority: full.priority,
      category: full.category.name,
      assignees: taskAssigneeUsers(full).map((u) => displayUser(u)),
      description: full.description,
      tags: full.tags,
      totalUpdates: full._count.updates,
    },
    matchScore: input.shortId !== undefined ? null : hit.score,
    ambiguousAlternatives: alternatives.map((a) => ({
      shortId: a.shortId,
      title: a.title,
      score: a.score,
    })),
    relevantUpdates: relevantUpdates.map((u) => ({
      body: u.body,
      author: displayUser(u.author),
      createdAt: u.createdAt,
      relevance: u.score,
    })),
    query: query || `#${full.shortId}`,
  };

  return { ok: true, pack };
}
