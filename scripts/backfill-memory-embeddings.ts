import "dotenv/config";
import { embeddingsEnabled } from "@/lib/retrieval/embeddings";
import {
  indexMemoryEventEmbedding,
  listUnindexedMemoryEventPage,
} from "@/lib/services/memory";
import { prisma } from "@/lib/prisma";

async function main() {
  if (!embeddingsEnabled()) {
    throw new Error(
      "Set OPENROUTER_API_KEY or OPENAI_API_KEY before backfilling embeddings."
    );
  }
  const pageSize = 50;
  let cursor: string | undefined;
  let indexed = 0;

  do {
    const page = await listUnindexedMemoryEventPage({ cursor, pageSize });
    for (let offset = 0; offset < page.ids.length; offset += 5) {
      await Promise.all(
        page.ids
          .slice(offset, offset + 5)
          .map((id) => indexMemoryEventEmbedding(id))
      );
      indexed += Math.min(5, page.ids.length - offset);
    }
    console.log(`Indexed ${indexed} memory events...`);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  console.log(`Memory embedding backfill complete (${indexed} events).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
