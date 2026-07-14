import Anthropic from "@anthropic-ai/sdk";
import crypto from "node:crypto";
import { getAnthropicApiKey } from "@/lib/anthropic-env";
import { prisma } from "@/lib/prisma";
import {
  normalizeMemoryTags,
  scheduleMemoryEventEmbeddingIndex,
} from "@/lib/services/memory";
import { memoryCaptureEnabled } from "@/lib/memory/capture";
import { isNearDuplicate } from "@/lib/memory/similarity";
import { bumpMemoryMetric } from "@/lib/memory/metrics";
import { workspaceFeature } from "@/lib/billing/entitlements";
import { recordMemoryModelUsage } from "@/lib/memory/model-usage";

/**
 * The dream cycle: scheduled, offline maintenance of a workspace's memory
 * store — the piece live capture cannot do because it only ever sees one
 * moment at a time. A proposer reviews the active store, then an independent
 * adversary and judge protect against semantic information loss before code
 * applies:
 *
 *  - consolidation: near-duplicate events merged under one canonical row
 *    (duplicates linked via supersededByEventId, never deleted);
 *  - contradiction resolution: two DECISIONs answering the same question
 *    differently get the supersession link, newest wins;
 *  - pattern surfacing: cross-event INSIGHTs no single capture could see
 *    ("third blocker about design-asset delays this month");
 *  - pruning: stale resolved events archived out of active memory.
 *
 * Capture is deliberately conservative and additive; dreaming is where the
 * store gets tended. Every proposed operation is validated in code — the
 * model cannot delete anything, touch open work via archive, or reference
 * ids it wasn't shown.
 */

const DREAM_MODEL =
  process.env.MEMORY_DREAM_MODEL?.trim() ||
  process.env.MEMORY_CAPTURE_MODEL?.trim() ||
  "claude-sonnet-4-5";
const DREAM_ADVERSARY_MODEL =
  process.env.MEMORY_DREAM_ADVERSARY_MODEL?.trim() || "claude-haiku-4-5";
const DREAM_JUDGE_MODEL =
  process.env.MEMORY_DREAM_JUDGE_MODEL?.trim() || "claude-sonnet-4-5";

/** Not enough events to consolidate or see patterns across. */
const MIN_EVENTS_TO_DREAM = 8;
const MAX_EVENTS_REVIEWED = 250;
const MAX_INSIGHTS_PER_DREAM = 3;
/** Resolved this long ago → eligible for archive. */
const ARCHIVE_MIN_AGE_DAYS = 30;
/** A workspace dreams at most this often. Daily while the store is small
 *  and we're watching it work; raise toward weekly as workspaces grow. */
export const DREAM_COOLDOWN_DAYS = 1;

type DreamOps = {
  merges?: {
    keep_id?: string;
    duplicate_ids?: string[];
    merged_summary?: string;
    merged_tags?: string[];
  }[];
  supersessions?: { older_decision_id?: string; newer_decision_id?: string }[];
  insights?: {
    summary?: string;
    reasoning?: string;
    tags?: string[];
  }[];
  noise_archive_ids?: string[];
  archive_ids?: string[];
};

export type DreamReport = {
  workspaceId: string;
  reviewed: number;
  merged: number;
  superseded: number;
  insights: number;
  archived: number;
  skipped: string | null;
};

