import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Runtime client uses the POOLED connection (PgBouncer, port 6543) via the
// pg driver adapter (Prisma 7 style). Migrations use DIRECT_URL -- see
// prisma.config.ts.
//
// Next.js hot-reload in dev re-evaluates modules; cache the client on
// globalThis so we don't exhaust the connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

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
  if (
    cached &&
    process.env.NODE_ENV !== "production" &&
    (!("whatsAppInboundDedup" in cached) ||
      !("whatsAppInboundQueue" in cached))
  ) {
    globalForPrisma.prisma = createClient();
  } else if (!cached) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma!;
}

export const prisma = getClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
