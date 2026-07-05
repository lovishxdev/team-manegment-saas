import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  createMemoryEvent,
  type MemoryEventRow,
} from "@/lib/services/memory";
import { notifyBlockerDetected } from "@/lib/whatsapp-notify";
import { suggestBlockerResolution } from "@/lib/memory/suggest";
import { scheduleBackgroundTask } from "@/lib/background-task";

/**
 * Quiet, after-the-fact memory capture: one cheap classifier call per task
 * update decides whether the update is a decision/blocker/dependency/
 * milestone worth remembering as structured state.
 *
 * Runs fire-and-forget after createTaskUpdate — never in the request path,
 * never auto-resolves anything (resolution is always human-confirmed).
 */

const CAPTURE_MODEL =
  process.env.MEMORY_CAPTURE_MODEL?.trim() || "claude-haiku-4-5";

export function memoryCaptureEnabled(): boolean {
  if (process.env.MEMORY_CAPTURE === "0") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export type CaptureAnalysis = {
  outcome: "none" | "new_event" | "likely_resolves" | "supersedes_decision";
  kind?: "DECISION" | "BLOCKER" | "DEPENDENCY" | "MILESTONE";
  summary?: string;
  reasoning?: string;
  /** Existing MemoryEvent id this update likely resolves or supersedes. */
  target_event_id?: string;
};

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "record_memory_analysis",
  description:
    "Record your classification of the team update. Always call this exactly once.",
  input_schema: {
    type: "object",
    properties: {
      outcome: {
        type: "string",
        enum: ["none", "new_event", "likely_resolves", "supersedes_decision"],
        description:
          "none = routine chatter, nothing worth remembering (most updates). " +
          "new_event = a decision, blocker, dependency, or milestone worth recording. " +
          "likely_resolves = the update suggests an existing OPEN blocker/dependency is now cleared. " +
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
          "One line, third person: WHAT happened. E.g. 'Design files for the login redesign are missing.' Required unless outcome=none or likely_resolves.",
      },
      reasoning: {
        type: "string",
        description:
          "WHY — the rationale/context a future teammate would need. Omit if the update gives none.",
      },
      target_event_id: {
        type: "string",
        description:
          "The id of the existing event being resolved (likely_resolves) or replaced (supersedes_decision).",
      },
    },
    required: ["outcome"],
  },
};

const SYSTEM_PROMPT = `You classify one team task update into structured "project memory".

Be conservative: most updates are routine chatter (progress notes, questions, acknowledgements) — outcome "none". Only record moments a teammate joining in six months would need:
- BLOCKER: work cannot proceed (missing files/access/approval, broken dependency, waiting on someone).
- DEPENDENCY: this work depends on another piece of work or an external party.
- DECISION: a choice was made between alternatives ("we'll use X", "going with Y instead of Z").
- MILESTONE: something significant shipped/completed/launched.

If the update says previously-blocked work is now unblocked and it plausibly matches one of the listed OPEN events, use "likely_resolves" with that event's id — never invent ids.
If it announces a decision that contradicts a listed recorded decision, use "supersedes_decision" with the old event's id and the new decision's summary/reasoning.
If an OPEN event listed below already covers the same blocker/dependency, do NOT record a duplicate — use "none".

Write summaries in third person, self-contained (no "this task" — name the thing).`;

function formatExistingEvents(events: MemoryEventRow[]): string {
  if (events.length === 0) return "(none)";
  return events
    .map(
      (e) =>
        `- id=${e.id} [${e.kind}${e.status === "OPEN" ? ", OPEN" : ""}] ${e.summary}`
    )
    .join("\n");
}

