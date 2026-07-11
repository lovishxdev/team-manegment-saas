import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Runtime client uses the POOLED connection (PgBouncer, port 6543) via the
// pg driver adapter (Prisma 7 style). Migrations use DIRECT_URL -- see
// prisma.config.ts.
//
// Next.js hot-reload in dev re-evaluates modules; cache the client on
// globalThis so we don't exhaust the connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  /** Bump when a migration requires `npx prisma generate` + client refresh in dev. */
  prismaClientBuild?: string;
};

/** Keep in sync with the latest migration that changes the generated client. */
const PRISMA_CLIENT_BUILD = "20260711051727_memory_document_reviews";

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  // Next.js dev hot-reload re-evaluates modules but keeps globalThis.prisma
  // from before schema changes — recreate when expected delegates are missing.
  const cached = globalForPrisma.prisma;
  const staleBuild =
    process.env.NODE_ENV !== "production" &&
    globalForPrisma.prismaClientBuild !== PRISMA_CLIENT_BUILD;
  const missingDelegates =
    cached &&
    process.env.NODE_ENV !== "production" &&
    (!("whatsAppInboundDedup" in cached) ||
      !("whatsAppInboundQueue" in cached) ||
      !("memoryMetric" in cached) ||
      !("memoryDocument" in cached) ||
      !("memoryDocumentReview" in cached) ||
      !("workspaceDiscussionTag" in cached));

  if (!cached || staleBuild || missingDelegates) {
    globalForPrisma.prisma = createClient();
    globalForPrisma.prismaClientBuild = PRISMA_CLIENT_BUILD;
  }
  return globalForPrisma.prisma!;
}

export const prisma = getClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
