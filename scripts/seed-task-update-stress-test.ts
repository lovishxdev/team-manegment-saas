/**
 * Seed a task thread with ~20 narrative updates for RAG / ask_task stress testing.
 *
 * Usage:
 *   npm run seed:task-updates -- --list
 *   npm run seed:task-updates -- --workspace-id <uuid> --task-short-id 20
 *   npm run seed:task-updates -- --workspace-id <uuid> --task-short-id 20 --verify
 *   npm run seed:task-updates -- --workspace-id <uuid> --create-task
 *   npm run seed:task-updates -- --workspace-id <uuid> --task-short-id 20 --reset
 *
 * After seeding, index embeddings (if API key set):
 *   npm run backfill:task-embeddings <workspaceId> -- --updates-only
 */
import "dotenv/config";
import { buildTaskContextPack } from "../lib/retrieval/task-context";
import { indexTaskUpdateEmbedding } from "../lib/retrieval/update-index";
import { embeddingsEnabled } from "../lib/retrieval/embeddings";
import { prisma } from "../lib/prisma";

const STRESS_UPDATES: { body: string; dayOffset: number }[] = [
  {
    dayOffset: 0,
    body: "KICKOFF — Mobile app launch approved. Initial budget: $50,000. Target ship date: March 15. Codename: Project Northstar.",
  },
  {
    dayOffset: 1,
    body: "Design sprint scheduled with agency BrightPixel for March 1–7.",
  },
  {
    dayOffset: 2,
    body: "BrightPixel wireframes v1 delivered. Client wants dark mode — not in original scope.",
  },
  {
    dayOffset: 3,
    body: "BLOCKER — Payment vendor Acme Corp API docs not shared. Integration cannot start.",
  },
  {
    dayOffset: 4,
    body: "Acme rep promised docs by Feb 18. Holding integration work until then.",
  },
  {
    dayOffset: 5,
    body: "Feb 19 — Acme docs still missing. Escalated to VP Sales (Jamie Liu at Acme).",
  },
  {
    dayOffset: 6,
    body: "Decision: pivot to backup vendor BetaCorp. Sandbox is live. Acme dropped from project.",
  },
  {
    dayOffset: 7,
    body: "Budget revision approved: $58,000 (+$8k for dark mode + BetaCorp migration).",
  },
  {
    dayOffset: 8,
    body: "Priya assigned as lead developer. Marcus on QA.",
  },
  {
    dayOffset: 9,
    body: "BetaCorp sandbox integration 40% done. OAuth flow working.",
  },
  {
    dayOffset: 10,
    body: "Client approved wireframes v2 with dark mode. Design sign-off complete.",
  },
  {
    dayOffset: 11,
    body: "BLOCKER — Apple Developer certificate expires in 5 days. Need org admin renewal.",
  },
  {
    dayOffset: 12,
    body: "Certificate renewed. App Store Connect access restored.",
  },
  {
    dayOffset: 13,
    body: "Ship date pushed to April 2 (was March 15). Reason: vendor switch + dark mode scope.",
  },
  {
    dayOffset: 14,
    body: "BetaCorp production keys received. Integration now at 85%.",
  },
  {
    dayOffset: 15,
    body: "QA found P0 bug: checkout crashes on iOS 17.2. Must fix before submission.",
  },
  {
    dayOffset: 16,
    body: "Checkout bug fixed in build 0.9.4. Marcus running full regression suite.",
  },
  {
    dayOffset: 17,
    body: "Regression passed. BetaCorp integration complete — 100%.",
  },
  {
    dayOffset: 18,
    body: "App Store metadata submitted. Final budget actual: $62,400 (legal review fee added).",
  },
  {
    dayOffset: 19,
    body: "STATUS SNAPSHOT — Vendor: BetaCorp (NOT Acme). Deadline: April 2. Budget: $62,400. Lead: Priya. Next: App Store review (ETA 3–5 days). No open blockers.",
  },
];

const VERIFY_QUERIES: { query: string; expectInContext: string[] }[] = [
  {
    query: "What is the current budget?",
    expectInContext: ["62400", "62,400", "$62"],
  },
  {
    query: "What happened with Acme vendor?",
    expectInContext: ["BetaCorp", "Acme", "pivot"],
  },
  {
    query: "When is the ship date or deadline?",
    expectInContext: ["April 2", "Apr"],
  },
  {
    query: "Who is the lead developer?",
    expectInContext: ["Priya"],
  },
  {
    query: "Are there any open blockers right now?",
    expectInContext: ["No open blockers", "App Store review"],
  },
  {
    query: "What was the original budget at kickoff?",
    expectInContext: ["50,000", "50000", "$50"],
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    list: args.includes("--list"),
    verify: args.includes("--verify"),
    reset: args.includes("--reset"),
    createTask: args.includes("--create-task"),
    dryRun: args.includes("--dry-run"),
    workspaceId: get("--workspace-id")?.trim(),
    taskShortId: get("--task-short-id")
      ? Number(get("--task-short-id"))
      : undefined,
    count: get("--count") ? Number(get("--count")) : STRESS_UPDATES.length,
  };
}

