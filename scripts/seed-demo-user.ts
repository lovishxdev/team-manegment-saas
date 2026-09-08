/**
 * Create (or reset) the demo login account used when DEMO_LOGIN=true.
 *
 * Usage:
 *   npm run seed:demo-user
 *
 * Credentials come from env (with safe defaults for local demos):
 *   DEMO_LOGIN_EMAIL=demo@euclis.dev
 *   DEMO_LOGIN_PASSWORD=DemoLogin123!
 *   DEMO_LOGIN_USERNAME=demo
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getSupabaseAdmin } from "../lib/supabase";
import { ensureDefaultWorkspace } from "../lib/services/workspace";

const EMAIL = (process.env.DEMO_LOGIN_EMAIL ?? "demo@euclis.dev").trim();
const PASSWORD = process.env.DEMO_LOGIN_PASSWORD ?? "DemoLogin123!";
const USERNAME = (process.env.DEMO_LOGIN_USERNAME ?? "demo").toLowerCase();

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  // Paginate lightly — demo seed is rare; avoid listing entire auth.users.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  if (PASSWORD.length < 8) {
    throw new Error("DEMO_LOGIN_PASSWORD must be at least 8 characters");
  }

  const admin = getSupabaseAdmin();
  let userId = await findAuthUserIdByEmail(EMAIL);

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: USERNAME },
    });
    if (error) throw error;
    console.log(`Updated existing auth user ${userId} (${EMAIL})`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: USERNAME },
    });
    if (error) throw error;
    if (!data.user) throw new Error("createUser returned no user");
    userId = data.user.id;
    console.log(`Created auth user ${userId} (${EMAIL})`);
  }

  const taken = await prisma.user.findFirst({
    where: { username: USERNAME, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) {
    throw new Error(
      `Username "${USERNAME}" is already taken by another user (${taken.id})`
    );
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: { email: EMAIL, username: USERNAME },
    create: { id: userId, email: EMAIL, username: USERNAME },
  });
  console.log(`Upserted Prisma user @${USERNAME}`);

  const workspace = await ensureDefaultWorkspace(userId);
  if (workspace) {
    console.log(`Created default workspace "${workspace.name}" (${workspace.id})`);
  } else {
    const membership = await prisma.workspaceMembership.findFirst({
      where: { userId },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" },
    });
    console.log(
      membership
        ? `Using existing workspace "${membership.workspace.name}" (${membership.workspace.id})`
        : "No workspace membership found"
    );
  }

  console.log("\nDemo account ready. Add to .env:");
  console.log(`DEMO_LOGIN="true"`);
  console.log(`DEMO_LOGIN_EMAIL="${EMAIL}"`);
  console.log(`DEMO_LOGIN_PASSWORD="${PASSWORD}"`);
  console.log(`DEMO_LOGIN_USERNAME="${USERNAME}"`);
  console.log("\nSeed a sample kanban next:");
  console.log("  npm run seed:demo-board");
  console.log("  npm run seed:demo-board -- --reset");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
