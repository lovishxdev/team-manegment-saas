import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-env";
import { prisma } from "@/lib/prisma";
import {
  normalizeMemoryTags,
  scheduleMemoryEventEmbeddingIndex,
} from "@/lib/services/memory";
import { memoryCaptureEnabled } from "@/lib/memory/capture";
import { isNearDuplicate } from "@/lib/memory/agent-capture";
import { bumpMemoryMetric } from "@/lib/memory/metrics";
import { workspaceFeature } from "@/lib/billing/entitlements";

/**
 * The dream cycle: scheduled, offline maintenance of a workspace's memory
 * store — the piece live capture cannot do because it only ever sees one
 * moment at a time. One model call reviews the whole active store and
 * proposes:
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
    },
    required: ["merges", "supersessions", "insights", "archive_ids"],
  },
};

const DREAM_SYSTEM_PROMPT = `You are the offline memory curator ("dream cycle") for a team project-memory store. You see the entire active store at once — something live capture never does — and your job is maintenance, not addition.

Operations, in priority order:
1. MERGE near-duplicates: events that state the same fact in different words (parallel capture, restatements across threads). Keep the best-phrased or most complete one. Merging across different kinds is forbidden.
2. SUPERSEDE contradictions: two DECISIONs that answer the same question differently — the newer supersedes the older. Only when they genuinely decide the SAME question; adjacent topics are not contradictions.
3. SURFACE insights: patterns visible only across events — a blocker theme recurring, the team converging on a choice never made explicitly, two open decisions that conflict and need a human. An insight must be actionable for a teammate; observations that change nothing are noise. Most dreams surface ZERO insights.
4. ARCHIVE stale rows: RESOLVED events that stopped informing work (old cleared blockers, absorbed milestones). Decisions that still bind future work stay, however old. Open blockers/dependencies always stay.

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
  createdAt: Date;
  resolvedAt: Date | null;
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
  return `- id=${e.id} (${e.kind}${status} · ${date}${task}${tags}) ${e.summary}${why}`;
}

async function proposeOperations(
  workspaceName: string,
  events: StoredEvent[],
  documents: StoredDocument[]
): Promise<DreamOps | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  const res = await anthropic.messages.create({
    model: DREAM_MODEL,
    max_tokens: 2000,
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

  const toolUse = res.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  return toolUse ? (toolUse.input as DreamOps) : null;
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
async function logDreamRun(report: DreamReport, startedAt: number): Promise<void> {
  await prisma.memoryDreamRun
    .create({
      data: {
        workspaceId: report.workspaceId,
        reviewed: report.reviewed,
        merged: report.merged,
        superseded: report.superseded,
        insights: report.insights,
        archived: report.archived,
        skipped: report.skipped,
        durationMs: Date.now() - startedAt,
      },
    })
    .catch((err) => console.error("[dream] run log failed:", err));
}

export async function runDreamCycle(input: {
  workspaceId: string;
  force?: boolean;
}): Promise<DreamReport> {
  const startedAt = Date.now();
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
          createdAt: true,
          resolvedAt: true,
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
    await logDreamRun(report, startedAt);
    return report;
  }

  bumpMemoryMetric(input.workspaceId, "dream_run", { sum: events.length });

  const ops = await proposeOperations(workspace.name, events, documents);
  if (!ops) {
    report.skipped = "model call produced no operations";
    await logDreamRun(report, startedAt);
    return report;
  }

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

  // --- 4. Archive ------------------------------------------------------------
  const archiveCutoff = new Date(
    Date.now() - ARCHIVE_MIN_AGE_DAYS * 24 * 3600 * 1000
  );
  const archivable = (ops.archive_ids ?? [])
    .map((id) => byId.get(id))
    .filter((e): e is StoredEvent => Boolean(e))
    .filter(
      (e) =>
        !consumed.has(e.id) &&
        e.status === "RESOLVED" &&
        (e.resolvedAt ?? e.createdAt) < archiveCutoff
    );
  if (archivable.length > 0) {
    await prisma.memoryEvent.updateMany({
      where: { id: { in: archivable.map((e) => e.id) } },
      data: { archivedAt: new Date() },
    });
    report.archived = archivable.length;
    bumpMemoryMetric(input.workspaceId, "dream_archive", {
      count: archivable.length,
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

  await logDreamRun(report, startedAt);
  return report;
}
