import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-env";
import { prisma } from "@/lib/prisma";
import { createTtlCache } from "@/lib/ttl-cache";
import {
  createMemoryEvent,
  type MemoryEventRow,
} from "@/lib/services/memory";
import { memoryCaptureEnabled } from "@/lib/memory/capture";
import { bumpMemoryMetric } from "@/lib/memory/metrics";
import { notifyBlockerDetected } from "@/lib/whatsapp-notify";
import { workspaceFeature } from "@/lib/billing/entitlements";
import {
  claimResolutionSuggestion,
  type ClaimedSuggestion,
} from "@/lib/memory/suggest";

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
 * open blocker produces an ask (delivered in-editor via the hook's
 * followup/block output, sharing the WhatsApp throttle budget), never an
 * auto-resolve.
 */

const CAPTURE_MODEL =
  process.env.MEMORY_CAPTURE_MODEL?.trim() || "claude-haiku-4-5";

/** Ignore trivial deltas — the hook accumulates them for the next run. */
export const MIN_AGENT_TRANSCRIPT_CHARS = 300;
/** Hard input cap; the hook sends the tail if a run was enormous. */
export const MAX_AGENT_TRANSCRIPT_CHARS = 24_000;
const MAX_EVENTS_PER_SESSION = 2;

/** One judge call per conversation per window, even if runs stop rapidly. */
const JUDGE_COOLDOWN_MS = 2 * 60 * 1000;
const judgeCooldown = createTtlCache<true>(JUDGE_COOLDOWN_MS);