const DREAM_TOOL: Anthropic.Tool = {
  name: "record_dream_operations",
  description:
    "Record the maintenance operations for this workspace's memory store. Always call exactly once. All arrays may be empty — a healthy store needs no changes.",
  input_schema: {
    type: "object",
    properties: {
      merges: {
        type: "array",
        description:
          "Groups of events that state the same fact. keep_id is the canonical row; duplicate_ids get hidden behind it.",
        items: {
          type: "object",
          properties: {
            keep_id: { type: "string" },
            duplicate_ids: { type: "array", items: { type: "string" } },
            merged_summary: {
              type: "string",
              description:
                "Optional improved summary for the kept event, combining the duplicates' information. Omit to keep as-is.",
            },
            merged_tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional combined tags for the kept event.",
            },
          },
          required: ["keep_id", "duplicate_ids"],
        },
      },
      supersessions: {
        type: "array",
        description:
          "Pairs of DECISIONs that answer the same question differently. The newer one supersedes the older.",
        items: {
          type: "object",
          properties: {
            older_decision_id: { type: "string" },
            newer_decision_id: { type: "string" },
          },
          required: ["older_decision_id", "newer_decision_id"],
        },
      },
      insights: {
        type: "array",
        description:
          `At most ${MAX_INSIGHTS_PER_DREAM}. Cross-event patterns no single event shows: recurring blocker themes, unstated converged-on choices, conflicting open decisions needing a human. Only patterns a teammate would act on.`,
        items: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "One line, third person: the pattern itself.",
            },
            reasoning: {
              type: "string",
              description:
                "The evidence — which events, how often, over what period.",
            },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["summary"],
        },
      },
      archive_ids: {
        type: "array",
        items: { type: "string" },
        description:
          "RESOLVED events that no longer inform day-to-day work (old cleared blockers, shipped milestones long absorbed into the project). Never open work, never load-bearing decisions.",
      },
      noise_archive_ids: {
        type: "array",
        items: { type: "string" },
        description:
          "Recent unreviewed AGENT_SESSION/AGENT_DOCUMENT decisions or milestones that are implementation narration, local/reversible choices, or facts recoverable from code. Never open work.",
      },
    },
    required: [
      "merges",
      "supersessions",
      "insights",
      "noise_archive_ids",
      "archive_ids",
    ],
  },
};

const DREAM_SYSTEM_PROMPT = `You are the offline memory curator ("dream cycle") for a team project-memory store. You see the entire active store at once — something live capture never does — and your job is maintenance, not addition.

Operations, in priority order:
1. MERGE near-duplicates: events that state the same fact in different words (parallel capture, restatements across threads). Keep the best-phrased or most complete one. Merging across different kinds is forbidden.
2. SUPERSEDE contradictions: two DECISIONs that answer the same question differently — the newer supersedes the older. Only when they genuinely decide the SAME question; adjacent topics are not contradictions.
3. SURFACE insights: patterns visible only across events — a blocker theme recurring, the team converging on a choice never made explicitly, two open decisions that conflict and need a human. An insight must be actionable for a teammate; observations that change nothing are noise. Most dreams surface ZERO insights.
4. ARCHIVE stale rows: RESOLVED events that stopped informing work (old cleared blockers, absorbed milestones). Decisions that still bind future work stay, however old. Open blockers/dependencies always stay.

Lifecycle signals are evidence, not truth: importance, tier, recall count and
last-recalled date help prioritize. PERMANENT records are never archive
targets. A rarely recalled project contract may still be load-bearing;
frequent recall is reinforcement, while zero recall alone is never enough to
archive.

Use noise_archive_ids immediately (no age requirement) for unreviewed
agent-captured implementation noise: file/UI positioning, timing, local asset
choices, refactors, code-recoverable details. This is separate from
archive_ids, which is age-based retirement of formerly useful memory.

Opt-in Markdown documents are supporting evidence for insights and
contradiction judgment. They are not event ids and cannot be merged,
superseded, or archived by this tool.

Be conservative: every operation loses information from the active store, and a wrong merge is worse than a duplicate. When unsure, do nothing — empty arrays are the expected output for a healthy store.`;

type StoredEvent = {
  id: string;
  kind: string;
  status: string;
  summary: string;
  reasoning: string | null;
  tags: string[];
  importance: number;
  retentionTier: "SHORT" | "LONG" | "PERMANENT";
  recallCount: number;
  lastRecalledAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
  dreamedAt: Date | null;
  captureSource: string;
  promotedFromCandidate: { authority: string } | null;
  task: { shortId: number; title: string } | null;
};

type StoredDocument = {
  path: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: Date;
};

