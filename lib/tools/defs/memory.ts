import { z } from "zod";
import type { MemoryEventKind } from "@/lib/generated/prisma/client";
import {
  createMemoryEvent,
  getOpenBlockersForTaskShortId,
  listMemoryEvents,
  recallMemory,
  resolveMemoryEvent,
  type MemoryEventRow,
} from "@/lib/services/memory";
import {
  ok,
  soft,
  requireWorkspace,
  type ToolDef,
} from "@/lib/tools/types";
import { optionalNum, optionalStr, str, workspaceParam } from "@/lib/tools/helpers";

/**
 * Decision-memory tools — the Recall side of the memory layer. Available on
 * both channels via the shared registry: the WhatsApp agent answers "why was
 * X decided" questions with them, and MCP coding agents pull compact project
 * context instead of full chat history.
 */

const MEMORY_KINDS = ["DECISION", "BLOCKER", "DEPENDENCY", "MILESTONE"] as const;

export function formatMemoryEvent(e: MemoryEventRow): string {
  const date = e.createdAt.toISOString().slice(0, 10);
  const status = e.status === "OPEN" ? " · OPEN" : "";
  const author = e.author ? ` — @${e.author.username}` : "";
  const task = e.task ? ` · task #${e.task.shortId} "${e.task.title}"` : "";
  const why = e.reasoning ? `\n  why: ${e.reasoning}` : "";
  return `- [${e.kind}${status}] ${e.summary}${why}\n  (${date}${author}${task} · id: ${e.id})`;
}

export function formatMemoryEvents(events: MemoryEventRow[]): string {
  return events.map(formatMemoryEvent).join("\n");
}

