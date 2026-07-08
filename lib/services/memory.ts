import { prisma } from "@/lib/prisma";
import type {
  MemoryEventKind,
  MemoryEventStatus,
  Prisma,
} from "@/lib/generated/prisma/client";
import { getActorMembership, ServiceError } from "@/lib/services/project";
import {
  cosineSimilarity,
  embedText,
  embeddingsEnabled,
  hashContent,
  parseEmbeddingJson,
  semanticScore,
} from "@/lib/retrieval/embeddings";
import { scoreTaskTitleQuery } from "@/lib/task-title-search";
import { scheduleBackgroundTask } from "@/lib/background-task";
import { bumpMemoryMetric } from "@/lib/memory/metrics";

export const MAX_MEMORY_SUMMARY = 500;
export const MAX_MEMORY_REASONING = 2000;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const DEFAULT_RECALL_LIMIT = 8;
const MAX_RECALL_LIMIT = 25;

const SEMANTIC_WEIGHT = 0.65;
const KEYWORD_WEIGHT = 0.35;
const MIN_KEYWORD_SCORE = 0.3;
const MIN_HYBRID_SCORE = 0.36;

const eventSelect = {
  id: true,
  kind: true,
  status: true,
  summary: true,
  reasoning: true,
  tags: true,
  createdAt: true,
  resolvedAt: true,
  supersededByEventId: true,
  author: { select: { id: true, username: true, email: true } },
  task: { select: { shortId: true, title: true } },
} satisfies Prisma.MemoryEventSelect;

export type MemoryEventRow = {
  id: string;
  kind: MemoryEventKind;
  status: MemoryEventStatus;
  summary: string;
  reasoning: string | null;
  tags: string[];
  createdAt: Date;
  resolvedAt: Date | null;
  supersededByEventId: string | null;
  author: { id: string; username: string; email: string | null } | null;
  task: { shortId: number; title: string } | null;
};

export type MemoryRecallHit = MemoryEventRow & { score: number };

async function requireMembership(userId: string, workspaceId: string) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }
  return membership;
}

async function resolveTaskId(
  workspaceId: string,
  shortId: number
): Promise<string> {
  const task = await prisma.task.findFirst({
    where: { workspaceId, shortId },
    select: { id: true },
  });
  if (!task) {
    throw new ServiceError(
      `Task #${shortId} not found in this workspace`,
      "NOT_FOUND"
    );
  }
  return task.id;
}

const MAX_TAGS = 4;
const MAX_TAG_LENGTH = 32;

/** Lowercase, kebab-ish, deduped, capped — judges and humans both feed this. */
export function normalizeMemoryTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const tag = raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/^#/, "")
      .slice(0, MAX_TAG_LENGTH);
    if (tag) seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}

export function memoryEventDocument(event: {
  summary: string;
  reasoning?: string | null;
  tags?: string[];
}): string {
  const parts = [event.summary];
  if (event.reasoning) parts.push(event.reasoning);
  if (event.tags && event.tags.length > 0) parts.push(event.tags.join(" "));
  return parts.join("\n");
}

/** (Re)embed one memory event. No-op when the embedding API is unset. */
export async function indexMemoryEventEmbedding(eventId: string): Promise<void> {
  if (!embeddingsEnabled()) return;

  const event = await prisma.memoryEvent.findUnique({
    where: { id: eventId },
    select: { summary: true, reasoning: true, tags: true, contentHash: true },
  });
  if (!event) return;

  const document = memoryEventDocument(event);
  const contentHash = hashContent(document);
  if (event.contentHash === contentHash) return;

  const vector = await embedText(document);
  await prisma.memoryEvent.update({
    where: { id: eventId },
    data: { embedding: vector, contentHash },
  });
}

export function scheduleMemoryEventEmbeddingIndex(eventId: string): void {
  if (!embeddingsEnabled()) return;
  scheduleBackgroundTask("memory event embed", () =>
    indexMemoryEventEmbedding(eventId)
  );
}

export type CreateMemoryEventInput = {
  workspaceId: string;
  /** Acting user (membership-checked). Also the recorded author unless authorId is set. */
  userId: string;
  kind: MemoryEventKind;
  summary: string;
  reasoning?: string;
  /** Task shortId within the workspace; omit for workspace-level events. */
  taskShortId?: number;
  /** Provenance: the TaskUpdate this was extracted from. */
  sourceUpdateId?: string;
  /** Original speaker when the capture pipeline records on someone's behalf. */
  authorId?: string;
  /** Older decision this event supersedes (linked, never deleted). */
  supersedesEventId?: string;
  /** Topic tags ("auth", "payments") — normalized, max 4. */
  tags?: string[];
  /** Backfill only: preserve the original moment the event happened. */
  createdAt?: Date;
};

