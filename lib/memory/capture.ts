import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-env";
import { prisma } from "@/lib/prisma";
import {
  createMemoryEvent,
  type MemoryEventRow,
} from "@/lib/services/memory";
import { notifyBlockerDetected } from "@/lib/whatsapp-notify";
import { workspaceFeature } from "@/lib/billing/entitlements";
import { suggestBlockerResolution } from "@/lib/memory/suggest";
import { scheduleBackgroundTask } from "@/lib/background-task";
import { postThreadTitle } from "@/lib/post-title";
import { bumpMemoryMetric } from "@/lib/memory/metrics";

/**
 * Quiet, after-the-fact memory capture from task updates and discussion
 * messages. One cheap classifier call per signal; never blocks posting.
 */

const CAPTURE_MODEL =
  process.env.MEMORY_CAPTURE_MODEL?.trim() || "claude-haiku-4-5";

export function memoryCaptureEnabled(): boolean {
  if (process.env.MEMORY_CAPTURE === "0") return false;
  return Boolean(getAnthropicApiKey());
}

export type CaptureAnalysis = {
  outcome: "none" | "new_event" | "likely_resolves" | "supersedes_decision";
  kind?: "DECISION" | "BLOCKER" | "DEPENDENCY" | "MILESTONE";
  summary?: string;
  reasoning?: string;
  tags?: string[];
  target_event_id?: string;
};

export const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "record_memory_analysis",
  description:
    "Record your classification of the team message. Always call this exactly once.",
  input_schema: {
    type: "object",
    properties: {
      outcome: {
        type: "string",
        enum: ["none", "new_event", "likely_resolves", "supersedes_decision"],
        description:
          "none = routine chatter, nothing worth remembering (most messages). " +
          "new_event = a decision, blocker, dependency, or milestone worth recording. " +
          "likely_resolves = the message suggests an existing OPEN blocker/dependency is now cleared. " +
          "supersedes_decision = a new decision that replaces/contradicts a recorded decision.",
      },
      kind: {
        type: "string",
        enum: ["DECISION", "BLOCKER", "DEPENDENCY", "MILESTONE"],
        description:
          "Required for new_event and supersedes_decision (supersedes is always DECISION).",
      },
      summary: {
        type: "string",
        description:
          "One line, third person: WHAT happened. Required unless outcome=none or likely_resolves.",
      },
      reasoning: {
        type: "string",
        description: "WHY — rationale a future teammate would need.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "1-4 short lowercase topic tags.",
      },
      target_event_id: {
        type: "string",
        description:
          "The id of the existing event being resolved or replaced.",
      },
    },
    required: ["outcome"],
  },
};

const TASK_SYSTEM_PROMPT = `You classify one team task update into structured "project memory".

Be conservative: most updates are routine chatter — outcome "none". Only record moments a teammate joining in six months would need:
- BLOCKER: work cannot proceed.
- DEPENDENCY: work depends on another piece or external party.
- DECISION: a choice was made between alternatives.
- MILESTONE: something significant shipped/completed/launched.

If the update says previously-blocked work is now unblocked and it plausibly matches one of the listed OPEN events, use "likely_resolves" with that event's id.
If it announces a decision that contradicts a listed recorded decision, use "supersedes_decision".
If an OPEN event listed below already covers the same blocker/dependency, do NOT record a duplicate.

Write summaries in third person, self-contained (name the thing — not "this task").`;

const POST_SYSTEM_PROMPT = `You classify one team discussion message into structured "project memory".

Be conservative: most messages are routine chatter — outcome "none". Only record moments a teammate joining in six months would need:
- BLOCKER: work cannot proceed.
- DEPENDENCY: work depends on another piece or external party.
- DECISION: a choice was made between alternatives.
- MILESTONE: something significant shipped/completed/launched.

Thread context is provided — a short reply like "let's go with X" may only be memory-worthy in light of the parent message.

If the message says previously-blocked work is now unblocked and it plausibly matches one of the listed OPEN events, use "likely_resolves".
If it contradicts a listed recorded decision, use "supersedes_decision".
Do NOT record duplicates of existing OPEN events.

Write summaries in third person, self-contained.`;