async function analyzeUpdate(input: {
  body: string;
  authorUsername: string;
  taskTitle: string;
  taskStatus: string;
  assigneeUsernames: string[];
  existingEvents: MemoryEventRow[];
}): Promise<CaptureAnalysis | null> {
  const anthropic = new Anthropic();

  const userContent = [
    `Task: "${input.taskTitle}" (status: ${input.taskStatus})`,
    `Assignees: ${input.assigneeUsernames.map((u) => `@${u}`).join(", ") || "(none)"}`,
    ``,
    `Existing memory events for this task (open blockers/dependencies + recent decisions):`,
    formatExistingEvents(input.existingEvents),
    ``,
    `New update from @${input.authorUsername}:`,
    input.body,
  ].join("\n");

  const res = await anthropic.messages.create({
    model: CAPTURE_MODEL,
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "record_memory_analysis" },
  });

  const toolUse = res.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return null;
  return toolUse.input as CaptureAnalysis;
}

export type CaptureMode = "live" | "backfill";

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

  // Context for dedupe + resolution/supersession detection: open work items
  // plus recent still-current decisions.
  const existingEvents = await prisma.memoryEvent.findMany({
    where: {
      taskId: update.task.id,
      supersededByEventId: null,
      OR: [
        { status: "OPEN" },
        { kind: "DECISION", createdAt: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      kind: true,
      status: true,
      summary: true,
      reasoning: true,
      createdAt: true,
      resolvedAt: true,
      supersededByEventId: true,
      author: { select: { id: true, username: true, email: true } },
      task: { select: { shortId: true, title: true } },
    },
  });

  const analysis = await analyzeUpdate({
    body: update.body,
    authorUsername: update.author.username,
    taskTitle: update.task.title,
    taskStatus: update.task.status,
    assigneeUsernames: update.task.assignees.map((a) => a.user.username),
    existingEvents,
  });
  if (!analysis || analysis.outcome === "none") return;

  const existingIds = new Set(existingEvents.map((e) => e.id));

  if (analysis.outcome === "likely_resolves") {
    if (!analysis.target_event_id || !existingIds.has(analysis.target_event_id)) {
      return;
    }
    if (mode === "backfill") {
      // Historical reconstruction: the thread already shows this blocker was
      // cleared later, so record it resolved instead of asking months after.
      await prisma.memoryEvent.updateMany({
        where: { id: analysis.target_event_id, status: "OPEN" },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedByUpdateId: update.id,
          resolvedById: update.authorId,
        },
      });
      return;
    }
    await suggestBlockerResolution({
      eventId: analysis.target_event_id,
      triggerUpdateId: update.id,
      triggerUserId: update.authorId,
    });
    return;
  }

  if (!analysis.summary?.trim()) return;

  const kind =
    analysis.outcome === "supersedes_decision" ? "DECISION" : analysis.kind;
  if (!kind) return;

  const supersedesEventId =
    analysis.outcome === "supersedes_decision" &&
    analysis.target_event_id &&
    existingIds.has(analysis.target_event_id)
      ? analysis.target_event_id
      : undefined;

  const event = await createMemoryEvent({
    workspaceId: update.workspaceId,
    userId: update.authorId,
    kind,
    summary: analysis.summary,
    reasoning: analysis.reasoning,
    taskShortId: update.task.shortId,
    sourceUpdateId: update.id,
    supersedesEventId,
    ...(mode === "backfill" ? { createdAt: update.createdAt } : {}),
  });

  if (
    mode === "live" &&
    event.status === "OPEN" &&
    (kind === "BLOCKER" || kind === "DEPENDENCY")
  ) {
    await notifyBlockerDetected({
      workspaceId: update.workspaceId,
      workspaceName: update.workspace.name,
      taskId: update.task.id,
      taskShortId: update.task.shortId,
      taskTitle: update.task.title,
      authorUserId: update.authorId,
      authorUsername: update.author.username,
      kindLabel: kind === "BLOCKER" ? "Blocker" : "Dependency",
      summary: event.summary,
    }).catch((err) => console.error("[memory] blocker notify failed:", err));
  }
}

/** Fire-and-forget hook for createTaskUpdate — zero latency added to posting. */
export function scheduleMemoryCapture(updateId: string): void {
  if (!memoryCaptureEnabled()) return;
  scheduleBackgroundTask("memory capture", () =>
    captureFromTaskUpdate(updateId)
  );
}