function formatEvent(e: StoredEvent): string {
  const date = e.createdAt.toISOString().slice(0, 10);
  const status = e.status === "OPEN" ? " OPEN" : "";
  const task = e.task ? ` task#${e.task.shortId}` : "";
  const tags = e.tags.length > 0 ? ` [${e.tags.join(",")}]` : "";
  const why = e.reasoning ? `\n  why: ${e.reasoning}` : "";
  const utility = ` · tier=${e.retentionTier} importance=${e.importance.toFixed(2)} recalls=${e.recallCount}${e.lastRecalledAt ? ` last=${e.lastRecalledAt.toISOString().slice(0, 10)}` : ""}`;
  return `- id=${e.id} (${e.kind}${status} · ${date}${task}${tags}${utility}) ${e.summary}${why}`;
}

async function proposeOperations(
  workspaceId: string,
  runId: string,
  workspaceName: string,
  events: StoredEvent[],
  documents: StoredDocument[]
): Promise<DreamOps | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  const startedAt = Date.now();
  const res = await anthropic.messages.create({
    model: DREAM_MODEL,
    max_tokens: 4000,
    system: DREAM_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `Workspace: "${workspaceName}" — full active memory store (${events.length} events, oldest first):`,
          ``,
          events.map(formatEvent).join("\n"),
          ``,
          `Opt-in memory documents (${documents.length}; supporting evidence, not operation targets):`,
          documents.length > 0
            ? documents
                .map(
                  (document) =>
                    `- ${document.path} (${document.title}; tags=${document.tags.join(",") || "none"}; updated=${document.updatedAt.toISOString().slice(0, 10)})\n  ${document.content.slice(0, 1200)}`
                )
                .join("\n")
            : "(none)",
        ].join("\n"),
      },
    ],
    tools: [DREAM_TOOL],
    tool_choice: { type: "tool", name: "record_dream_operations" },
  });
  await recordMemoryModelUsage({
    workspaceId,
    stage: "dream-proposer",
    model: DREAM_MODEL,
    response: res,
    durationMs: Date.now() - startedAt,
    runId,
  }).catch((error) => console.error("[dream] proposer usage failed:", error));

  const toolUse = res.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return null;
  const ops = toolUse.input as DreamOps;
  if (
    !Array.isArray(ops.merges) ||
    !Array.isArray(ops.supersessions) ||
    !Array.isArray(ops.insights) ||
    !Array.isArray(ops.noise_archive_ids) ||
    !Array.isArray(ops.archive_ids)
  ) {
    return null;
  }
  return ops;
}

export type DreamProposal = {
  key: string;
  type: "merge" | "supersede" | "insight" | "noise_archive" | "archive";
  operation: unknown;
};

type DreamChallenge = {
  key: string;
  objection: string | null;
  severity: "low" | "medium" | "high";
};

type DreamVerdict = {
  key: string;
  approve: boolean;
  rationale: string;
};

function flattenDreamOps(
  ops: DreamOps,
  events: StoredEvent[]
): DreamProposal[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const eventEvidence = (id: string | undefined) => {
    const event = id ? byId.get(id) : undefined;
    return event
      ? {
          id: event.id,
          kind: event.kind,
          status: event.status,
          summary: event.summary,
          reasoning: event.reasoning,
          tier: event.retentionTier,
          importance: event.importance,
          recallCount: event.recallCount,
          captureSource: event.captureSource,
        }
      : null;
  };
  return [
    ...(ops.merges ?? []).map((operation, index) => ({
      key: `merge:${index}`,
      type: "merge" as const,
      operation: {
        ...operation,
        keepEvent: eventEvidence(operation.keep_id),
        duplicateEvents: (operation.duplicate_ids ?? []).map(eventEvidence),
      },
    })),
    ...(ops.supersessions ?? []).map((operation, index) => ({
      key: `supersede:${index}`,
      type: "supersede" as const,
      operation: {
        ...operation,
        olderEvent: eventEvidence(operation.older_decision_id),
        newerEvent: eventEvidence(operation.newer_decision_id),
      },
    })),
    ...(ops.insights ?? []).map((operation, index) => ({
      key: `insight:${index}`,
      type: "insight" as const,
      operation,
    })),
    ...(ops.noise_archive_ids ?? []).map((operation, index) => ({
      key: `noise_archive:${index}`,
      type: "noise_archive" as const,
      operation: {
        eventId: operation,
        event: eventEvidence(operation),
      },
    })),
    ...(ops.archive_ids ?? []).map((operation, index) => ({
      key: `archive:${index}`,
      type: "archive" as const,
      operation: {
        eventId: operation,
        event: eventEvidence(operation),
      },
    })),
  ];
}

