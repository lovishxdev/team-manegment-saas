import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-env";
import { prisma } from "@/lib/prisma";
import { createTtlCache } from "@/lib/ttl-cache";
import {
  createMemoryEvent,
  type MemoryEventRow,
} from "@/lib/services/memory";
import { memoryCaptureEnabled } from "@/lib/memory/capture";
import { notifyBlockerDetected } from "@/lib/whatsapp-notify";
import { suggestBlockerResolution } from "@/lib/memory/suggest";

/**
 * Ambient memory capture from coding-agent sessions (Cursor stop hook →
 * /api/ingest/agent-session). The agent's own transcript — its dedicated
 * context — is the signal: no tool calls during the session, no per-turn
 * interception. One judge call per substantive transcript delta decides
 * what, if anything, is worth remembering.
 *
 * The judge applies criteria, not patterns — a moment is memory-worthy if
 * it passes ANY of: future-why (someone will later ask "why is it this
 * way?" and the code can't answer), coordination (a teammate working in
 * parallel needs it to avoid conflict or being blocked), commitment (it
 * binds future work — convention, contract, tool choice), or onboarding
 * (someone joining later needs it to understand the project). Coding
 * transcripts are verbose, so the bar stays high: progress narration and
 * anything recoverable by reading the repo never qualify.
 *
 * Confirm-only resolution still holds: a session that plausibly cleared an
 * open blocker triggers a WhatsApp confirmation ask, never an auto-resolve.
 */

const CAPTURE_MODEL =
  process.env.MEMORY_CAPTURE_MODEL?.trim() || "claude-haiku-4-5";

/** Ignore trivial deltas — the hook accumulates them for the next run. */
export const MIN_AGENT_TRANSCRIPT_CHARS = 300;
/** Hard input cap; the hook sends the tail if a run was enormous. */
export const MAX_AGENT_TRANSCRIPT_CHARS = 24_000;
const MAX_EVENTS_PER_SESSION = 5;

/** One judge call per conversation per window, even if runs stop rapidly. */
const JUDGE_COOLDOWN_MS = 2 * 60 * 1000;
const judgeCooldown = createTtlCache<true>(JUDGE_COOLDOWN_MS);

type SessionEvent = {
  kind?: "DECISION" | "BLOCKER" | "DEPENDENCY" | "MILESTONE";
  summary?: string;
  reasoning?: string;
  task_short_id?: number;
  supersedes_event_id?: string;
};

type SessionAnalysis = {
  events?: SessionEvent[];
  resolved_event_ids?: string[];
};

const SESSION_TOOL: Anthropic.Tool = {
  name: "record_session_memory",
  description:
    "Record what (if anything) from this coding-agent session belongs in project memory. Always call exactly once. Most sessions produce zero events.",
  input_schema: {
    type: "object",
    properties: {
      events: {
        type: "array",
        description:
          "New memory events. Empty for most sessions — only moments that pass the criterion.",
        items: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["DECISION", "BLOCKER", "DEPENDENCY", "MILESTONE"],
            },
            summary: {
              type: "string",
              description:
                "One line, third person, self-contained: WHAT was decided / what is blocked. Name the thing — no 'this session', no 'the user'.",
            },
            reasoning: {
              type: "string",
              description:
                "WHY — rationale, alternatives rejected, constraints discovered. Omit if the session gives none.",
            },
            task_short_id: {
              type: "number",
              description:
                "Task #N from the listed workspace tasks this clearly belongs to. Omit for workspace-level events. Never guess.",
            },
            supersedes_event_id: {
              type: "string",
              description:
                "Id of a listed recorded DECISION this new decision replaces/contradicts (same question, different answer). Omit otherwise.",
            },
          },
          required: ["kind", "summary"],
        },
      },
      resolved_event_ids: {
        type: "array",
        items: { type: "string" },
        description:
          "Ids of listed OPEN blockers/dependencies this session's work plausibly cleared. Only ids from the list — never invent. This asks the user to confirm; it does not resolve anything.",
      },
    },
    required: ["events"],
  },
};

const SESSION_SYSTEM_PROMPT = `You are the memory judge for coding-agent work sessions. You read a transcript excerpt from an AI coding session and decide what — if anything — belongs in the team's persistent project memory.

Apply judgment against these tests, not phrase patterns. A moment is memory-worthy if it passes ANY of them:
1. Future-why: someone will later ask "why is it this way?" and the code alone cannot answer — rationale, alternatives rejected, constraints discovered.
2. Coordination: a teammate working on the project in parallel needs this to avoid conflicting or duplicated work, or to know they are blocked/unblocked — agreed interfaces, direction changes, blockers, dependencies.
3. Commitment: it binds future work — a convention, contract, tool/library choice, or agreed plan the team is expected to honor going forward.
4. Onboarding: someone joining the team months from now would need it to understand why the project is the way it is.

What qualifies maps to these kinds:
- DECISION: a choice between alternatives was settled (library, approach, architecture, trade-off, convention), especially with reasoning. Includes reversals of earlier decisions.
- BLOCKER: work cannot proceed (missing access/keys/files/approvals, broken external dependency, waiting on a person).
- DEPENDENCY: the work depends on another piece of work or an external party.
- MILESTONE: something significant shipped or was completed end-to-end.

Fails every test (record nothing for these):
- Progress narration: what files were edited, what functions were written, test results.
- Anything recoverable by reading the repo (code structure, existing behavior).
- Exploration, questions, dead ends that didn't settle anything.
- Restatements of memory that is already recorded (listed below) — never duplicate.

Coding transcripts are verbose; be conservative. Most sessions produce ZERO events. An empty events array is the expected, correct output for routine work.

If the session's work plausibly cleared one of the listed OPEN blockers/dependencies, return its id in resolved_event_ids — the user will be asked to confirm; nothing auto-resolves.

Write summaries in third person, self-contained, naming the actual thing.`;