async function listWorkspaces() {
  const rows = await prisma.workspace.findMany({
    select: {
      id: true,
      name: true,
      tasks: {
        select: {
          id: true,
          shortId: true,
          title: true,
          _count: { select: { updates: true } },
        },
        orderBy: { shortId: "asc" },
        take: 15,
      },
      memberships: {
        take: 1,
        select: { userId: true, user: { select: { username: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) {
    console.log("No workspaces found.");
    return;
  }

  for (const ws of rows) {
    console.log(`\nWorkspace: ${ws.name}`);
    console.log(`  id: ${ws.id}`);
    const actorId = ws.memberships[0]?.userId;
    const actor = ws.memberships[0]?.user.username ?? "unknown";
    console.log(`  actor: @${actor} (${actorId})`);
    if (ws.tasks.length === 0) {
      console.log("  (no tasks)");
      continue;
    }
    for (const t of ws.tasks) {
      console.log(
        `  #${t.shortId} — ${t.title} (${t._count.updates} updates)`
      );
    }
  }
  console.log(
    "\nRun: npm run seed:task-updates -- --workspace-id <id> --task-short-id <n>"
  );
}

async function resolveTask(
  workspaceId: string,
  taskShortId: number | undefined,
  createTask: boolean
) {
  if (createTask) {
    const membership = await prisma.workspaceMembership.findFirst({
      where: { workspaceId },
      select: { userId: true },
    });
    if (!membership) {
      throw new Error("Workspace has no members.");
    }
    const category = await prisma.workspaceCategory.findFirst({
      where: { workspaceId },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Workspace has no categories.");
    }
    const maxShort = await prisma.task.aggregate({
      where: { workspaceId },
      _max: { shortId: true },
    });
    const shortId = (maxShort._max.shortId ?? 0) + 1;
    const task = await prisma.task.create({
      data: {
        workspaceId,
        shortId,
        title: "Mobile App Launch [Stress Test]",
        description:
          "Stress-test task for update thread / RAG context. Codename: Project Northstar.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        categoryId: category.id,
        createdById: membership.userId,
      },
      select: { id: true, shortId: true, title: true },
    });
    console.log(`Created task #${task.shortId}: ${task.title}`);
    return task;
  }

  if (taskShortId !== undefined) {
    const task = await prisma.task.findFirst({
      where: { workspaceId, shortId: taskShortId },
      select: { id: true, shortId: true, title: true },
    });
    if (!task) {
      throw new Error(`Task #${taskShortId} not found in workspace.`);
    }
    return task;
  }

  const preferred = await prisma.task.findFirst({
    where: { workspaceId, shortId: 20 },
    select: { id: true, shortId: true, title: true },
  });
  if (preferred) return preferred;

  const fallback = await prisma.task.findFirst({
    where: { workspaceId },
    orderBy: { shortId: "asc" },
    select: { id: true, shortId: true, title: true },
  });
  if (!fallback) {
    throw new Error("No tasks in workspace. Use --create-task.");
  }
  console.log(
    `No task #20 found — using #${fallback.shortId}: ${fallback.title}`
  );
  return fallback;
}

async function seedUpdates(input: {
  workspaceId: string;
  userId: string;
  shortId: number;
  count: number;
  reset: boolean;
  dryRun: boolean;
}) {
  const task = await prisma.task.findFirst({
    where: { workspaceId: input.workspaceId, shortId: input.shortId },
    select: { id: true, shortId: true, title: true },
  });
  if (!task) throw new Error(`Task #${input.shortId} not found.`);

  const existing = await prisma.taskUpdate.count({
    where: { taskId: task.id },
  });

  if (input.reset && existing > 0) {
    if (input.dryRun) {
      console.log(`[dry-run] Would delete ${existing} existing updates.`);
    } else {
      await prisma.taskUpdateEmbedding.deleteMany({
        where: { taskId: task.id },
      });
      await prisma.taskUpdate.deleteMany({ where: { taskId: task.id } });
      console.log(`Removed ${existing} existing updates on #${task.shortId}.`);
    }
  }

  const updates = STRESS_UPDATES.slice(0, input.count);
  const baseTime = Date.now() - updates.length * 24 * 60 * 60 * 1000;
  const createdIds: string[] = [];

  console.log(
    `\nSeeding ${updates.length} updates on #${task.shortId} "${task.title}"…\n`
  );

  for (let i = 0; i < updates.length; i++) {
    const { body, dayOffset } = updates[i];
    const createdAt = new Date(baseTime + dayOffset * 24 * 60 * 60 * 1000);

    if (input.dryRun) {
      console.log(`  [${i + 1}] ${createdAt.toISOString().slice(0, 10)} — ${body.slice(0, 72)}…`);
      continue;
    }

    const row = await prisma.taskUpdate.create({
      data: {
        workspaceId: input.workspaceId,
        taskId: task.id,
        authorId: input.userId,
        body,
        createdAt,
      },
      select: { id: true },
    });
    createdIds.push(row.id);
    console.log(`  [${i + 1}/${updates.length}] ${body.slice(0, 80)}…`);

    if (embeddingsEnabled()) {
      await indexTaskUpdateEmbedding(row.id);
    }
  }

  if (!input.dryRun) {
    const total = await prisma.taskUpdate.count({
      where: { taskId: task.id },
    });
    console.log(`\nDone. Task #${task.shortId} now has ${total} updates.`);
  }

  return { taskId: task.id, taskShortId: task.shortId, createdIds };
}

async function runVerification(
  workspaceId: string,
  userId: string,
  shortId: number
) {
  console.log("\n--- Context verification (ask_task / RAG) ---\n");

  let passed = 0;
  let failed = 0;

  for (const { query, expectInContext } of VERIFY_QUERIES) {
    const result = await buildTaskContextPack({
      workspaceId,
      userId,
      query,
      shortId,
    });

    if (!result.ok) {
      console.log(`✗ "${query}"\n  → ${result.message}`);
      failed++;
      continue;
    }

    const contextText = [
      result.pack.task.title,
      ...result.pack.relevantUpdates.map((u) => u.body),
    ].join("\n");

    const hits = expectInContext.filter((snippet) =>
      contextText.toLowerCase().includes(snippet.toLowerCase()) ||
      contextText.includes(snippet)
    );
    const contextHit = hits.length > 0;
    const relevantBodies = result.pack.relevantUpdates.map((u) => u.body);
    const totalUpdates = result.pack.task.totalUpdates;
    const relevantCount = result.pack.relevantUpdates.length;

    const ok = contextHit || relevantBodies.some((b) =>
      expectInContext.some((snippet) =>
        b.toLowerCase().includes(snippet.toLowerCase()) || b.includes(snippet)
      )
    );

    const marker = ok ? "✓" : "✗";
    if (ok) passed++;
    else failed++;

    console.log(`${marker} Query: "${query}"`);
    console.log(`  Total on task: ${totalUpdates} | In context: ${relevantCount}`);
    if (relevantCount > 0) {
      for (const u of result.pack.relevantUpdates) {
        console.log(`    · ${u.body.slice(0, 90)}…`);
      }
    } else {
      console.log("    (no relevant updates in pack)");
    }
    console.log(`  Expected one of: ${expectInContext.join(", ")}`);
    console.log("");
  }

  console.log(`Results: ${passed}/${VERIFY_QUERIES.length} passed, ${failed} failed`);
  if (!embeddingsEnabled()) {
    console.log(
      "\nNote: OPENROUTER_API_KEY / OPENAI_API_KEY not set — RAG uses keyword fallback only."
    );
  }
}

async function main() {
  const opts = parseArgs();

  if (opts.list) {
    await listWorkspaces();
    return;
  }

  if (!opts.workspaceId) {
    console.error(
      "Provide --workspace-id. Run with --list to see workspaces and tasks."
    );
    process.exit(1);
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: { workspaceId: opts.workspaceId },
    orderBy: { joinedAt: "asc" },
    select: { userId: true, user: { select: { username: true } } },
  });
  if (!membership) {
    throw new Error("No member found for workspace.");
  }

  const task = await resolveTask(
    opts.workspaceId,
    opts.taskShortId,
    opts.createTask
  );

  await seedUpdates({
    workspaceId: opts.workspaceId,
    userId: membership.userId,
    shortId: task.shortId,
    count: opts.count,
    reset: opts.reset,
    dryRun: opts.dryRun,
  });

  if (opts.verify && !opts.dryRun) {
    await runVerification(opts.workspaceId, membership.userId, task.shortId);
  }

  if (!opts.dryRun) {
    console.log("\n--- WhatsApp / bot test prompts ---");
    console.log(
      `Use task #${task.shortId} or describe "Mobile app launch / Northstar":`
    );
    console.log("");
    for (const { query } of VERIFY_QUERIES) {
      console.log(`  • "${query}"`);
    }
    console.log(`  • "What's the current status on #${task.shortId}?"`);
    console.log(`  • "Summarize the vendor situation on #${task.shortId}"`);
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