export async function createMemoryEvent(
  input: CreateMemoryEventInput
): Promise<MemoryEventRow> {
  await requireMembership(input.userId, input.workspaceId);

  const summary = input.summary.trim();
  if (!summary) {
    throw new ServiceError("Memory summary can't be empty", "INVALID_INPUT");
  }
  if (summary.length > MAX_MEMORY_SUMMARY) {
    throw new ServiceError(
      `Summary is too long (max ${MAX_MEMORY_SUMMARY} characters)`,
      "INVALID_INPUT"
    );
  }
  const reasoning = input.reasoning?.trim().slice(0, MAX_MEMORY_REASONING) || null;

  const taskId =
    input.taskShortId !== undefined
      ? await resolveTaskId(input.workspaceId, input.taskShortId)
      : null;

  // Decisions and milestones are facts, not open work.
  const status: MemoryEventStatus =
    input.kind === "BLOCKER" || input.kind === "DEPENDENCY"
      ? "OPEN"
      : "RESOLVED";

  const event = await prisma.memoryEvent.create({
    data: {
      workspaceId: input.workspaceId,
      taskId,
      sourceUpdateId: input.sourceUpdateId ?? null,
      kind: input.kind,
      status,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
      summary,
      reasoning,
      tags: normalizeMemoryTags(input.tags),
      authorId: input.authorId ?? input.userId,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
    select: eventSelect,
  });

  if (input.supersedesEventId && input.kind === "DECISION") {
    // Guardrails on top of caller checks: only a DECISION in the same
    // workspace can be superseded (never an open blocker — that would hide
    // open work), and only by another DECISION. Silently a no-op otherwise.
    await prisma.memoryEvent
      .updateMany({
        where: {
          id: input.supersedesEventId,
          workspaceId: input.workspaceId,
          kind: "DECISION",
        },
        data: { supersededByEventId: event.id },
      })
      .catch(() => {
        // Superseded target may have been deleted; the new event stands alone.
      });
  }

  scheduleMemoryEventEmbeddingIndex(event.id);
  return event;
}

export type ListMemoryEventsInput = {
  workspaceId: string;
  userId: string;
  taskShortId?: number;
  kind?: MemoryEventKind;
  status?: MemoryEventStatus;
  /** Filter to events carrying this topic tag. */
  tag?: string;
  includeSuperseded?: boolean;
  limit?: number;
};

export async function listMemoryEvents(
  input: ListMemoryEventsInput
): Promise<MemoryEventRow[]> {
  await requireMembership(input.userId, input.workspaceId);

  const where: Prisma.MemoryEventWhereInput = {
    workspaceId: input.workspaceId,
  };
  if (input.taskShortId !== undefined) {
    where.taskId = await resolveTaskId(input.workspaceId, input.taskShortId);
  }
  if (input.kind) where.kind = input.kind;
  if (input.status) where.status = input.status;
  if (input.tag) where.tags = { has: input.tag.trim().toLowerCase() };
  if (!input.includeSuperseded) where.supersededByEventId = null;

  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_LIST_LIMIT),
    MAX_LIST_LIMIT
  );

  return prisma.memoryEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: eventSelect,
  });
}

/** Open blockers/dependencies for a task — used to enrich read_task/ask_task. */
export async function getOpenBlockersForTask(
  workspaceId: string,
  taskId: string
): Promise<MemoryEventRow[]> {
  return prisma.memoryEvent.findMany({
    where: {
      workspaceId,
      taskId,
      status: "OPEN",
      kind: { in: ["BLOCKER", "DEPENDENCY"] },
      supersededByEventId: null,
    },
    orderBy: { createdAt: "asc" },
    select: eventSelect,
  });
}

/** Same as getOpenBlockersForTask but by #N; [] when the task doesn't exist. */
export async function getOpenBlockersForTaskShortId(
  workspaceId: string,
  shortId: number
): Promise<MemoryEventRow[]> {
  const task = await prisma.task.findFirst({
    where: { workspaceId, shortId },
    select: { id: true },
  });
  if (!task) return [];
  return getOpenBlockersForTask(workspaceId, task.id);
}

