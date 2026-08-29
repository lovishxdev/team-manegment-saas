/**
 * Seed yc@euclis.dev's workspace with TripSplit demo data (clone of the
 * real TripSplit board) + lovish/shubham members + sample discussions.
 *
 * Usage:
 *   npx tsx scripts/seed-yc-tripsplit.ts
 *   npx tsx scripts/seed-yc-tripsplit.ts --reset
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  ensureDefaultCategories,
  getGeneralCategoryId,
} from "../lib/services/categories";
import { createPost, createPostReply } from "../lib/services/post";
import { createWorkspaceDiscussionTag } from "../lib/services/discussion-tags";

const YC_EMAIL = "yc@euclis.dev";
const LOVISH_EMAIL = "meghwanshilovish@gmail.com";
const SHUBHAM_EMAIL = "lovishwebdev@gmail.com";
const SEED_TAG = "yc-demo-seed";
const SOURCE_TRIPSPLIT_ID = "c9ca9b65-a8fe-4dcb-bcde-3655462985db";

const reset = process.argv.includes("--reset");

async function requireUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, username: true },
  });
  if (!user) throw new Error(`User not found: ${email}`);
  return user;
}

async function main() {
  const yc = await requireUser(YC_EMAIL);
  const lovish = await requireUser(LOVISH_EMAIL);
  const shubham = await requireUser(SHUBHAM_EMAIL);

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: yc.id, role: "LEADER" },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) {
    throw new Error(`${YC_EMAIL} has no led workspace to seed`);
  }

  const workspaceId = membership.workspaceId;
  console.log(
    `Seeding workspace ${workspaceId} (${membership.workspace.name}) for @${yc.username}`
  );

  if (reset) {
    await prisma.post.deleteMany({
      where: { workspaceId, tags: { has: SEED_TAG } },
    });
    await prisma.memoryEvent.deleteMany({ where: { workspaceId } });
    await prisma.taskAssignee.deleteMany({
      where: { task: { workspaceId } },
    });
    await prisma.task.deleteMany({ where: { workspaceId } });
    console.log("Reset: cleared tasks, memory, seeded discussions");
  }

  // Rename empty default workspace → TripSplit
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name: "TripSplit",
      // Team so reviewers aren't capped while poking around
      planTier: "TEAM",
      planSource: "admin",
    },
  });

  // Members: yc LEADER (already), lovish + shubham
  await prisma.workspaceMembership.upsert({
    where: {
      userId_workspaceId: { userId: lovish.id, workspaceId },
    },
    create: { userId: lovish.id, workspaceId, role: "SUB_LEADER" },
    update: { role: "SUB_LEADER" },
  });
  await prisma.workspaceMembership.upsert({
    where: {
      userId_workspaceId: { userId: shubham.id, workspaceId },
    },
    create: { userId: shubham.id, workspaceId, role: "MEMBER" },
    update: { role: "MEMBER" },
  });

  await prisma.user.update({
    where: { id: yc.id },
    data: { lastActiveWorkspaceId: workspaceId },
  });

  await ensureDefaultCategories(workspaceId);
  const generalCategoryId = await getGeneralCategoryId(workspaceId);

  const existingTasks = await prisma.task.count({ where: { workspaceId } });
  const taskByShortId = new Map<number, string>();

  if (existingTasks === 0 || reset) {
    const sourceTasks = await prisma.task.findMany({
      where: { workspaceId: SOURCE_TRIPSPLIT_ID },
      orderBy: { shortId: "asc" },
      include: {
        assignees: { include: { user: { select: { username: true } } } },
      },
    });

    for (const t of sourceTasks) {
      const created = await prisma.task.create({
        data: {
          workspaceId,
          shortId: t.shortId,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          tags: t.tags,
          categoryId: generalCategoryId,
          createdById: yc.id,
        },
        select: { id: true, shortId: true },
      });
      taskByShortId.set(created.shortId, created.id);

      const assigneeIds = new Set<string>();
      for (const a of t.assignees) {
        if (a.user.username === "lovish") assigneeIds.add(lovish.id);
        else if (a.user.username === "shubham") assigneeIds.add(shubham.id);
        else assigneeIds.add(yc.id);
      }
      if (assigneeIds.size === 0) assigneeIds.add(lovish.id);

      await prisma.taskAssignee.createMany({
        data: [...assigneeIds].map((userId) => ({
          taskId: created.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
    console.log(`Created ${sourceTasks.length} tasks from TripSplit`);
  } else {
    const tasks = await prisma.task.findMany({
      where: { workspaceId },
      select: { id: true, shortId: true },
    });
    for (const t of tasks) taskByShortId.set(t.shortId, t.id);
    console.log(`Kept ${tasks.length} existing tasks`);
  }

  const existingMemory = await prisma.memoryEvent.count({
    where: { workspaceId },
  });
  if (existingMemory === 0 || reset) {
    const sourceMemory = await prisma.memoryEvent.findMany({
      where: { workspaceId: SOURCE_TRIPSPLIT_ID },
      orderBy: { createdAt: "asc" },
      include: { task: { select: { shortId: true } } },
    });

    for (const m of sourceMemory) {
      const taskId =
        m.task?.shortId != null
          ? (taskByShortId.get(m.task.shortId) ?? null)
          : null;
      await prisma.memoryEvent.create({
        data: {
          workspaceId,
          taskId,
          kind: m.kind,
          status: m.status,
          summary: m.summary,
          reasoning: m.reasoning,
          tags: m.tags,
          importance: m.importance,
          retentionTier: m.retentionTier,
          captureSource: "EXPLICIT",
          authorId: yc.id,
          resolvedAt: m.resolvedAt ?? (m.status === "RESOLVED" ? new Date() : null),
        },
      });
    }
    console.log(`Created ${sourceMemory.length} memory events from TripSplit`);
  } else {
    console.log(`Kept ${existingMemory} existing memory events`);
  }

  // Discussions — tags must exist before createPost accepts them
  for (const tag of [SEED_TAG, "mvp", "balances"]) {
    await createWorkspaceDiscussionTag(workspaceId, yc.id, tag).catch(() => {});
  }

  const existingSeedPosts = await prisma.post.count({
    where: { workspaceId, tags: { has: SEED_TAG } },
  });

  if (existingSeedPosts === 0 || reset) {
    if (reset && existingSeedPosts > 0) {
      // already deleted above
    }

    // 1 — Decision discussion
    const d1 = await createPost({
      workspaceId,
      userId: lovish.id,
      kind: "DISCUSSION",
      tags: [SEED_TAG, "mvp"],
      body: "Decision for v1: equal-split only. Custom splits can wait until after we ship balances. Objections?",
      taskShortId: 3,
    });
    await createPostReply({
      workspaceId,
      userId: shubham.id,
      postId: d1.postId,
      body: "Agreed — equal-split covers the demo. Let's keep custom split out of the MVP.",
      parentMessageId: d1.message.id,
    });
    await createPostReply({
      workspaceId,
      userId: yc.id,
      postId: d1.postId,
      body: "Locked. Memory should capture this so agents stop re-asking about custom splits.",
      parentMessageId: d1.message.id,
    });

    // 2 — Rounding / balances question
    const d2 = await createPost({
      workspaceId,
      userId: shubham.id,
      kind: "QUESTION",
      tags: [SEED_TAG, "balances"],
      body: "₹100 split 3 ways left ₹0.01 unassigned in the UI. How should we assign the leftover penny?",
      taskShortId: 2,
    });
    await createPostReply({
      workspaceId,
      userId: lovish.id,
      postId: d2.postId,
      body: "Use integer cents + assign remainder pennies in member order so shares always sum to the full amount.",
      parentMessageId: d2.message.id,
    });
    await createPostReply({
      workspaceId,
      userId: yc.id,
      postId: d2.postId,
      body: "That matches what we recorded in project memory — balances task can stay DONE.",
      parentMessageId: d2.message.id,
    });

    // 3 — Currency proposal / announcement
    const d3 = await createPost({
      workspaceId,
      userId: lovish.id,
      kind: "PROPOSAL",
      tags: [SEED_TAG],
      body: "Proposal: unblock currency with Frankfurter (free ECB rates, no API key) instead of waiting on a paid FX key. Ship convertAmount for the demo.",
      taskShortId: 4,
    });
    await createPostReply({
      workspaceId,
      userId: shubham.id,
      postId: d3.postId,
      body: "Works for me — no secrets in .env, and it clears the open currency blockers.",
      parentMessageId: d3.message.id,
    });

    console.log("Created 3 discussions with replies");
  } else {
    console.log(`Kept ${existingSeedPosts} seeded discussions`);
  }

  const summary = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      memberships: {
        include: { user: { select: { email: true, username: true } } },
      },
      _count: { select: { tasks: true, posts: true, memoryEvents: true } },
    },
  });

  console.log("\nDone. YC login yc@euclis.dev should open TripSplit with:");
  console.log(
    JSON.stringify(
      {
        workspaceId,
        name: summary?.name,
        planTier: summary?.planTier,
        members: summary?.memberships.map((m) => ({
          username: m.user.username,
          email: m.user.email,
          role: m.role,
        })),
        counts: summary?._count,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