const POST_CLOSE_SYSTEM_PROMPT = `You classify a closed team discussion thread into structured "project memory".

The thread was marked resolved/closed — treat the full transcript as the signal.
Closing a QUESTION or PROPOSAL often means a decision was reached or a question was answered.
If the thread contains a clear, durable decision worth recording for future teammates, use outcome "new_event" with kind DECISION.
If the message says previously-blocked work is now unblocked and it plausibly matches one of the listed OPEN events, use "likely_resolves".
If it contradicts a listed recorded decision, use "supersedes_decision".
Be conservative: routine Q&A with no lasting decision → outcome "none".
Do NOT record duplicates of existing OPEN events.

Write summaries in third person, self-contained.`;

function formatExistingEvents(events: MemoryEventRow[]): string {
  if (events.length === 0) return "(none)";
  return events
    .map(
      (e) =>
        `- id=${e.id} [${e.kind}${e.status === "OPEN" ? ", OPEN" : ""}] ${e.summary}${e.tags.length > 0 ? ` (tags: ${e.tags.join(", ")})` : ""}`
    )
    .join("\n");
}

async function analyzeSignal(input: {
  systemPrompt: string;
  userContent: string;
}): Promise<CaptureAnalysis | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  const res = await anthropic.messages.create({
    model: CAPTURE_MODEL,
    max_tokens: 700,
    system: input.systemPrompt,
    messages: [{ role: "user", content: input.userContent }],
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "record_memory_analysis" },
  });

  const toolUse = res.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return null;
  return toolUse.input as CaptureAnalysis;
}

const memoryEventSelect = {
  id: true,
  kind: true,
  status: true,
  summary: true,
  reasoning: true,
  tags: true,
  createdAt: true,
  resolvedAt: true,
  supersededByEventId: true,
  dreamedAt: true,
  sourceDocumentPath: true,
  sourceDocumentHash: true,
  author: { select: { id: true, username: true, email: true } },
  task: { select: { shortId: true, title: true } },
} as const;

