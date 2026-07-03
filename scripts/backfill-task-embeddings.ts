/**
 * Backfill semantic embeddings for tasks and task updates.
 *
 * Usage:
 *   npm run backfill:task-embeddings
 *   npm run backfill:task-embeddings <workspaceId>
 *   npm run backfill:task-embeddings -- --updates-only
 *
 * Requires OPENROUTER_API_KEY or OPENAI_API_KEY.
 */
import "dotenv/config";
import {
  embeddingsEnabled,
  resolveEmbeddingProvider,
} from "../lib/retrieval/embeddings";
import { indexWorkspaceTaskEmbeddings } from "../lib/retrieval/task-index";
import { indexWorkspaceTaskUpdateEmbeddings } from "../lib/retrieval/update-index";
import { prisma } from "../lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const updatesOnly = args.includes("--updates-only");
  const workspaceId = args.find((a) => !a.startsWith("--"))?.trim();

  if (!embeddingsEnabled()) {
    console.error(
      "Set OPENROUTER_API_KEY or OPENAI_API_KEY for semantic indexing."
    );
    process.exit(1);
  }

  console.log(`Using embedding provider: ${resolveEmbeddingProvider()}`);

  const workspaces = workspaceId
    ? [{ id: workspaceId, name: workspaceId }]
    : await prisma.workspace.findMany({
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      });

  if (workspaces.length === 0) {
    console.log("No workspaces found.");
    return;
  }

  for (const ws of workspaces) {
    if (!updatesOnly) {
      console.log(`Indexing tasks in "${ws.name}"…`);
      const tasks = await indexWorkspaceTaskEmbeddings(ws.id);
      console.log(
        `  tasks — ${tasks.indexed} updated, ${tasks.skipped} unchanged`
      );
    }

    console.log(`Indexing task updates in "${ws.name}"…`);
    const updates = await indexWorkspaceTaskUpdateEmbeddings(ws.id);
    console.log(
      `  updates — ${updates.indexed} updated, ${updates.skipped} unchanged`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