export async function resolveMemoryEvent(input: {
  workspaceId: string;
  userId: string;
  eventId: string;
  resolvedByUpdateId?: string;
}): Promise<MemoryEventRow> {
  await requireMembership(input.userId, input.workspaceId);

  const existing = await prisma.memoryEvent.findFirst({
    where: { id: input.eventId, workspaceId: input.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new ServiceError("Memory event not found", "NOT_FOUND");
  }
  if (existing.status === "RESOLVED") {
    return prisma.memoryEvent.findUniqueOrThrow({
      where: { id: existing.id },
      select: eventSelect,
    });
  }

  const resolved = await prisma.memoryEvent.update({
    where: { id: existing.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedById: input.userId,
      resolvedByUpdateId: input.resolvedByUpdateId ?? null,
    },
    select: eventSelect,
  });

  bumpMemoryMetric(input.workspaceId, "resolution_confirmed");

  scheduleBackgroundTask("blocker resolved notify", async () => {
    const { notifyBlockerResolved } = await import("@/lib/whatsapp-notify");
    await notifyBlockerResolved({
      workspaceId: input.workspaceId,
      authorUserId: resolved.author?.id ?? null,
      resolvedByUserId: input.userId,
      summary: resolved.summary,
      task: resolved.task,
    });
  });

  return resolved;
}

/** Mark a blocker as "don't suggest resolution again" after a decline. */
export async function suppressMemorySuggestions(
  workspaceId: string,
  eventId: string
): Promise<void> {
  await prisma.memoryEvent.updateMany({
    where: { id: eventId, workspaceId },
    data: { suggestionsSuppressed: true },
  });
}

export type RecallMemoryInput = {
  workspaceId: string;
  userId: string;
  query: string;
  taskShortId?: number;
  kind?: MemoryEventKind;
  status?: MemoryEventStatus;
  /** Filter to events carrying this topic tag. */
  tag?: string;
  limit?: number;
};

/**
 * Hybrid recall over memory events: semantic (cosine over stored vectors) +
 * keyword, keyword-only fallback when no embedding key is configured.
 * Superseded events are excluded — recall answers with current truth.
 */
export async function recallMemory(
  input: RecallMemoryInput
): Promise<MemoryRecallHit[]> {
  await requireMembership(input.userId, input.workspaceId);

  const query = input.query.trim();
  if (!query) return [];

  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_RECALL_LIMIT),
    MAX_RECALL_LIMIT
  );

  const where: Prisma.MemoryEventWhereInput = {
    workspaceId: input.workspaceId,
    supersededByEventId: null,
  };
  if (input.taskShortId !== undefined) {
    where.taskId = await resolveTaskId(input.workspaceId, input.taskShortId);
  }
  if (input.kind) where.kind = input.kind;
  if (input.status) where.status = input.status;
  if (input.tag) where.tags = { has: input.tag.trim().toLowerCase() };

  const candidates = await prisma.memoryEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { ...eventSelect, embedding: true },
  });
  if (candidates.length === 0) return [];

  let queryVector: number[] | null = null;
  if (embeddingsEnabled()) {
    try {
      queryVector = await embedText(query);
    } catch (err) {
      console.error("[memory] recall embed failed, keyword fallback:", err);
    }
  }

  const hits: MemoryRecallHit[] = [];
  for (const candidate of candidates) {
    const { embedding, ...row } = candidate;
    const keywordScore = scoreTaskTitleQuery(
      query,
      row.summary,
      [row.reasoning, row.tags.join(" ")].filter(Boolean).join("\n")
    );

    let sem: number | null = null;
    const stored = parseEmbeddingJson(embedding);
    if (stored && queryVector) {
      sem = semanticScore(cosineSimilarity(queryVector, stored));
    }

    const score =
      sem !== null
        ? SEMANTIC_WEIGHT * sem + KEYWORD_WEIGHT * keywordScore
        : keywordScore;

    if (score < MIN_HYBRID_SCORE && keywordScore < MIN_KEYWORD_SCORE) continue;
    hits.push({ ...row, score });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Walk the supersession chain for one event (oldest → newest). */
export async function getDecisionHistory(
  workspaceId: string,
  userId: string,
  eventId: string
): Promise<MemoryEventRow[]> {
  await requireMembership(userId, workspaceId);

  const chain: MemoryEventRow[] = [];
  let currentId: string | null = eventId;
  // Follow "superseded by" links forward, then prepend predecessors.
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const event: (MemoryEventRow & { supersededByEventId: string | null }) | null =
      await prisma.memoryEvent.findFirst({
        where: { id: currentId, workspaceId },
        select: eventSelect,
      });
    if (!event) break;
    chain.push(event);
    currentId = event.supersededByEventId;
  }
  return chain;
}