async function loadExistingEventsForCapture(input: {
  workspaceId: string;
  taskId?: string | null;
}): Promise<MemoryEventRow[]> {
  const recentDecisionCutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000);

  if (input.taskId) {
    return prisma.memoryEvent.findMany({
      where: {
        taskId: input.taskId,
        supersededByEventId: null,
        archivedAt: null,
        OR: [
          { status: "OPEN" },
          { kind: "DECISION", createdAt: { gte: recentDecisionCutoff } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: memoryEventSelect,
    });
  }

  return prisma.memoryEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      taskId: null,
      supersededByEventId: null,
      archivedAt: null,
      OR: [
        { status: "OPEN" },
        { kind: "DECISION", createdAt: { gte: recentDecisionCutoff } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: memoryEventSelect,
  });
}

type CaptureApplyContext = {
  mode: CaptureMode;
  workspaceId: string;
  workspaceName: string;
  authorId: string;
  authorUsername: string;
  body: string;
  createdAt: Date;
  task?: {
    id: string;
    shortId: number;
    title: string;
  };
  sourceUpdateId?: string;
  sourcePostMessageId?: string;
  metricKind: "event_created_thread" | "event_created_post";
};

export type CaptureMode = "live" | "backfill";

async function applyCaptureAnalysis(
  analysis: CaptureAnalysis,
  existingEvents: MemoryEventRow[],
  ctx: CaptureApplyContext
): Promise<void> {
  if (analysis.outcome === "none") return;

  const existingIds = new Set(existingEvents.map((e) => e.id));

  if (analysis.outcome === "likely_resolves") {
    if (!analysis.target_event_id || !existingIds.has(analysis.target_event_id)) {
      return;
    }
    if (ctx.mode === "backfill") {
      await prisma.memoryEvent.updateMany({
        where: { id: analysis.target_event_id, status: "OPEN" },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedByUpdateId: ctx.sourceUpdateId ?? null,
          resolvedByPostMessageId: ctx.sourcePostMessageId ?? null,
          resolvedById: ctx.authorId,
        },
      });
      return;
    }
    await suggestBlockerResolution({
      eventId: analysis.target_event_id,
      triggerUpdateId: ctx.sourceUpdateId,
      triggerUserId: ctx.authorId,
    });
    return;
  }

  if (!analysis.summary?.trim()) return;

  const kind =
    analysis.outcome === "supersedes_decision" ? "DECISION" : analysis.kind;
  if (!kind) return;

  const decisionIds = new Set(
    existingEvents.filter((e) => e.kind === "DECISION").map((e) => e.id)
  );
  const supersedesEventId =
    analysis.outcome === "supersedes_decision" &&
    analysis.target_event_id &&
    decisionIds.has(analysis.target_event_id)
      ? analysis.target_event_id
      : undefined;

  const event = await createMemoryEvent({
    workspaceId: ctx.workspaceId,
    userId: ctx.authorId,
    kind,
    summary: analysis.summary,
    reasoning: analysis.reasoning,
    tags: analysis.tags,
    taskShortId: ctx.task?.shortId,
    sourceUpdateId: ctx.sourceUpdateId,
    sourcePostMessageId: ctx.sourcePostMessageId,
    supersedesEventId,
    ...(ctx.mode === "backfill" ? { createdAt: ctx.createdAt } : {}),
  });

  if (ctx.mode === "live") {
    bumpMemoryMetric(ctx.workspaceId, ctx.metricKind);
  }

  if (
    ctx.mode === "live" &&
    event.status === "OPEN" &&
    (kind === "BLOCKER" || kind === "DEPENDENCY") &&
    ctx.task &&
    // Automatic blocker routing to assignees is a paid (Team+) feature.
    (await workspaceFeature(ctx.workspaceId, "blockerRouting"))
  ) {
    await notifyBlockerDetected({
      workspaceId: ctx.workspaceId,
      workspaceName: ctx.workspaceName,
      taskId: ctx.task.id,
      taskShortId: ctx.task.shortId,
      taskTitle: ctx.task.title,
      authorUserId: ctx.authorId,
      authorUsername: ctx.authorUsername,
      kindLabel: kind === "BLOCKER" ? "Blocker" : "Dependency",
      summary: event.summary,
    }).catch((err) => console.error("[memory] blocker notify failed:", err));
  }
}

export async function captureFromTaskUpdate(
  updateId: string,
  mode: CaptureMode = "live"
): Promise<void> {
  if (!memoryCaptureEnabled()) return;

  const update = await prisma.taskUpdate.findUnique({
    where: { id: updateId },
    select: {
      id: true,
      body: true,
      createdAt: true,
      workspaceId: true,
      authorId: true,
      author: { select: { id: true, username: true } },
      workspace: { select: { name: true } },
      task: {
        select: {
          id: true,
          shortId: true,
          title: true,
          status: true,
          assignees: { select: { user: { select: { username: true } } } },
        },
      },
    },
  });
  if (!update?.task) return;

  const existingEvents = await loadExistingEventsForCapture({
    workspaceId: update.workspaceId,
    taskId: update.task.id,
  });

  const analysis = await analyzeSignal({
    systemPrompt: TASK_SYSTEM_PROMPT,
    userContent: [
      `Task: "${update.task.title}" (status: ${update.task.status})`,
      `Assignees: ${update.task.assignees.map((a) => `@${a.user.username}`).join(", ") || "(none)"}`,
      ``,
      `Existing memory events for this task:`,
      formatExistingEvents(existingEvents),
      ``,
      `New update from @${update.author.username}:`,
      update.body,
    ].join("\n"),
  });
  if (!analysis) return;

  await applyCaptureAnalysis(analysis, existingEvents, {
    mode,
    workspaceId: update.workspaceId,
    workspaceName: update.workspace.name,
    authorId: update.authorId,
    authorUsername: update.author.username,
    body: update.body,
    createdAt: update.createdAt,
    task: update.task,
    sourceUpdateId: update.id,
    metricKind: "event_created_thread",
  });
}

export async function captureFromPostMessage(
  messageId: string,
  mode: CaptureMode = "live"
): Promise<void> {
  if (!memoryCaptureEnabled()) return;

  const message = await prisma.postMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      body: true,
      createdAt: true,
      parentMessageId: true,
      authorId: true,
      author: { select: { username: true } },
      post: {
        select: {
          id: true,
          title: true,
          workspaceId: true,
          taskId: true,
          workspace: { select: { name: true } },
          task: {
            select: {
              id: true,
              shortId: true,
              title: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              body: true,
              parentMessageId: true,
              author: { select: { username: true } },
            },
          },
        },
      },
    },
  });
  if (!message) return;

  const { post } = message;
  const byId = new Map(post.messages.map((m) => [m.id, m]));

  const threadLines: string[] = [];
  let current = message.parentMessageId
    ? byId.get(message.parentMessageId)
    : null;
  let depth = 0;
  while (current && depth < 3) {
    threadLines.unshift(
      `@${current.author.username}: ${current.body}`
    );
    current = current.parentMessageId
      ? byId.get(current.parentMessageId) ?? null
      : null;
    depth++;
  }

  const opener = post.messages.find((m) => m.parentMessageId === null);
  const postTitle = postThreadTitle(
    post.title,
    opener?.body ?? ""
  );

  const existingEvents = await loadExistingEventsForCapture({
    workspaceId: post.workspaceId,
    taskId: post.taskId,
  });

  const analysis = await analyzeSignal({
    systemPrompt: POST_SYSTEM_PROMPT,
    userContent: [
      `Discussion: "${postTitle}"`,
      post.task
        ? `Related task: #${post.task.shortId} "${post.task.title}"`
        : "Related task: (none)",
      ``,
      `Existing memory events:`,
      formatExistingEvents(existingEvents),
      ``,
      ...(threadLines.length > 0
        ? [`Thread context:`, ...threadLines, ``]
        : []),
      `New message from @${message.author.username}:`,
      message.body,
    ].join("\n"),
  });
  if (!analysis) return;

  await applyCaptureAnalysis(analysis, existingEvents, {
    mode,
    workspaceId: post.workspaceId,
    workspaceName: post.workspace.name,
    authorId: message.authorId,
    authorUsername: message.author.username,
    body: message.body,
    createdAt: message.createdAt,
    task: post.task ?? undefined,
    sourcePostMessageId: message.id,
    metricKind: "event_created_post",
  });
}

