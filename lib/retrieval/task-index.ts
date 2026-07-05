import { prisma } from "@/lib/prisma";
import { scheduleBackgroundTask } from "@/lib/background-task";
import {
  embedText,
  embeddingsEnabled,
  hashContent,
} from "@/lib/retrieval/embeddings";

export type TaskIndexDocument = {
  id: string;
  workspaceId: string;
  shortId: number;
  title: string;
  description: string | null;
  tags: string[];
  status: string;
  category: { name: string };
};

/** Text blob we embed for semantic task retrieval. */
export function buildTaskIndexDocument(task: TaskIndexDocument): string {
  const lines = [
    `Task: ${task.title}`,
    task.description ? `Details: ${task.description}` : null,
    task.tags.length > 0 ? `Tags: ${task.tags.join(", ")}` : null,
    `Category: ${task.category.name}`,
    `Status: ${task.status.replace("_", " ")}`,
  ];
  return lines.filter(Boolean).join("\n");
}

const taskIndexInclude = {
  category: { select: { name: true } },
} as const;

/** (Re)index one task for semantic search. No-op if OpenAI key missing. */
export async function indexTaskEmbedding(taskId: string): Promise<void> {
  if (!embeddingsEnabled()) return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: taskIndexInclude,
  });
  if (!task) return;

  const document = buildTaskIndexDocument(task);
  const contentHash = hashContent(document);

  const existing = await prisma.taskEmbedding.findUnique({
    where: { taskId },
    select: { contentHash: true },
  });
  if (existing?.contentHash === contentHash) return;

  const vector = await embedText(document);

  await prisma.taskEmbedding.upsert({
    where: { taskId },
    create: {
      taskId,
      workspaceId: task.workspaceId,
      contentHash,
      embedding: vector,
    },
    update: {
      contentHash,
      embedding: vector,
    },
  });
}

/** Fire-and-forget indexing — never block task writes on embed latency. */
export function scheduleTaskEmbeddingIndex(taskId: string): void {
  if (!embeddingsEnabled()) return;
  scheduleBackgroundTask("retrieval task index", () =>
    indexTaskEmbedding(taskId)
  );
}

/** Index every task in a workspace (backfill / repair). */
export async function indexWorkspaceTaskEmbeddings(
  workspaceId: string
): Promise<{ indexed: number; skipped: number }> {
  if (!embeddingsEnabled()) {
    return { indexed: 0, skipped: 0 };
  }

  const tasks = await prisma.task.findMany({
    where: { workspaceId },
    select: { id: true },
    orderBy: { shortId: "asc" },
  });

  let indexed = 0;
  let skipped = 0;
  for (const task of tasks) {
    try {
      const before = await prisma.taskEmbedding.findUnique({
        where: { taskId: task.id },
        select: { contentHash: true },
      });
      await indexTaskEmbedding(task.id);
      const after = await prisma.taskEmbedding.findUnique({
        where: { taskId: task.id },
        select: { contentHash: true },
      });
      if (before?.contentHash === after?.contentHash) skipped++;
      else indexed++;
    } catch (err) {
      console.error(`[retrieval] index task ${task.id} failed:`, err);
    }
  }

  return { indexed, skipped };
}
