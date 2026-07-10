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
import { scheduleDecisionSupersessionCheck } from "@/lib/memory/capture";
import { buildWorkspaceBrief } from "@/lib/memory/brief";
import { bumpMemoryMetric } from "@/lib/memory/metrics";
import { optionalNum, optionalStr, str, workspaceParam } from "@/lib/tools/helpers";
import { clearNotedBlocker, noteBlocker } from "@/lib/whatsapp-cache";

/**
 * Decision-memory tools — the Recall side of the memory layer. Available on
 * both channels via the shared registry: the WhatsApp agent answers "why was
 * X decided" questions with them, and MCP coding agents pull compact project
 * context instead of full chat history.
 */

const MEMORY_KINDS = [
  "DECISION",
  "BLOCKER",
  "DEPENDENCY",
  "MILESTONE",
  "INSIGHT",
] as const;

export function formatMemoryEvent(e: MemoryEventRow): string {
  const date = e.createdAt.toISOString().slice(0, 10);
  const status = e.status === "OPEN" ? " · OPEN" : "";
  const author = e.author ? ` — @${e.author.username}` : "";
  const task = e.task ? ` · task #${e.task.shortId} "${e.task.title}"` : "";
  const tags =
    e.tags.length > 0 ? ` · ${e.tags.map((t) => `#${t}`).join(" ")}` : "";
  const why = e.reasoning ? `\n  why: ${e.reasoning}` : "";
  return `- [${e.kind}${status}] ${e.summary}${why}\n  (${date}${author}${task}${tags} · id: ${e.id})`;
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
      .optional()
      .describe(
        "Topic or question, e.g. 'login redesign auth approach'. Omit to list recent memory."
      ),
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
    tag: z
      .string()
      .optional()
      .describe("Limit to one topic tag, e.g. 'auth' (tags shown on records)"),
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
    const query = optionalStr(input.query);

    // No query = browse mode. Never fail the call — list recent memory.
    if (!query) {
      const events = await listMemoryEvents({
        workspaceId: ws.workspaceId,
        userId: ctx.userId,
        taskShortId: optionalNum(input.shortId),
        kind: optionalStr(input.kind) as MemoryEventKind | undefined,
        tag: optionalStr(input.tag),
        limit: optionalNum(input.limit) ?? 10,
      });
      if (events.length === 0) {
        return ok(
          "No memory recorded yet. record_decision captures the first one."
        );
      }
      const listing = `Recent project memory (${events.length}):\n${formatMemoryEvents(events)}`;
      bumpMemoryMetric(ws.workspaceId, "recall_query", { sum: listing.length });
      return ok(listing, { count: events.length });
    }

    const hits = await recallMemory({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      query,
      taskShortId: optionalNum(input.shortId),
      kind: optionalStr(input.kind) as MemoryEventKind | undefined,
      tag: optionalStr(input.tag),
      limit: optionalNum(input.limit),
    });

    if (hits.length === 0) {
      return ok(
        "No memory recorded about that yet. Try ask_task to search the raw update history, or record_decision to capture it now."
      );
    }
    const body = `Project memory (${hits.length} match${hits.length === 1 ? "" : "es"}):\n${formatMemoryEvents(hits)}`;
    bumpMemoryMetric(ws.workspaceId, "recall_query", { sum: body.length });
    return ok(body, { count: hits.length });
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
    if (ctx.wa) {
      const top =
        events.find((e) => e.kind === "BLOCKER" || e.kind === "DEPENDENCY") ??
        events[0];
      noteBlocker(ctx.wa.session, top.id, top.summary);
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
    tags: z
      .array(z.string())
      .max(4)
      .optional()
      .describe("1-4 short lowercase topic tags, e.g. ['auth', 'payments']"),
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
    tags: z
      .array(z.string())
      .max(4)
      .optional()
      .describe("1-4 short lowercase topic tags, e.g. ['auth', 'payments']"),
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
      tags: Array.isArray(input.tags) ? (input.tags as string[]) : undefined,
      taskShortId: optionalNum(input.shortId),
    });

    bumpMemoryMetric(ws.workspaceId, "event_created_explicit");

    // Explicitly recorded decisions may contradict an earlier one — capture
    // handles this for update-sourced events; do the same check here.
    if (kind === "DECISION") {
      scheduleDecisionSupersessionCheck(event.id);
    }

    const kindLabel = kind.toLowerCase();
    if (ctx.wa) {
      if (kind === "BLOCKER" || kind === "DEPENDENCY") {
        noteBlocker(ctx.wa.session, event.id, event.summary);
      }
      // Human-facing confirmation (deterministic mutation reply) — no ids,
      // no bracket notation.
      return ok(
        `Saved to project memory 📌\n*${event.summary}*` +
          (event.reasoning ? `\nWhy: ${event.reasoning}` : ""),
        { eventId: event.id }
      );
    }
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
    if (ctx.wa) clearNotedBlocker(ctx.wa.session);
    return ok(`Resolved ✅ — "${event.summary}"`, { eventId: event.id });
  },
};

const getProjectContextTool: ToolDef = {
  name: "get_project_context",
  waDescription:
    "Compact project brief for a topic: relevant decisions + open blockers. Use when someone new asks for background on a piece of work.",
  mcpDescription:
    "CALL THIS BEFORE STARTING WORK. Returns the compact project brief: relevant recorded decisions (with reasoning) and open blockers/dependencies — a few hundred tokens instead of full chat history. Pass a description of the work (and the task #N if known), or call with no arguments for the general workspace brief.",
  inputShape: {
    query: z
      .string()
      .optional()
      .describe(
        "What you're about to work on, e.g. 'login page redesign'. Omit for the general workspace brief."
      ),
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
    const query = optionalStr(input.query);
    // No query = the agent just wants context. Never fail that — return the
    // general workspace brief (open blockers + decisions + recent activity +
    // active tasks) and point at the scoped tools for anything specific.
    if (!query) {
      const brief = await buildWorkspaceBrief({
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        userId: ctx.userId,
      });
      bumpMemoryMetric(ws.workspaceId, "context_pull", { sum: brief.length });
      return ok(
        brief +
          `\n\nThis is the general workspace brief (no query given). For ` +
          `anything specific, call get_project_context again with query ` +
          `(what you're working on) and shortId (#N) if known, or ` +
          `recall_memory for the history of a topic.`
      );
    }
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

    const contextBody = sections.join("\n");
    bumpMemoryMetric(ws.workspaceId, "context_pull", {
      sum: contextBody.length,
    });
    return ok(contextBody, {
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