export async function captureFromPostClosed(
  postId: string,
  closedByUserId: string,
  mode: CaptureMode = "live"
): Promise<void> {
  if (!memoryCaptureEnabled()) return;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      kind: true,
      taskId: true,
      workspaceId: true,
      workspace: { select: { name: true } },
      task: {
        select: {
          id: true,
          shortId: true,
          title: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          parentMessageId: true,
          author: { select: { username: true } },
        },
      },
    },
  });
  if (!post) return;

  const closer = await prisma.user.findUnique({
    where: { id: closedByUserId },
    select: { username: true },
  });
  if (!closer) return;

  const opener = post.messages.find((m) => m.parentMessageId === null);
  if (!opener) return;

  const postTitle = postThreadTitle(post.title, opener.body);
  const transcript = post.messages
    .map((m) => `@${m.author.username}: ${m.body}`)
    .join("\n");

  const existingEvents = await loadExistingEventsForCapture({
    workspaceId: post.workspaceId,
    taskId: post.taskId,
  });

  const analysis = await analyzeSignal({
    systemPrompt: POST_CLOSE_SYSTEM_PROMPT,
    userContent: [
      `Discussion closed by @${closer.username}`,
      `Kind: ${post.kind}`,
      `Discussion: "${postTitle}"`,
      post.task
        ? `Related task: #${post.task.shortId} "${post.task.title}"`
        : "Related task: (none)",
      ``,
      `Existing memory events:`,
      formatExistingEvents(existingEvents),
      ``,
      `Full thread transcript:`,
      transcript,
    ].join("\n"),
  });
  if (!analysis) return;

  await applyCaptureAnalysis(analysis, existingEvents, {
    mode,
    workspaceId: post.workspaceId,
    workspaceName: post.workspace.name,
    authorId: closedByUserId,
    authorUsername: closer.username,
    body: `Thread closed: ${postTitle}`,
    createdAt: new Date(),
    task: post.task ?? undefined,
    // Anchor provenance on the opener — the thread root, not a synthetic close message.
    sourcePostMessageId: opener.id,
    metricKind: "event_created_post",
  });
}

