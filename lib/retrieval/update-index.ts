import { prisma } from "@/lib/prisma";
import {
  embedText,
  embeddingsEnabled,
  hashContent,
} from "@/lib/retrieval/embeddings";

export function buildUpdateIndexDocument(update: {
  body: string;
  author: { username: string };
}): string {
  return `@${update.author.username}: ${update.body}`;
}

/** (Re)index one task update for RAG. No-op if embedding API unset. */
export async function indexTaskUpdateEmbedding(
  taskUpdateId: string
): Promise<void> {
  if (!embeddingsEnabled()) return;

  const update = await prisma.taskUpdate.findUnique({
    where: { id: taskUpdateId },
    select: {
      id: true,
      workspaceId: true,
      taskId: true,
      body: true,
      author: { select: { username: true } },
    },
  });
  if (!update) return;

  const document = buildUpdateIndexDocument(update);
  const contentHash = hashContent(document);

  const existing = await prisma.taskUpdateEmbedding.findUnique({
    where: { taskUpdateId },
    select: { contentHash: true },
  });
  if (existing?.contentHash === contentHash) return;

  const vector = await embedText(document);

  await prisma.taskUpdateEmbedding.upsert({
    where: { taskUpdateId },
    create: {
      taskUpdateId: update.id,
      workspaceId: update.workspaceId,
      taskId: update.taskId,
      contentHash,
      embedding: vector,
    },
    update: {
      contentHash,
      embedding: vector,
    },
  });
}

export function scheduleTaskUpdateEmbeddingIndex(taskUpdateId: string): void {
  if (!embeddingsEnabled()) return;
  void indexTaskUpdateEmbedding(taskUpdateId).catch((err) =>
    console.error("[retrieval] update index failed:", err)
  );
}

export async function indexWorkspaceTaskUpdateEmbeddings(
  workspaceId: string
): Promise<{ indexed: number; skipped: number }> {
  if (!embeddingsEnabled()) {
    return { indexed: 0, skipped: 0 };
  }

  const updates = await prisma.taskUpdate.findMany({
    where: { workspaceId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let indexed = 0;
  let skipped = 0;
  for (const row of updates) {
    try {
      const before = await prisma.taskUpdateEmbedding.findUnique({
        where: { taskUpdateId: row.id },
        select: { contentHash: true },
      });
      await indexTaskUpdateEmbedding(row.id);
      const after = await prisma.taskUpdateEmbedding.findUnique({
        where: { taskUpdateId: row.id },
        select: { contentHash: true },
      });
      if (before?.contentHash === after?.contentHash) skipped++;
      else indexed++;
    } catch (err) {
      console.error(`[retrieval] index update ${row.id} failed:`, err);
    }
  }

  return { indexed, skipped };
}
