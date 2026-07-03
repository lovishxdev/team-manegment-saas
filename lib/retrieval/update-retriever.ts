import { prisma } from "@/lib/prisma";
import {
  cosineSimilarity,
  embedText,
  embeddingsEnabled,
  parseEmbeddingJson,
  semanticScore,
} from "@/lib/retrieval/embeddings";
import { getActorMembership, ServiceError } from "@/lib/services/project";

export type UpdateRetrievalHit = {
  id: string;
  body: string;
  createdAt: Date;
  score: number;
  author: { username: string; email: string | null };
};

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
const MIN_SCORE = 0.32;

function keywordScore(query: string, body: string): number {
  const q = query.toLowerCase().trim();
  const text = body.toLowerCase();
  if (!q) return 0;
  if (text.includes(q)) return 1;
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return 0;
  let hits = 0;
  for (const w of words) {
    if (text.includes(w)) hits++;
  }
  return hits / words.length;
}

/**
 * Retrieve task updates most relevant to a query (semantic + keyword).
 * Falls back to most recent updates when query is empty or no matches.
 */
export async function retrieveRelevantUpdates(input: {
  workspaceId: string;
  userId: string;
  taskId: string;
  query?: string;
  limit?: number;
}): Promise<UpdateRetrievalHit[]> {
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

  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const query = input.query?.trim() ?? "";

  const updates = await prisma.taskUpdate.findMany({
    where: { taskId: input.taskId, workspaceId: input.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { username: true, email: true } },
      embedding: true,
    },
  });

  if (updates.length === 0) return [];

  if (!query) {
    return updates.slice(0, limit).reverse().map((u) => ({
      id: u.id,
      body: u.body,
      createdAt: u.createdAt,
      score: 1,
      author: u.author,
    }));
  }

  if (!embeddingsEnabled()) {
    return updates
      .map((u) => ({ update: u, score: keywordScore(query, u.body) }))
      .filter((r) => r.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ update, score }) => ({
        id: update.id,
        body: update.body,
        createdAt: update.createdAt,
        score,
        author: update.author,
      }))
      .reverse();
  }

  let queryVector: number[] | null = null;
  try {
    queryVector = await embedText(query);
  } catch (err) {
    console.error("[retrieval] update query embed failed:", err);
  }

  const scored = updates.map((u) => {
    const kw = keywordScore(query, u.body);
    let sem: number | null = null;
    const stored = u.embedding
      ? parseEmbeddingJson(u.embedding.embedding)
      : null;
    if (stored && queryVector) {
      sem = semanticScore(cosineSimilarity(queryVector, stored));
    }
    const score =
      sem !== null ? 0.7 * sem + 0.3 * kw : kw;
    return { update: u, score, kw };
  });

  const relevant = scored
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const picked =
    relevant.length > 0
      ? relevant.slice(0, limit)
      : scored.sort((a, b) => b.kw - a.kw).slice(0, limit);

  return picked
    .sort(
      (a, b) =>
        a.update.createdAt.getTime() - b.update.createdAt.getTime()
    )
    .map(({ update, score }) => ({
      id: update.id,
      body: update.body,
      createdAt: update.createdAt,
      score,
      author: update.author,
    }));
}