export function scheduleMemoryCapture(updateId: string): void {
  if (!memoryCaptureEnabled()) return;
  scheduleBackgroundTask("memory capture", () =>
    captureFromTaskUpdate(updateId)
  );
}

export function schedulePostMessageMemoryCapture(messageId: string): void {
  if (!memoryCaptureEnabled()) return;
  scheduleBackgroundTask("memory capture post", () =>
    captureFromPostMessage(messageId)
  );
}

export function schedulePostClosedMemoryCapture(
  postId: string,
  closedByUserId: string
): void {
  if (!memoryCaptureEnabled()) return;
  scheduleBackgroundTask("memory capture post close", () =>
    captureFromPostClosed(postId, closedByUserId)
  );
}

const SUPERSEDE_TOOL: Anthropic.Tool = {
  name: "record_supersession",
  description: "Report whether the new decision replaces an earlier one.",
  input_schema: {
    type: "object",
    properties: {
      supersedes_event_id: {
        type: "string",
        description:
          "Id of the earlier decision the new one replaces, or 'none'.",
      },
    },
    required: ["supersedes_event_id"],
  },
};

export async function checkDecisionSupersession(eventId: string): Promise<void> {
  if (!memoryCaptureEnabled()) return;

  const event = await prisma.memoryEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      workspaceId: true,
      kind: true,
      summary: true,
      reasoning: true,
    },
  });
  if (!event || event.kind !== "DECISION") return;

  const candidates = await prisma.memoryEvent.findMany({
    where: {
      workspaceId: event.workspaceId,
      kind: "DECISION",
      supersededByEventId: null,
      archivedAt: null,
      id: { not: event.id },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, summary: true, reasoning: true },
  });
  if (candidates.length === 0) return;

  const apiKey = getAnthropicApiKey();
  if (!apiKey) return;
  const anthropic = new Anthropic({ apiKey });
  const res = await anthropic.messages.create({
    model: CAPTURE_MODEL,
    max_tokens: 200,
    system:
      "You compare a NEW project decision against existing recorded decisions and report if the new one replaces/contradicts one of them. Be conservative.",
    messages: [
      {
        role: "user",
        content: [
          `NEW decision: ${event.summary}${event.reasoning ? ` (why: ${event.reasoning})` : ""}`,
          ``,
          `Existing decisions:`,
          ...candidates.map(
            (c) =>
              `- id=${c.id}: ${c.summary}${c.reasoning ? ` (why: ${c.reasoning})` : ""}`
          ),
        ].join("\n"),
      },
    ],
    tools: [SUPERSEDE_TOOL],
    tool_choice: { type: "tool", name: "record_supersession" },
  });

  const toolUse = res.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  const targetId = (toolUse?.input as { supersedes_event_id?: string })
    ?.supersedes_event_id;
  if (!targetId || targetId === "none") return;
  if (!candidates.some((c) => c.id === targetId)) return;

  await prisma.memoryEvent.update({
    where: { id: targetId },
    data: { supersededByEventId: event.id },
  });
}

export function scheduleDecisionSupersessionCheck(eventId: string): void {
  if (!memoryCaptureEnabled()) return;
  scheduleBackgroundTask("decision supersession check", () =>
    checkDecisionSupersession(eventId)
  );
}