const ADVERSARY_TOOL: Anthropic.Tool = {
  name: "challenge_dream_proposals",
  description: "Challenge every proposed memory operation before it can apply.",
  input_schema: {
    type: "object",
    properties: {
      challenges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            objection: { type: ["string", "null"] },
            severity: {
              type: "string",
              enum: ["low", "medium", "high"],
            },
          },
          required: ["key", "objection", "severity"],
        },
      },
    },
    required: ["challenges"],
  },
};

const JUDGE_TOOL: Anthropic.Tool = {
  name: "judge_dream_proposals",
  description:
    "Approve or reject every proposed memory operation after reading adversary challenges.",
  input_schema: {
    type: "object",
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            approve: { type: "boolean" },
            rationale: { type: "string" },
          },
          required: ["key", "approve", "rationale"],
        },
      },
    },
    required: ["verdicts"],
  },
};

export async function reviewDreamOperations(input: {
  workspaceId: string;
  runId: string;
  proposals: DreamProposal[];
}): Promise<{
  challenges: DreamChallenge[];
  verdicts: DreamVerdict[];
} | null> {
  if (input.proposals.length === 0) {
    return { challenges: [], verdicts: [] };
  }
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  const proposalJson = JSON.stringify(input.proposals);

  const adversaryStarted = Date.now();
  const adversaryResponse = await anthropic.messages.create({
    model: DREAM_ADVERSARY_MODEL,
    max_tokens: 3000,
    temperature: 0,
    system: `You are a skeptical project-memory adversary. Challenge every operation that could erase nuance, hide a rare fact, merge distinct decisions, supersede only part of an older rationale, archive a load-bearing project contract, or surface an unsupported insight. Open blockers must never be archived. A high-severity objection means likely information loss. Return one challenge for every key; use null/low when clean.`,
    messages: [{ role: "user", content: proposalJson }],
    tools: [ADVERSARY_TOOL],
    tool_choice: { type: "tool", name: "challenge_dream_proposals" },
  });
  await recordMemoryModelUsage({
    workspaceId: input.workspaceId,
    stage: "dream-adversary",
    model: DREAM_ADVERSARY_MODEL,
    response: adversaryResponse,
    durationMs: Date.now() - adversaryStarted,
    runId: input.runId,
  }).catch((error) => console.error("[dream] adversary usage failed:", error));
  const adversaryTool = adversaryResponse.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  const challenges =
    (
      adversaryTool?.input as
        | { challenges?: DreamChallenge[] }
        | undefined
    )?.challenges ?? [];
  if (challenges.length !== input.proposals.length) return null;

  const judgeStarted = Date.now();
  const judgeResponse = await anthropic.messages.create({
    model: DREAM_JUDGE_MODEL,
    max_tokens: 3000,
    temperature: 0,
    system: `You are the final project-memory consolidation judge. Review every proposal and its adversary challenge. Reject operations with unresolved high-severity information-loss risk. Be especially protective of explicit decisions, permanent memories, rare rationale, and source provenance. Approve clean duplicate merges and obvious local/code-recoverable noise. Return one verdict for every key.`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          proposals: input.proposals,
          challenges,
        }),
      },
    ],
    tools: [JUDGE_TOOL],
    tool_choice: { type: "tool", name: "judge_dream_proposals" },
  });
  await recordMemoryModelUsage({
    workspaceId: input.workspaceId,
    stage: "dream-judge",
    model: DREAM_JUDGE_MODEL,
    response: judgeResponse,
    durationMs: Date.now() - judgeStarted,
    runId: input.runId,
  }).catch((error) => console.error("[dream] judge usage failed:", error));
  const judgeTool = judgeResponse.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  const verdicts =
    (judgeTool?.input as { verdicts?: DreamVerdict[] } | undefined)?.verdicts ??
    [];
  if (verdicts.length !== input.proposals.length) return null;
  return { challenges, verdicts };
}

