/**
 * One-shot backfill for users with a null username.
 * Run: npx tsx scripts/backfill-usernames.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { deriveInitialUsername } from "../lib/username";
import { allocateUniqueUsername } from "../lib/username-server";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const users = await prisma.$queryRaw<{ id: string; email: string | null }[]>`
    SELECT id, email FROM "User" WHERE username IS NULL
  `;

  if (users.length === 0) {
    console.log("No users need a username backfill.");
    return;
  }

  console.log(`Backfilling ${users.length} user(s)...`);

  for (const user of users) {
    const base = deriveInitialUsername({ email: user.email, userId: user.id });
    const username = await allocateUniqueUsername(base, user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { username },
    });
    console.log(`  ${user.email ?? user.id} -> @${username}`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
