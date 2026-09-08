/**
 * Seed a realistic kanban board for the DEMO_LOGIN user (UI/UX testing).
 *
 * Usage:
 *   npm run seed:demo-board
 *   npm run seed:demo-board -- --reset
 *
 * Resolves the demo account from DEMO_LOGIN_EMAIL (default demo@euclis.dev).
 */
import "dotenv/config";
import type {
  TaskPriority,
  TaskStatus,
} from "../lib/generated/prisma/client";
import { prisma } from "../lib/prisma";
import {
  ensureDefaultCategories,
} from "../lib/services/categories";
import { createWorkspaceDiscussionTag } from "../lib/services/discussion-tags";
import { createPost, createPostReply } from "../lib/services/post";

const EMAIL = (process.env.DEMO_LOGIN_EMAIL ?? "demo@euclis.dev").trim();
const SEED_TAG = "ui-demo-seed";
const WORKSPACE_NAME = "Demo Board";
const reset = process.argv.includes("--reset");

type SeedTask = {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  categorySlug: string;
  tags: string[];
  /** Days from today (negative = past / overdue). */
  dueInDays?: number | null;
  assign?: boolean;
  updates?: string[];
};

const TASKS: SeedTask[] = [
  {
    title: "Polish login card spacing",
    description: "Tighten vertical rhythm on /login so OAuth and email forms feel like one composition.",
    status: "DONE",
    priority: "MEDIUM",
    categorySlug: "design",
    tags: ["ui", "auth"],
    dueInDays: -5,
    assign: true,
    updates: ["Shipped spacing + divider tweaks.", "Looks good on mobile too."],
  },
  {
    title: "Empty-state illustration for Assets",
    description: "Replace the blank Assets tab with a calm empty state and one clear CTA.",
    status: "DONE",
    priority: "LOW",
    categorySlug: "design",
    tags: ["polish"],
    dueInDays: -10,
    assign: true,
  },
  {
    title: "Kanban column density pass",
    description: "Cards should show category, priority (when not medium), tags, and assignees without feeling cramped.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    categorySlug: "frontend",
    tags: ["ui", "board"],
    dueInDays: 2,
    assign: true,
    updates: [
      "Started card chip layout.",
      "BLOCKER — waiting on final priority color tokens.",
    ],
  },
  {
    title: "Board filter by category chips",
    description: "Tap Frontend / Backend / Design chips to filter the board without leaving the page.",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    categorySlug: "frontend",
    tags: ["ui", "filters"],
    dueInDays: 5,
    assign: true,
    updates: ["Prototype wired; need keyboard focus states."],
  },
  {
    title: "Hero CTA hierarchy on landing",
    description: "One primary CTA, one secondary — no pill cluster in the first viewport.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    categorySlug: "design",
    tags: ["marketing", "landing"],
    dueInDays: 1,
    assign: true,
  },
  {
    title: "Overdue due-date badge styling",
    description: "Past-due tasks that aren't DONE should read clearly as overdue on the card.",
    status: "TODO",
    priority: "HIGH",
    categorySlug: "frontend",
    tags: ["ui", "dates"],
    dueInDays: -2,
    assign: true,
  },
  {
    title: "Invite flow microcopy",
    description: "Rewrite invite email + in-app copy so roles (leader / member / guest) are obvious.",
    status: "TODO",
    priority: "MEDIUM",
    categorySlug: "design",
    tags: ["copy", "invites"],
    dueInDays: 7,
    assign: true,
  },
  {
    title: "Discussion reply threading polish",
    description: "Nested replies should indent cleanly and keep the Messages / Saved tabs readable.",
    status: "TODO",
    priority: "HIGH",
    categorySlug: "frontend",
    tags: ["discussions", "ux"],
    dueInDays: 3,
    assign: true,
  },
  {
    title: "WhatsApp menu label audit",
    description: "Check bot reply labels against the latest tool registry; no product jargon.",
    status: "TODO",
    priority: "LOW",
    categorySlug: "backend",
    tags: ["whatsapp"],
    dueInDays: null,
    assign: false,
  },
  {
    title: "MCP get_project_context docs",
    description: "Short guide for agents: when to call context vs recall_memory.",
    status: "TODO",
    priority: "MEDIUM",
    categorySlug: "general",
    tags: ["mcp", "docs"],
    dueInDays: 10,
    assign: true,
  },
  {
    title: "Memory tab insight cards",
    description: "Validate Dreaming stats layout on a Team workspace — capture, blockers, topics.",
    status: "TODO",
    priority: "MEDIUM",
    categorySlug: "backend",
    tags: ["memory"],
    dueInDays: 14,
    assign: true,
  },
  {
    title: "Mobile board swipe between columns",
    description: "Optional nicety: horizontal swipe to move between To-dos / In progress / Done on small screens.",
    status: "TODO",
    priority: "LOW",
    categorySlug: "frontend",
    tags: ["mobile", "ux"],
    dueInDays: 21,
    assign: false,
  },
];

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
    select: { id: true, email: true, username: true },
  });
  if (!user) {
    throw new Error(
      `Demo user not found (${EMAIL}). Run: npm run seed:demo-user`
    );
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) {
    throw new Error("Demo user has no workspace. Run: npm run seed:demo-user");
  }

  const workspaceId = membership.workspaceId;
  console.log(
    `Seeding board for @${user.username} → "${membership.workspace.name}" (${workspaceId})`
  );

  if (membership.workspace.name !== WORKSPACE_NAME) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: WORKSPACE_NAME },
    });
    console.log(`Renamed workspace → "${WORKSPACE_NAME}"`);
  }

  await ensureDefaultCategories(workspaceId);
  const categories = await prisma.workspaceCategory.findMany({
    where: { workspaceId },
    select: { id: true, slug: true },
  });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  const existingCount = await prisma.task.count({ where: { workspaceId } });
  if (existingCount > 0 && !reset) {
    console.log(
      `Workspace already has ${existingCount} tasks. Re-run with --reset to replace.`
    );
    return;
  }

  if (reset) {
    // Posts referencing tasks must go first (restrict / cascade depending on schema).
    await prisma.post.deleteMany({ where: { workspaceId } });
    await prisma.taskUpdate.deleteMany({ where: { workspaceId } });
    await prisma.task.deleteMany({ where: { workspaceId } });
    console.log("Cleared existing tasks, updates, and posts");
  }

  for (const tag of [SEED_TAG, "ui", "mvp"]) {
    await createWorkspaceDiscussionTag(workspaceId, user.id, tag).catch(
      () => undefined
    );
  }

  let shortId = 0;
  const createdIds: { shortId: number; id: string; title: string }[] = [];

  for (const t of TASKS) {
    const categoryId = categoryBySlug.get(t.categorySlug);
    if (!categoryId) {
      throw new Error(`Missing category slug: ${t.categorySlug}`);
    }
    shortId += 1;
    const dueDate =
      t.dueInDays === undefined || t.dueInDays === null
        ? null
        : daysFromNow(t.dueInDays);

    const created = await prisma.task.create({
      data: {
        workspaceId,
        shortId,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        tags: t.tags,
        categoryId,
        dueDate,
        createdById: user.id,
        ...(t.assign
          ? { assignees: { create: [{ userId: user.id }] } }
          : {}),
      },
      select: { id: true, shortId: true, title: true },
    });
    createdIds.push(created);

    for (const body of t.updates ?? []) {
      await prisma.taskUpdate.create({
        data: {
          workspaceId,
          taskId: created.id,
          authorId: user.id,
          body,
        },
      });
    }
  }

  const threading = createdIds.find((t) =>
    t.title.includes("Discussion reply threading")
  );
  const kanban = createdIds.find((t) =>
    t.title.includes("Kanban column density")
  );

  if (threading) {
    const post = await createPost({
      workspaceId,
      userId: user.id,
      kind: "QUESTION",
      tags: [SEED_TAG, "ui"],
      taskShortId: threading.shortId,
      title: "How deep should reply nesting go?",
      body: "For the demo board, should we cap nested replies at 2 levels or allow full trees? Prefer whatever keeps the Messages tab scannable.",
    });
    await createPostReply({
      workspaceId,
      userId: user.id,
      postId: post.postId,
      parentMessageId: post.message.id,
      body: "Proposal: soft-cap at 2 levels in the UI, store full trees in the DB for export later.",
    });
  }

  if (kanban) {
    await createPost({
      workspaceId,
      userId: user.id,
      kind: "DISCUSSION",
      tags: [SEED_TAG, "mvp"],
      taskShortId: kanban.shortId,
      title: "Card chrome checklist",
      body: "Before we call the board done: category chip, non-medium priority, ≤3 tags, assignee stack, overdue date. Anything else for the first viewport of a column?",
    });
  }

  const byStatus = TASKS.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(
    `Created ${createdIds.length} tasks → TODO=${byStatus.TODO ?? 0}, IN_PROGRESS=${byStatus.IN_PROGRESS ?? 0}, DONE=${byStatus.DONE ?? 0}`
  );
  console.log("Discussions seeded. Open /dashboard (DEMO_LOGIN=true) to review.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