function approvedDreamOps(
  ops: DreamOps,
  verdicts: DreamVerdict[]
): DreamOps {
  const approved = new Set(
    verdicts.filter((verdict) => verdict.approve).map((verdict) => verdict.key)
  );
  return {
    merges: (ops.merges ?? []).filter((_, index) =>
      approved.has(`merge:${index}`)
    ),
    supersessions: (ops.supersessions ?? []).filter((_, index) =>
      approved.has(`supersede:${index}`)
    ),
    insights: (ops.insights ?? []).filter((_, index) =>
      approved.has(`insight:${index}`)
    ),
    noise_archive_ids: (ops.noise_archive_ids ?? []).filter((_, index) =>
      approved.has(`noise_archive:${index}`)
    ),
    archive_ids: (ops.archive_ids ?? []).filter((_, index) =>
      approved.has(`archive:${index}`)
    ),
  };
}

/** Last full (non-skipped) dream per workspace, from the audit log. */
export async function lastDreamAt(workspaceId: string): Promise<Date | null> {
  const row = await prisma.memoryDreamRun.findFirst({
    where: { workspaceId, skipped: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

/** Persist the audit row; a logging failure never fails the dream. */
async function logDreamRun(
  report: DreamReport,
  startedAt: number,
  runId: string,
  details?: unknown
): Promise<void> {
  await prisma.memoryDreamRun
    .create({
      data: {
        id: runId,
        workspaceId: report.workspaceId,
        reviewed: report.reviewed,
        merged: report.merged,
        superseded: report.superseded,
        insights: report.insights,
        archived: report.archived,
        skipped: report.skipped,
        durationMs: Date.now() - startedAt,
        ...(details
          ? { details: JSON.parse(JSON.stringify(details)) }
          : {}),
      },
    })
    .catch((err) => console.error("[dream] run log failed:", err));
}

export async function runDreamCycle(input: {
  workspaceId: string;
  force?: boolean;
}): Promise<DreamReport> {
  const startedAt = Date.now();
  const runId = crypto.randomUUID();
  const report: DreamReport = {
    workspaceId: input.workspaceId,
    reviewed: 0,
    merged: 0,
    superseded: 0,
    insights: 0,
    archived: 0,
    skipped: null,
  };

  if (!memoryCaptureEnabled()) {
    report.skipped = "memory capture disabled";
    return report;
  }

  // Curated memory (Dreaming) is a paid feature. Hobby keeps raw capture;
  // dedupe / contradiction resolution / INSIGHTs require Team+.
  const curated = await workspaceFeature(input.workspaceId, "curatedMemory");
  if (!curated) {
    report.skipped = "curated memory not available on this plan";
    return report;
  }

  if (!input.force) {
    const last = await lastDreamAt(input.workspaceId);
    if (
      last &&
      Date.now() - last.getTime() < DREAM_COOLDOWN_DAYS * 24 * 3600 * 1000
    ) {
      report.skipped = `dreamed within last ${DREAM_COOLDOWN_DAYS} days`;
      return report;
    }
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true },
  });
  if (!workspace) {
    report.skipped = "workspace not found";
    return report;
  }

  // Unconfirmed inferred candidates are not permanent backlog. They never
  // enter recall, and expire after 30 days if leaders ignore them.
  await prisma.memoryCandidate.updateMany({
    where: {
      workspaceId: input.workspaceId,
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    },
    data: { status: "EXPIRED", reviewedAt: new Date() },
  });

  const [events, documents]: [StoredEvent[], StoredDocument[]] =
    await Promise.all([
      prisma.memoryEvent.findMany({
        where: {
          workspaceId: input.workspaceId,
          supersededByEventId: null,
          archivedAt: null,
        },
        orderBy: { createdAt: "asc" },
        take: MAX_EVENTS_REVIEWED,
        select: {
          id: true,
          kind: true,
          status: true,
          summary: true,
          reasoning: true,
          tags: true,
          importance: true,
          retentionTier: true,
          recallCount: true,
          lastRecalledAt: true,
          createdAt: true,
          resolvedAt: true,
          dreamedAt: true,
          captureSource: true,
          promotedFromCandidate: { select: { authority: true } },
          task: { select: { shortId: true, title: true } },
        },
      }),
      prisma.memoryDocument.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: {
          path: true,
          title: true,
          content: true,
          tags: true,
          updatedAt: true,
        },
      }),
    ]);
  report.reviewed = events.length;

  if (events.length + documents.length < MIN_EVENTS_TO_DREAM) {
    report.skipped = `only ${events.length} events + ${documents.length} documents (min ${MIN_EVENTS_TO_DREAM} signals)`;
    await logDreamRun(report, startedAt, runId);
    return report;
  }

  bumpMemoryMetric(input.workspaceId, "dream_run", { sum: events.length });

  const proposedOps = await proposeOperations(
    input.workspaceId,
    runId,
    workspace.name,
    events,
    documents
  );
  if (!proposedOps) {
    report.skipped = "model call produced no operations";
    await logDreamRun(report, startedAt, runId);
    return report;
  }
  const proposals = flattenDreamOps(proposedOps, events);
  const review = await reviewDreamOperations({
    workspaceId: input.workspaceId,
    runId,
    proposals,
  });
  if (!review) {
    report.skipped = "adversarial review failed closed";
    await logDreamRun(report, startedAt, runId, { proposals });
    return report;
  }
  const ops = approvedDreamOps(proposedOps, review.verdicts);
  const dreamDetails = {
    proposals,
    challenges: review.challenges,
    verdicts: review.verdicts,
    approvedKeys: review.verdicts
      .filter((verdict) => verdict.approve)
      .map((verdict) => verdict.key),
  };

  const byId = new Map(events.map((e) => [e.id, e]));
  const consumed = new Set<string>(); // ids already merged/superseded/archived this run

  // --- 1. Merges -----------------------------------------------------------
  for (const merge of ops.merges ?? []) {
    const keep = merge.keep_id ? byId.get(merge.keep_id) : undefined;
    if (!keep || consumed.has(keep.id)) continue;

    const duplicates = (merge.duplicate_ids ?? [])
      .map((id) => byId.get(id))
      .filter((e): e is StoredEvent => Boolean(e))
      .filter(
        (e) =>
          e.id !== keep.id &&
          !consumed.has(e.id) &&
          e.kind === keep.kind &&
          // Never hide open work behind a resolved canonical.
          !(e.status === "OPEN" && keep.status !== "OPEN")
      );
    if (duplicates.length === 0) continue;

    await prisma.memoryEvent.updateMany({
      where: { id: { in: duplicates.map((d) => d.id) } },
      data: { supersededByEventId: keep.id },
    });
    for (const d of duplicates) consumed.add(d.id);
    report.merged += duplicates.length;

    const mergedSummary = merge.merged_summary?.trim();
    const mergedTags = normalizeMemoryTags(merge.merged_tags);
    if (mergedSummary || mergedTags.length > 0) {
      await prisma.memoryEvent.update({
        where: { id: keep.id },
        data: {
          ...(mergedSummary ? { summary: mergedSummary } : {}),
          ...(mergedTags.length > 0 ? { tags: mergedTags } : {}),
        },
      });
      scheduleMemoryEventEmbeddingIndex(keep.id);
    }
  }

  // --- 2. Decision supersessions --------------------------------------------
  for (const pair of ops.supersessions ?? []) {
    const older = pair.older_decision_id
      ? byId.get(pair.older_decision_id)
      : undefined;
    const newer = pair.newer_decision_id
      ? byId.get(pair.newer_decision_id)
      : undefined;
    if (
      !older ||
      !newer ||
      older.id === newer.id ||
      consumed.has(older.id) ||
      consumed.has(newer.id) ||
      older.kind !== "DECISION" ||
      newer.kind !== "DECISION" ||
      older.createdAt > newer.createdAt
    ) {
      continue;
    }
    await prisma.memoryEvent.update({
      where: { id: older.id },
      data: { supersededByEventId: newer.id },
    });
    consumed.add(older.id);
    report.superseded += 1;
  }

  // --- 3. Insights -----------------------------------------------------------
  const existingInsightSummaries = events
    .filter((e) => e.kind === "INSIGHT")
    .map((e) => e.summary);
  for (const insight of (ops.insights ?? []).slice(0, MAX_INSIGHTS_PER_DREAM)) {
    const summary = insight.summary?.trim();
    if (!summary) continue;
    if (existingInsightSummaries.some((s) => isNearDuplicate(summary, s))) {
      continue;
    }
    existingInsightSummaries.push(summary);

    const created = await prisma.memoryEvent.create({
      data: {
        workspaceId: input.workspaceId,
        captureSource: "DREAM",
        kind: "INSIGHT",
        status: "RESOLVED",
        resolvedAt: new Date(),
        summary,
        reasoning: insight.reasoning?.trim() || null,
        tags: normalizeMemoryTags(insight.tags),
        authorId: null, // system-authored: no human said this
        dreamedAt: new Date(), // born from a dream — reviewed by definition
      },
      select: { id: true },
    });
    scheduleMemoryEventEmbeddingIndex(created.id);
    report.insights += 1;
    bumpMemoryMetric(input.workspaceId, "dream_insight");
  }

  // --- 4. Immediate agent-noise archive -------------------------------------
  const noise = (ops.noise_archive_ids ?? [])
    .map((id) => byId.get(id))
    .filter((event): event is StoredEvent => Boolean(event))
    .filter(
      (event) =>
        !consumed.has(event.id) &&
        event.status === "RESOLVED" &&
        event.retentionTier !== "PERMANENT" &&
        event.dreamedAt === null &&
        event.promotedFromCandidate === null &&
        (event.captureSource === "AGENT_SESSION" ||
          event.captureSource === "AGENT_DOCUMENT")
    );
  if (noise.length > 0) {
    await prisma.memoryEvent.updateMany({
      where: { id: { in: noise.map((event) => event.id) } },
      data: {
        archivedAt: new Date(),
        archiveReason: "DREAM_NOISE",
      },
    });
    for (const event of noise) consumed.add(event.id);
    report.archived += noise.length;
  }

  // --- 5. Age-based archive -------------------------------------------------
  const recentlyRecalledCutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const archivable = (ops.archive_ids ?? [])
    .map((id) => byId.get(id))
    .filter((e): e is StoredEvent => Boolean(e))
    .filter(
      (e) =>
        !consumed.has(e.id) &&
        e.status === "RESOLVED" &&
        e.retentionTier !== "PERMANENT" &&
        (e.resolvedAt ?? e.createdAt) <
          new Date(
            Date.now() -
              (e.retentionTier === "SHORT" ? 7 : ARCHIVE_MIN_AGE_DAYS) *
                24 *
                3600 *
                1000
          ) &&
        (!e.lastRecalledAt || e.lastRecalledAt < recentlyRecalledCutoff)
    );
  if (archivable.length > 0) {
    await prisma.memoryEvent.updateMany({
      where: { id: { in: archivable.map((e) => e.id) } },
      data: { archivedAt: new Date(), archiveReason: "DREAM_STALE" },
    });
    report.archived += archivable.length;
  }
  if (report.archived > 0) {
    bumpMemoryMetric(input.workspaceId, "dream_archive", {
      count: report.archived,
    });
  }

  if (report.merged > 0) {
    bumpMemoryMetric(input.workspaceId, "dream_merge", {
      count: report.merged,
    });
  }

  // Everything the dream saw is now "reviewed" — including events it merged
  // or archived (they were curated, that was the curation).
  await prisma.memoryEvent.updateMany({
    where: { id: { in: events.map((e) => e.id) } },
    data: { dreamedAt: new Date() },
  });

  await logDreamRun(report, startedAt, runId, {
    ...dreamDetails,
    applied: {
      merged: report.merged,
      superseded: report.superseded,
      insights: report.insights,
      archived: report.archived,
    },
  });
  return report;
}