function formatExistingEvents(events: MemoryEventRow[]): string {
  if (events.length === 0) return "(none)";
  return events
    .map(
      (e) =>
        `- id=${e.id} [${e.kind}${e.status === "OPEN" ? ", OPEN" : ""}] ${e.summary}${e.task ? ` (task #${e.task.shortId})` : ""}`
    )
    .join("\n");
}

async function judgeSession(input: {
  transcript: string;
  workspaceName: string;
  username: string;
  tasks: { shortId: number; title: string; status: string }[];
  existingEvents: MemoryEventRow[];
}): Promise<SessionAnalysis | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  const taskList =
    input.tasks.length > 0
      ? input.tasks
          .map((t) => `- #${t.shortId} "${t.title}" (${t.status})`)
          .join("\n")
      : "(none)";

  const userContent = [
    `Workspace: "${input.workspaceName}" · session run by @${input.username} in their coding agent.`,
    ``,
    `Workspace tasks (for linking via task_short_id):`,
    taskList,
    ``,
    `Already-recorded memory (open blockers/dependencies + current decisions) — never duplicate these:`,
    formatExistingEvents(input.existingEvents),
    ``,
    `Session transcript excerpt (user + agent messages only):`,
    `"""`,
    input.transcript,
    `"""`,
  ].join("\n");

  const res = await anthropic.messages.create({
    model: CAPTURE_MODEL,
    max_tokens: 1200,
    system: SESSION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    tools: [SESSION_TOOL],
    tool_choice: { type: "tool", name: "record_session_memory" },
  });

  const toolUse = res.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return null;
  return toolUse.input as SessionAnalysis;
}

export async function captureFromAgentSession(input: {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  conversationId: string;
  transcript: string;
}): Promise<void> {
  if (!memoryCaptureEnabled()) return;

  const transcript = input.transcript
    .trim()
    .slice(-MAX_AGENT_TRANSCRIPT_CHARS);
  if (transcript.length < MIN_AGENT_TRANSCRIPT_CHARS) return;

  const cooldownKey = `${input.workspaceId}:${input.conversationId}`;
  if (judgeCooldown.get(cooldownKey)) return;
  judgeCooldown.set(cooldownKey, true);

  const [user, tasks, existingEvents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { username: true },
    }),
    prisma.task.findMany({
      where: { workspaceId: input.workspaceId, status: { not: "DONE" } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { shortId: true, title: true, status: true },
    }),
    prisma.memoryEvent.findMany({
      where: {
        workspaceId: input.workspaceId,
        supersededByEventId: null,
        OR: [
          { status: "OPEN" },
          {
            kind: "DECISION",
            createdAt: {
              gte: new Date(Date.now() - 90 * 24 * 3600 * 1000),
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
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
    }),
  ]);
  if (!user) return;

  const analysis = await judgeSession({
    transcript,
    workspaceName: input.workspaceName,
    username: user.username,
    tasks,
    existingEvents,
  });
  if (!analysis) return;

  const existingIds = new Set(existingEvents.map((e) => e.id));
  const openIds = new Set(
    existingEvents.filter((e) => e.status === "OPEN").map((e) => e.id)
  );
  const taskShortIds = new Set(tasks.map((t) => t.shortId));

  // Confirm-only: a plausible clear becomes a WhatsApp ask, never a resolve.
  for (const eventId of analysis.resolved_event_ids ?? []) {
    if (!openIds.has(eventId)) continue;
    await suggestBlockerResolution({
      eventId,
      triggerUserId: input.userId,
    }).catch((err) =>
      console.error("[agent-capture] resolution suggestion failed:", err)
    );
  }

  const events = (analysis.events ?? []).slice(0, MAX_EVENTS_PER_SESSION);
  for (const candidate of events) {
    const summary = candidate.summary?.trim();
    const kind = candidate.kind;
    if (!summary || !kind) continue;

    const taskShortId =
      typeof candidate.task_short_id === "number" &&
      taskShortIds.has(candidate.task_short_id)
        ? candidate.task_short_id
        : undefined;

    const supersedesEventId =
      kind === "DECISION" &&
      candidate.supersedes_event_id &&
      existingIds.has(candidate.supersedes_event_id)
        ? candidate.supersedes_event_id
        : undefined;

    try {
      const event = await createMemoryEvent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        kind,
        summary,
        reasoning: candidate.reasoning,
        taskShortId,
        supersedesEventId,
      });

      if (
        event.status === "OPEN" &&
        (kind === "BLOCKER" || kind === "DEPENDENCY") &&
        taskShortId !== undefined
      ) {
        const task = await prisma.task.findFirst({
          where: { workspaceId: input.workspaceId, shortId: taskShortId },
          select: { id: true, title: true },
        });
        if (task) {
          await notifyBlockerDetected({
            workspaceId: input.workspaceId,
            workspaceName: input.workspaceName,
            taskId: task.id,
            taskShortId,
            taskTitle: task.title,
            authorUserId: input.userId,
            authorUsername: user.username,
            kindLabel: kind === "BLOCKER" ? "Blocker" : "Dependency",
            summary: event.summary,
          }).catch((err) =>
            console.error("[agent-capture] blocker notify failed:", err)
          );
        }
      }
    } catch (err) {
      console.error("[agent-capture] event create failed:", err);
    }
  }
}
