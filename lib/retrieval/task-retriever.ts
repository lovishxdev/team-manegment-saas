import type { Prisma, TaskPriority, TaskStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cosineSimilarity,
  embedText,
  embeddingsEnabled,
  parseEmbeddingJson,
  semanticScore,
} from "@/lib/retrieval/embeddings";
import { scoreTaskTitleQuery } from "@/lib/task-title-search";
import {
  getActorMembership,
  ServiceError,
  taskAssigneesInclude,
} from "@/lib/services/project";

export type TaskRetrievalHit = {
  id: string;
  shortId: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  score: number;
  semanticScore: number | null;
  keywordScore: number;
  assignees: {
    user: { id: string; email: string | null; username: string };
  }[];
  category: { id: string; name: string; slug: string };
};

export type RetrieveTasksInput = {
  workspaceId: string;
  userId: string;
  query: string;
  limit?: number;
  status?: TaskStatus | TaskStatus[];
  tag?: string;
  assignedToMe?: boolean;
  priority?: TaskPriority;
  categoryId?: string;
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 25;
const MIN_KEYWORD_SCORE = 0.35;
const MIN_HYBRID_SCORE = 0.38;

const SEMANTIC_WEIGHT = 0.65;
const KEYWORD_WEIGHT = 0.35;

function buildCandidateWhere(input: RetrieveTasksInput): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { workspaceId: input.workspaceId };

  if (input.status) {
    where.status = Array.isArray(input.status)
      ? { in: input.status }
      : input.status;
  }

  if (input.categoryId) {
    where.categoryId = input.categoryId;
  }

  if (input.tag) {
    where.tags = { has: input.tag.trim() };
  }

  if (input.assignedToMe) {
    where.assignees = { some: { userId: input.userId } };
  }

  if (input.priority) {
    where.priority = input.priority;
  }

  return where;
}

type Candidate = Awaited<
  ReturnType<
    typeof prisma.task.findMany<{
      include: typeof taskAssigneesInclude & { embedding: true };
    }>
  >
>[number];

function keywordOnlyHits(
  candidates: Candidate[],
  query: string,
  limit: number
): TaskRetrievalHit[] {
  return candidates
    .map((task) => {
      const keywordScore = scoreTaskTitleQuery(
        query,
        task.title,
        task.description
      );
      return { task, keywordScore };
    })
    .filter((row) => row.keywordScore >= MIN_KEYWORD_SCORE)
    .sort((a, b) => b.keywordScore - a.keywordScore)
    .slice(0, limit)
    .map(({ task, keywordScore }) => ({
      id: task.id,
      shortId: task.shortId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      tags: task.tags,
      score: keywordScore,
      semanticScore: null,
      keywordScore,
      assignees: task.assignees,
      category: task.category,
    }));
}

/**
 * Phase A retriever: hybrid semantic + keyword ranking over workspace tasks.
 * Falls back to keyword-only when OPENAI_API_KEY is unset.
 */
export async function retrieveTasksByQuery(
  input: RetrieveTasksInput
): Promise<TaskRetrievalHit[]> {
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
  if (!query) return [];

  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_LIMIT),
    MAX_LIMIT
  );

  const candidates = await prisma.task.findMany({
    where: buildCandidateWhere(input),
    include: {
      ...taskAssigneesInclude,
      embedding: true,
    },
    orderBy: { shortId: "asc" },
    take: 250,
  });

  if (candidates.length === 0) return [];

  if (!embeddingsEnabled()) {
    return keywordOnlyHits(candidates, query, limit);
  }

  let queryVector: number[] | null = null;
  try {
    queryVector = await embedText(query);
  } catch (err) {
    console.error("[retrieval] query embed failed, keyword fallback:", err);
    return keywordOnlyHits(candidates, query, limit);
  }

  const hits: TaskRetrievalHit[] = [];

  for (const task of candidates) {
    const keywordScore = scoreTaskTitleQuery(
      query,
      task.title,
      task.description
    );

    let sem: number | null = null;
    const stored = task.embedding
      ? parseEmbeddingJson(task.embedding.embedding)
      : null;
    if (stored && queryVector) {
      sem = semanticScore(cosineSimilarity(queryVector, stored));
    }

    const score =
      sem !== null
        ? SEMANTIC_WEIGHT * sem + KEYWORD_WEIGHT * keywordScore
        : keywordScore;

    if (score < MIN_HYBRID_SCORE && keywordScore < MIN_KEYWORD_SCORE) {
      continue;
    }

    hits.push({
      id: task.id,
      shortId: task.shortId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      tags: task.tags,
      score,
      semanticScore: sem,
      keywordScore,
      assignees: task.assignees,
      category: task.category,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Best single task match, or null if ambiguous / below threshold. */
export async function resolveBestTaskMatch(
  input: Omit<RetrieveTasksInput, "limit">
): Promise<TaskRetrievalHit | null> {
  const hits = await retrieveTasksByQuery({ ...input, limit: 3 });
  if (hits.length === 0) return null;

  const top = hits[0];
  const runnerUp = hits[1];

  if (top.score < 0.42) return null;

  if (
    runnerUp &&
    top.score - runnerUp.score < 0.08 &&
    runnerUp.score >= 0.4
  ) {
    return null;
  }

  return top;
}
