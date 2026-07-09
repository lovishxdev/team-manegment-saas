/**
 * Seed sample discussions for manual agent / @euclis testing.
 *
 * Usage:
 *   npm run seed:discussions -- --list
 *   npm run seed:discussions -- --workspace-name Euclis
 *   npm run seed:discussions -- --workspace-id <uuid>
 *   npm run seed:discussions -- --workspace-name Euclis --reset
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { createWorkspaceDiscussionTag } from "../lib/services/discussion-tags";
import { createPost, createPostReply } from "../lib/services/post";

const SEED_TAG = "agent-demo-seed";

type SampleThread = {
  kind: "DISCUSSION" | "QUESTION" | "PROPOSAL" | "ANNOUNCEMENT";
  opener: string;
  replies?: string[];
};

const SAMPLE_THREADS: SampleThread[] = [
  {
    kind: "QUESTION",
    opener:
      "What files have we uploaded to this workspace? I want a quick inventory before the demo.",
    replies: [
      "We added a trimmed features PDF last week — not sure if anything else is in Assets.",
    ],
  },
  {
    kind: "DISCUSSION",
    opener:
      "Testing nested replies — use Branch to agent or @euclis on a child message to see threading.",
    replies: [
      "Parent reply — branch from here to ask about open tasks.",
      "Child reply nested under the first reply — good for testing nesting depth.",
    ],
  },
  {
    kind: "PROPOSAL",
    opener:
      "Proposal: ship discussion close/resolve + private agent branches this sprint. Objections?",
    replies: [
      "Supportive — private agent replies avoid noise for the rest of the team.",
    ],
  },
  {
    kind: "DISCUSSION",
    opener:
      "@euclis which tasks are still in progress? (Try posting this — agent should answer only for you.)",
  },
  {
    kind: "ANNOUNCEMENT",
    opener:
      "Reminder: agent replies from Branch to agent are private — only the person who asked sees them.",
  },
];

function parseArgs(argv: string[]) {
  let workspaceId: string | undefined;
  let workspaceName: string | undefined;
  let list = false;
  let reset = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--list") list = true;
    else if (arg === "--reset") reset = true;
    else if (arg === "--workspace-id") workspaceId = argv[++i];
    else if (arg === "--workspace-name") workspaceName = argv[++i];
  }

  return { workspaceId, workspaceName, list, reset };
}

async function listWorkspaces() {
  const rows = await prisma.workspace.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { posts: true } },
    },
  });
  if (rows.length === 0) {
    console.log("No workspaces found.");
    return;
  }
  console.log("Workspaces:\n");
  for (const row of rows) {
    console.log(`  ${row.name}`);
    console.log(`    id: ${row.id}`);
    console.log(`    discussions: ${row._count.posts}\n`);
  }
}

async function resolveWorkspace(workspaceId?: string, workspaceName?: string) {
  if (workspaceId) {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
    return ws;
  }
  if (workspaceName) {
    const ws = await prisma.workspace.findFirst({
      where: { name: { equals: workspaceName, mode: "insensitive" } },
    });
    if (!ws) {
      throw new Error(
        `Workspace "${workspaceName}" not found. Run with --list to see names.`
      );
    }
    return ws;
  }
  throw new Error("Pass --workspace-id or --workspace-name (or --list).");
}

async function pickAuthorUserId(workspaceId: string): Promise<string> {
  const leader = await prisma.workspaceMembership.findFirst({
    where: { workspaceId, role: "LEADER" },
    select: { userId: true },
  });
  if (leader) return leader.userId;

  const any = await prisma.workspaceMembership.findFirst({
    where: { workspaceId },
    select: { userId: true },
  });
  if (!any) throw new Error("Workspace has no members.");
  return any.userId;
}

async function deleteSeededPosts(workspaceId: string) {
  const posts = await prisma.post.findMany({
    where: { workspaceId, tags: { has: SEED_TAG } },
    select: { id: true },
  });
  if (posts.length === 0) {
    console.log("No seeded discussions to remove.");
    return;
  }
  await prisma.post.deleteMany({
    where: { id: { in: posts.map((p) => p.id) } },
  });
  console.log(`Removed ${posts.length} seeded discussion(s).`);
}

async function seedDiscussions(workspaceId: string, userId: string) {
  await createWorkspaceDiscussionTag(workspaceId, userId, "agent-demo-seed").catch(
    () => {}
  );

  const created: { id: string; kind: string; opener: string }[] = [];

  for (const sample of SAMPLE_THREADS) {
    const { postId, message } = await createPost({
      workspaceId,
      userId,
      body: sample.opener,
      kind: sample.kind,
      tags: [SEED_TAG],
    });

    let parentId = message.id;
    if (sample.replies?.length) {
      for (const [index, replyBody] of sample.replies.entries()) {
        const parentMessageId = index === 0 ? message.id : parentId;
        const reply = await createPostReply({
          workspaceId,
          userId,
          postId,
          body: replyBody,
          parentMessageId,
        });
        parentId = reply.id;
      }
    }

    created.push({ id: postId, kind: sample.kind, opener: sample.opener });
  }

  console.log(`\nSeeded ${created.length} discussions in workspace ${workspaceId}:\n`);
  for (const row of created) {
    console.log(`  [${row.kind}] ${row.opener.slice(0, 72)}…`);
    console.log(`    → /w/${workspaceId}/discussion/${row.id}\n`);
  }

  console.log("Try:");
  console.log("  • Open a thread → ⋯ → Branch to agent");
  console.log("  • Reply with @euclis <question>");
  console.log("  • Agent replies are private (only you see them)\n");
}

async function main() {
  const { workspaceId, workspaceName, list, reset } = parseArgs(
    process.argv.slice(2)
  );

  if (list) {
    await listWorkspaces();
    return;
  }

  const workspace = await resolveWorkspace(workspaceId, workspaceName);
  const userId = await pickAuthorUserId(workspace.id);

  if (reset) {
    await deleteSeededPosts(workspace.id);
    return;
  }

  await seedDiscussions(workspace.id, userId);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