type SessionEvent = {
  kind?: "DECISION" | "BLOCKER" | "DEPENDENCY" | "MILESTONE";
  summary?: string;
  reasoning?: string;
  tags?: string[];
  task_short_id?: number;
  supersedes_event_id?: string;
  source_document_path?: string;
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
            tags: {
              type: "array",
              items: { type: "string" },
              description:
                "1-4 short lowercase topic tags ('auth', 'payments', 'design-handoff'). Reuse tags already seen on existing events for the same topic — consistency beats precision.",
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
            source_document_path: {
              type: "string",
              description:
                "Exact path of one supplied Markdown document that is the primary evidence for this event. Omit when the transcript is the source.",
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

The bar is DURABILITY: record a moment only if it will still constrain or explain work A MONTH from now. Having a rationale is not enough — every code change has one. Ask: if this entry silently disappeared, would anyone on the team notice within a month? If not, it is not memory.

A durable moment also passes at least one of these tests:
1. Future-why: someone will later ask "why is it this way?" and the code alone cannot answer — rationale, alternatives rejected, constraints discovered.
2. Coordination: a teammate working in parallel needs it to avoid conflict or duplicated work, or to know they are blocked/unblocked.
3. Commitment: it binds future work — a convention, contract, tool/library choice the team is expected to honor going forward.
4. Onboarding: someone joining months from now needs it to understand why the project is the way it is.

Only record what actually HAPPENED or was explicitly settled in this session. Suggestions, recommendations, plans, options discussed, and "should/could/we can" talk record NOTHING — a proposal is not a decision until the work is done or the user clearly agrees to adopt it.

What qualifies maps to these kinds:
- DECISION: a choice between real alternatives was settled and future work must honor it (library, architecture, contract, convention, trade-off). Includes reversals of earlier decisions.
- BLOCKER: work cannot proceed (missing access/keys/files/approvals, broken external dependency, waiting on a person). A BLOCKER must still be true when the session ends — if the session itself fixed the problem, it is not a blocker.
- DEPENDENCY: the work depends on another piece of work or an external party.
- MILESTONE: a major capability shipped end-to-end — something a teammate would mention in a standup, not a page or component.

Never memory (fails the durability bar):
- Progress narration: files edited, functions written, tests passing, bugs fixed.
- Implementation descriptions dressed as decisions: "X redesigned/refactored/improved to do Y" is changelog, not memory — git history already records it. It only qualifies if it sets a convention or contract others must follow.
- Implementation details recoverable by reading code. Durable rationale,
  constraints, contracts, and settled choices written in a supplied Markdown
  document may qualify — the memory event indexes the important why, it does
  not copy the document.
- Exploration, questions, dead ends, and proposals that didn't get adopted.
- Process state: "fix deployed, awaiting confirmation/verification/testing" must never become an event of any kind.
- Restatements or rephrasings of already-recorded memory (listed below).

Each distinct fact appears at most once. At most ${MAX_EVENTS_PER_SESSION} events per session — if more seem to qualify, keep only the most durable. Most sessions produce ZERO events; an empty events array is the expected, correct output.

task_short_id: only when the transcript explicitly works on that task (mentions #N or its title). Never attach an event to a task just because the task exists.

If the session's work plausibly cleared one of the listed OPEN blockers/dependencies, return its id in resolved_event_ids — the user will be asked to confirm; nothing auto-resolves.

Write summaries in third person, self-contained, naming the actual thing.`;

/**
 * Deterministic near-duplicate guard. The judge is told not to duplicate
 * listed events, but parallel sessions and rephrasings slip through — two
 * hooks stopping together each fetch existing events before either commits.
 * Token-overlap (Jaccard) on normalized summaries catches rewordings that
 * exact content hashes miss.
 */
const NEAR_DUPLICATE_JACCARD = 0.5;

function summaryTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

export function isNearDuplicate(a: string, b: string): boolean {
  const ta = summaryTokens(a);
  const tb = summaryTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  const union = ta.size + tb.size - shared;
  return shared / union >= NEAR_DUPLICATE_JACCARD;
}

/**
 * Task links are only trusted when the transcript actually references the
 * task — "#N" or its title. The judge is instructed the same way, but it
 * demonstrably pins events to whatever tasks exist, so code decides.
 */
function transcriptMentionsTask(
  transcript: string,
  task: { shortId: number; title: string }
): boolean {
  if (new RegExp(`#${task.shortId}\\b`).test(transcript)) return true;
  const title = task.title.trim().toLowerCase();
  return title.length >= 4 && transcript.toLowerCase().includes(title);
}

function formatExistingEvents(events: MemoryEventRow[]): string {
  if (events.length === 0) return "(none)";
  return events
    .map(
      (e) =>
        `- id=${e.id} [${e.kind}${e.status === "OPEN" ? ", OPEN" : ""}] ${e.summary}${e.task ? ` (task #${e.task.shortId})` : ""}${e.tags.length > 0 ? ` (tags: ${e.tags.join(", ")})` : ""}`
    )
    .join("\n");
}

async function judgeSession(input: {
  transcript: string;
  documents: AgentSessionDocument[];
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
    ``,
    `Markdown documents created or changed during this agent run:`,
    input.documents.length > 0
      ? input.documents
          .map(
            (document) =>
              `--- ${document.path} (title=${document.title ?? "untitled"}; tags=${document.tags?.join(",") || "none"}; sha256=${document.hash}) ---\n${document.content}`
          )
          .join("\n\n")
      : "(none)",
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

export type SessionCaptureResult = {
  /** Confirm-only resolution asks claimed for in-editor delivery. */
  suggestions: ClaimedSuggestion[];
};

const NO_RESULT: SessionCaptureResult = { suggestions: [] };

export type AgentSessionDocument = {
  documentId?: string;
  /** Repository-relative path. */
  path: string;
  /** SHA-256 of the exact content supplied. */
  hash: string;
  content: string;
  title?: string;
  tags?: string[];
};

export async function captureFromAgentSession(input: {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  conversationId: string;
  transcript: string;
  documents?: AgentSessionDocument[];
}): Promise<SessionCaptureResult> {
  if (!memoryCaptureEnabled()) return NO_RESULT;

  const transcript = input.transcript
    .trim()
    .slice(-MAX_AGENT_TRANSCRIPT_CHARS);
  const documents = input.documents ?? [];
  if (
    transcript.length < MIN_AGENT_TRANSCRIPT_CHARS &&
    documents.length === 0
  ) {
    return NO_RESULT;
  }

  const cooldownKey = `${input.workspaceId}:${input.conversationId}`;
  if (judgeCooldown.get(cooldownKey)) return NO_RESULT;
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
        archivedAt: null,
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
        tags: true,
        createdAt: true,
        resolvedAt: true,
        supersededByEventId: true,
        dreamedAt: true,
        sourceDocumentPath: true,
        sourceDocumentHash: true,
        author: { select: { id: true, username: true, email: true } },
        task: { select: { shortId: true, title: true } },
      },
    }),
  ]);
  if (!user) return NO_RESULT;

  bumpMemoryMetric(input.workspaceId, "judge_run", {
    sum: transcript.length,
  });

  const analysis = await judgeSession({
    transcript,
    documents,
    workspaceName: input.workspaceName,
    username: user.username,
    tasks,
    existingEvents,
  });
  if (!analysis) return NO_RESULT;

  // Supersession is decision semantics — a decision may only replace
  // another DECISION, never a blocker/dependency (that would hide open
  // work from every default listing).
  const decisionIds = new Set(
    existingEvents.filter((e) => e.kind === "DECISION").map((e) => e.id)
  );
  const openIds = new Set(
    existingEvents.filter((e) => e.status === "OPEN").map((e) => e.id)
  );
  // Confirm-only: a plausible clear becomes an ask, never a resolve. The
  // asks are returned to the ingest endpoint, which hands them to the hook
  // for delivery inside the editor session (the user confirms there and the
  // agent calls resolve_blocker). Claiming consumes the shared suggestion
  // budget, so WhatsApp won't re-ask about the same event in parallel.
  const suggestions: ClaimedSuggestion[] = [];
  for (const eventId of analysis.resolved_event_ids ?? []) {
    if (!openIds.has(eventId)) continue;
    const claimed = await claimResolutionSuggestion(eventId).catch((err) => {
      console.error("[agent-capture] suggestion claim failed:", err);
      return null;
    });
    if (claimed) {
      suggestions.push(claimed);
      bumpMemoryMetric(input.workspaceId, "resolution_ask");
    }
  }

  const events = (analysis.events ?? []).slice(0, MAX_EVENTS_PER_SESSION);
  // Existing summaries + everything committed in this loop; grows as we
  // create, so the judge emitting the same fact twice also dedupes.
  const knownSummaries = existingEvents.map((e) => e.summary);
  if (events.length > 0) {
    // The judge call takes seconds — a parallel session may have committed
    // events since our first fetch. Pick up anything new before creating.
    const fresh = await prisma.memoryEvent.findMany({
      where: {
        workspaceId: input.workspaceId,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { summary: true },
    });
    for (const e of fresh) knownSummaries.push(e.summary);
  }
  for (const candidate of events) {
    const summary = candidate.summary?.trim();
    const kind = candidate.kind;
    if (!summary || !kind) continue;

    if (knownSummaries.some((known) => isNearDuplicate(summary, known))) {
      console.log(
        `[agent-capture] skipped near-duplicate event: "${summary.slice(0, 80)}"`
      );
      bumpMemoryMetric(input.workspaceId, "event_skipped_duplicate");
      continue;
    }
    knownSummaries.push(summary);

    const linkedTask =
      typeof candidate.task_short_id === "number"
        ? tasks.find((t) => t.shortId === candidate.task_short_id)
        : undefined;
    const taskShortId =
      linkedTask && transcriptMentionsTask(transcript, linkedTask)
        ? linkedTask.shortId
        : undefined;

    const supersedesEventId =
      kind === "DECISION" &&
      candidate.supersedes_event_id &&
      decisionIds.has(candidate.supersedes_event_id)
        ? candidate.supersedes_event_id
        : undefined;
    const sourceDocument = candidate.source_document_path
      ? documents.find(
          (document) => document.path === candidate.source_document_path
        )
      : undefined;

    try {
      const event = await createMemoryEvent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        kind,
        summary,
        reasoning: candidate.reasoning,
        tags: [
          ...(sourceDocument?.tags ?? []),
          ...(candidate.tags ?? []),
        ],
        taskShortId,
        supersedesEventId,
        sourceDocumentId: sourceDocument?.documentId,
        sourceDocumentPath: sourceDocument?.path,
        sourceDocumentHash: sourceDocument?.hash,
      });
      bumpMemoryMetric(
        input.workspaceId,
        sourceDocument ? "event_created_document" : "event_created_agent"
      );

      if (
        event.status === "OPEN" &&
        (kind === "BLOCKER" || kind === "DEPENDENCY") &&
        taskShortId !== undefined &&
        // Automatic blocker routing to assignees is a paid (Team+) feature.
        (await workspaceFeature(input.workspaceId, "blockerRouting"))
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

  return { suggestions };
}