const recallMemoryTool: ToolDef = {
  name: "recall_memory",
  waDescription:
    'Search the project\'s decision memory — recorded decisions, blockers, dependencies, milestones. Use for "why was X decided", "what happened with Y", "any blockers around Z". Answer from the returned records.',
  mcpDescription:
    'Search the project\'s decision memory (structured records of decisions, blockers, dependencies, milestones — what/why/who). Use for "why was X decided" or "what happened with Y" instead of reading full update threads. Falls back: if nothing is found, ask_task searches raw update history.',
  inputShape: {
    query: z
      .string()
      .min(1)
      .describe("Topic or question, e.g. 'login redesign auth approach'"),
    shortId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Limit to one task (#N)"),
    kind: z
      .enum(MEMORY_KINDS)
      .optional()
      .describe("Limit to one kind of memory"),
    limit: z
      .number()
      .int()
      .positive()
      .max(25)
      .optional()
      .describe("Max records (default 8)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const query = str(input.query);
    if (!query) return soft("What should I look for in project memory?");

    const hits = await recallMemory({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      query,
      taskShortId: optionalNum(input.shortId),
      kind: optionalStr(input.kind) as MemoryEventKind | undefined,
      limit: optionalNum(input.limit),
    });

    if (hits.length === 0) {
      return ok(
        "No memory recorded about that yet. Try ask_task to search the raw update history, or record_decision to capture it now."
      );
    }
    return ok(
      `Project memory (${hits.length} match${hits.length === 1 ? "" : "es"}):\n${formatMemoryEvents(hits)}`,
      { count: hits.length }
    );
  },
};

const listBlockersTool: ToolDef = {
  name: "list_blockers",
  waDescription:
    "List open blockers and dependencies — workspace-wide or for one task (#N). Use when the user asks what's blocking or stuck.",
  mcpDescription:
    "List open blockers and dependencies, workspace-wide or for one task (#N). Call before starting work to know what's stuck.",
  inputShape: {
    shortId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Limit to one task (#N); omit for the whole workspace"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    // Only BLOCKER/DEPENDENCY can be OPEN, so status alone selects them.
    const events = await listMemoryEvents({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      taskShortId: optionalNum(input.shortId),
      status: "OPEN",
    });

    if (events.length === 0) {
      return ok("No open blockers or dependencies. 🎉");
    }
    return ok(
      `Open blockers/dependencies (${events.length}):\n${formatMemoryEvents(events)}`,
      { count: events.length }
    );
  },
};

/** "log a decision: we use X because Y" → summary "we use X", reasoning "Y". */
export function deriveDecisionFromMessage(message: string): {
  summary: string;
  reasoning?: string;
} | null {
  const stripped = message
    .replace(
      /^(please\s+)?(log|record|note|save|add)\s+(a\s+|this\s+|that\s+)?(decision|blocker|dependency|milestone)\s*[:\-—]*\s*/i,
      ""
    )
    .trim();
  if (!stripped) return null;

  const becauseSplit = stripped.split(/\s+because\s+/i);
  if (becauseSplit.length >= 2) {
    return {
      summary: becauseSplit[0].trim(),
      reasoning: becauseSplit.slice(1).join(" because ").trim(),
    };
  }
  return { summary: stripped };
}

const recordDecisionTool: ToolDef = {
  name: "record_decision",
  waDescription:
    'Record a decision, blocker, dependency, or milestone into project memory. Use when the user says "log this decision", "note that we\'re blocked on X", or states something clearly worth remembering. summary = the decision itself (one line); put the "because …" part in reasoning. Omit summary to use the user\'s message verbatim.',
  mcpDescription:
    "Record a decision, blocker, dependency, or milestone into project memory (what + why + who). Call after a meaningful decision is made during work so future sessions can recall it.",
  inputShape: {
    summary: z
      .string()
      .min(1)
      .describe("One line, third person: what happened / what was decided"),
    reasoning: z
      .string()
      .optional()
      .describe("Why — rationale, alternatives rejected, constraints"),
    kind: z
      .enum(MEMORY_KINDS)
      .optional()
      .describe("Default DECISION"),
    shortId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Task this belongs to (#N); omit for workspace-level"),
    workspace: workspaceParam,
  },
  waInputShape: {
    summary: z
      .string()
      .optional()
      .describe(
        "The decision/blocker itself, one line. Omit to use the user's message."
      ),
    reasoning: z
      .string()
      .optional()
      .describe("Why — the part after 'because', rationale, constraints"),
    kind: z.enum(MEMORY_KINDS).optional().describe("Default DECISION"),
    shortId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Task this belongs to (#N); omit for workspace-level"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    let summary = str(input.summary);
    let reasoning = optionalStr(input.reasoning);

    // WhatsApp models sometimes call with empty args — fall back to the
    // user's own message (same pattern as add_task_update).
    if (!summary && ctx.wa) {
      const derived = deriveDecisionFromMessage(ctx.wa.session.userMessage);
      if (derived) {
        summary = derived.summary;
        reasoning = reasoning ?? derived.reasoning;
      }
    }
    if (!summary) return soft("What should the memory record say?");

    const kind = (optionalStr(input.kind) as MemoryEventKind | undefined) ?? "DECISION";
    const event = await createMemoryEvent({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      kind,
      summary,
      reasoning,
      taskShortId: optionalNum(input.shortId),
    });

    const kindLabel = kind.toLowerCase();
    return ok(
      `Recorded ${kindLabel} in project memory:\n${formatMemoryEvent(event)}`,
      { eventId: event.id }
    );
  },
};

const resolveBlockerTool: ToolDef = {
  name: "resolve_blocker",
  waDescription:
    "Mark an open blocker/dependency as resolved. Get the event id from list_blockers or recall_memory first. Only when the user confirms it's cleared.",
  mcpDescription:
    "Mark an open blocker/dependency as resolved by its memory event id (from list_blockers or recall_memory). Only call after the user confirms the blocker is actually cleared.",
  inputShape: {
    eventId: z.string().min(1).describe("Memory event id (uuid)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const eventId = str(input.eventId);
    if (!eventId) return soft("Which blocker? Give me its memory event id.");

    const event = await resolveMemoryEvent({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      eventId,
    });
    return ok(`Resolved ✅ — "${event.summary}"`, { eventId: event.id });
  },
};

const getProjectContextTool: ToolDef = {
  name: "get_project_context",
  waDescription:
    "Compact project brief for a topic: relevant decisions + open blockers. Use when someone new asks for background on a piece of work.",
  mcpDescription:
    "CALL THIS BEFORE STARTING WORK. Returns the compact project brief for what you're about to do: relevant recorded decisions (with reasoning) and open blockers/dependencies — a few hundred tokens instead of full chat history. Pass a description of the work (and the task #N if known).",
  inputShape: {
    query: z
      .string()
      .min(1)
      .describe("What you're about to work on, e.g. 'login page redesign'"),
    shortId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Task #N if known"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const query = str(input.query);
    if (!query) return soft("Describe the work you need context for.");
    const shortId = optionalNum(input.shortId);

    const [relevant, blockers] = await Promise.all([
      recallMemory({
        workspaceId: ws.workspaceId,
        userId: ctx.userId,
        query,
        limit: 6,
      }),
      shortId !== undefined
        ? getOpenBlockersForTaskShortId(ws.workspaceId, shortId)
        : listMemoryEvents({
            workspaceId: ws.workspaceId,
            userId: ctx.userId,
            status: "OPEN",
            limit: 10,
          }),
    ]);

    const sections: string[] = [`Project context for: ${query}`];
    sections.push(
      blockers.length > 0
        ? `\nOpen blockers/dependencies${shortId !== undefined ? ` on task #${shortId}` : ""}:\n${formatMemoryEvents(blockers)}`
        : `\nNo open blockers${shortId !== undefined ? ` on task #${shortId}` : ""}.`
    );
    // Avoid repeating blocker rows in the relevant-memory section.
    const blockerIds = new Set(blockers.map((b) => b.id));
    const decisions = relevant.filter((r) => !blockerIds.has(r.id));
    sections.push(
      decisions.length > 0
        ? `\nRelevant recorded memory:\n${formatMemoryEvents(decisions)}`
        : `\nNo recorded decisions matched. (recall_memory or ask_task can dig deeper.)`
    );
    sections.push(
      `\nWhile working: post add_task_update after meaningful progress; record_decision when a decision is made; resolve_blocker (after user confirmation) when a blocker clears.`
    );

    return ok(sections.join("\n"), {
      blockers: blockers.length,
      decisions: decisions.length,
    });
  },
};

export const memoryTools: ToolDef[] = [
  recallMemoryTool,
  listBlockersTool,
  recordDecisionTool,
  resolveBlockerTool,
  getProjectContextTool,
];
