/**
 * Migrate legacy WorkspaceMessage rows into Post + opening PostMessage.
 *
 * Usage: npx tsx scripts/migrate-workspace-messages-to-posts.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

function resolveConnectionString(): string {
  const url =
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Set DIRECT_URL or DATABASE_URL in .env before running this script."
    );
  }
  return url;
}

const adapter = new PrismaPg({ connectionString: resolveConnectionString() });
const prisma = new PrismaClient({ adapter });

async function main() {
  const legacy = await prisma.workspaceMessage.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      mentions: true,
      saves: true,
    },
  });

  if (legacy.length === 0) {
    console.log("No WorkspaceMessage rows to migrate.");
    return;
  }

  let migrated = 0;
  for (const message of legacy) {
    const existing = await prisma.postMessage.findUnique({
      where: { id: message.id },
    });
    if (existing) {
      console.log(`Skip ${message.id} — already migrated`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.post.create({
        data: {
          id: message.id,
          workspaceId: message.workspaceId,
          authorId: message.authorId,
          title: null,
          replyCount: 0,
          lastActivityAt: message.createdAt,
          createdAt: message.createdAt,
          updatedAt: message.createdAt,
          messages: {
            create: {
              id: message.id,
              authorId: message.authorId,
              body: message.body,
              parentMessageId: null,
              createdAt: message.createdAt,
              ...(message.mentions.length > 0
                ? {
                    mentions: {
                      create: message.mentions.map((mention) => ({
                        userId: mention.userId,
                        createdAt: mention.createdAt,
                      })),
                    },
                  }
                : {}),
            },
          },
        },
      });

      for (const save of message.saves) {
        await tx.postMessageSave.create({
          data: {
            messageId: message.id,
            userId: save.userId,
            createdAt: save.createdAt,
          },
        });
      }
    });

    migrated++;
    console.log(`Migrated ${message.id}`);
  }

  console.log(`Done — migrated ${migrated} discussion(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
