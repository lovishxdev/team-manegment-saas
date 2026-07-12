import type {
  MemoryCandidateAuthority,
  MemoryCandidateScope,
  MemoryCandidateStatus,
  MemoryEventKind,
  MemoryFeedbackReason,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError, getActorMembership } from "@/lib/services/project";
import {
  createMemoryEvent,
  normalizeMemoryTags,
} from "@/lib/services/memory";
import type { CandidateCritique } from "@/lib/memory/candidate-critic";
import { isNearDuplicate } from "@/lib/memory/similarity";
import { bumpMemoryMetric } from "@/lib/memory/metrics";

export type MemoryCandidateView = {
  id: string;
  kind: MemoryEventKind;
  scope: MemoryCandidateScope;
  authority: MemoryCandidateAuthority;
  status: MemoryCandidateStatus;
  summary: string;
  reasoning: string | null;
  evidenceQuote: string | null;
  tags: string[];
  durabilityScore: number;
  coordinationScore: number;
  codeRecoverable: boolean;
  localReversible: boolean;
  criticReason: string | null;
  createdAt: Date;
  task: { shortId: number; title: string } | null;
  sourceDocument: { path: string; title: string } | null;
};

const candidateSelect = {
  id: true,
  kind: true,
  scope: true,
  authority: true,
  status: true,
  summary: true,
  reasoning: true,
  evidenceQuote: true,
  tags: true,
  durabilityScore: true,
  coordinationScore: true,
  codeRecoverable: true,
  localReversible: true,
  criticReason: true,
  createdAt: true,
  task: { select: { shortId: true, title: true } },
  sourceDocument: { select: { path: true, title: true } },
} as const;

function initialStatus(critique: CandidateCritique): MemoryCandidateStatus {
  if (
    critique.kind === "BLOCKER" ||
    critique.kind === "DEPENDENCY"
  ) {
    return critique.scope !== "SESSION" &&
      critique.recommendation !== "REJECT" &&
      critique.coordinationScore >= 75 &&
      !critique.codeRecoverable
      ? "PENDING"
      : "REJECTED";
  }
  if (critique.scope !== "PROJECT") return "REJECTED";
  if (
    critique.recommendation === "REJECT" ||
    critique.durabilityScore < 85 ||
    critique.codeRecoverable ||
    critique.localReversible
  ) {
    return "REJECTED";
  }
  // Inferred agent claims are never canonical without a human/repeated
  // cross-session review, regardless of model confidence.
  if (critique.authority === "AGENT_INFERRED") return "PENDING";
  return critique.recommendation === "PROMOTE" ? "PENDING" : "PENDING";
}

export function qualifiesForAutomaticPromotion(
  critique: CandidateCritique
): boolean {
  if (
    critique.kind === "BLOCKER" ||
    critique.kind === "DEPENDENCY"
  ) {
    return (
      critique.scope !== "SESSION" &&
      critique.recommendation !== "REJECT" &&
      critique.coordinationScore >= 75 &&
      !critique.codeRecoverable
    );
  }
  return (
    critique.scope === "PROJECT" &&
    critique.authority !== "AGENT_INFERRED" &&
    critique.recommendation === "PROMOTE" &&
    critique.durabilityScore >= 85 &&
    !critique.codeRecoverable &&
    !critique.localReversible
  );
}

async function resolveCandidateTaskId(
  workspaceId: string,
  shortId: number | undefined
): Promise<string | null> {
  if (shortId === undefined) return null;
  const task = await prisma.task.findFirst({
    where: { workspaceId, shortId },
    select: { id: true },
  });
  return task?.id ?? null;
}

export async function createMemoryCandidate(input: {
  workspaceId: string;
  userId: string;
  conversationId: string;
  critique: CandidateCritique;
  sourceDocumentId?: string;
}): Promise<MemoryCandidateView | null> {
  const recent = await prisma.memoryCandidate.findMany({
    where: {
      workspaceId: input.workspaceId,
      kind: input.critique.kind,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      status: { in: ["PENDING", "PROMOTED", "REJECTED"] },
    },
    select: { summary: true },
    take: 100,
  });
  const existingEvents = await prisma.memoryEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      archivedAt: null,
      supersededByEventId: null,
    },
    select: { summary: true },
    take: 200,
  });
  if (
    [...recent, ...existingEvents].some((existing) =>
      isNearDuplicate(input.critique.summary, existing.summary)
    )
  ) {
    bumpMemoryMetric(input.workspaceId, "event_skipped_duplicate");
    return null;
  }

  const taskId = await resolveCandidateTaskId(
    input.workspaceId,
    input.critique.taskShortId
  );
  const candidate = await prisma.memoryCandidate.create({
    data: {
      workspaceId: input.workspaceId,
      taskId,
      sourceDocumentId: input.sourceDocumentId ?? null,
      authorId: input.userId,
      conversationId: input.conversationId,
      supersedesEventId: input.critique.supersedesEventId ?? null,
      kind: input.critique.kind,
      scope: input.critique.scope,
      authority: input.critique.authority,
      status: initialStatus(input.critique),
      summary: input.critique.summary.slice(0, 500),
      reasoning: input.critique.reasoning?.slice(0, 2000) ?? null,
      evidenceQuote: input.critique.evidenceQuote.slice(0, 1000),
      tags: normalizeMemoryTags(input.critique.tags),
      durabilityScore: input.critique.durabilityScore,
      coordinationScore: input.critique.coordinationScore,
      codeRecoverable: input.critique.codeRecoverable,
      localReversible: input.critique.localReversible,
      criticReason: input.critique.criticReason.slice(0, 2000),
      reviewedAt:
        initialStatus(input.critique) === "REJECTED" ? new Date() : null,
    },
    select: candidateSelect,
  });
  bumpMemoryMetric(input.workspaceId, "candidate_created");
  if (candidate.status === "REJECTED") {
    bumpMemoryMetric(input.workspaceId, "candidate_rejected");
  }
  return candidate;
}

export async function promoteMemoryCandidate(input: {
  candidateId: string;
  actingUserId: string;
  requireLeader?: boolean;
}): Promise<{ eventId: string; summary: string }> {
  const candidate = await prisma.memoryCandidate.findUnique({
    where: { id: input.candidateId },
    include: {
      workspace: { select: { id: true } },
      task: { select: { shortId: true } },
      sourceDocument: { select: { id: true, path: true, contentHash: true } },
      supersedesEvent: { select: { id: true } },
    },
  });
  if (!candidate) throw new ServiceError("Memory candidate not found", "NOT_FOUND");
  if (candidate.status === "PROMOTED" && candidate.promotedEventId) {
    return { eventId: candidate.promotedEventId, summary: candidate.summary };
  }
  const membership = await getActorMembership(
    input.actingUserId,
    candidate.workspaceId
  );
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }
  if (
    input.requireLeader &&
    membership.role !== "LEADER" &&
    membership.role !== "SUB_LEADER"
  ) {
    throw new ServiceError("Only workspace leaders can curate memory", "FORBIDDEN");
  }

  const event = await createMemoryEvent({
    workspaceId: candidate.workspaceId,
    userId: input.actingUserId,
    authorId: candidate.authorId ?? input.actingUserId,
    kind: candidate.kind,
    summary: candidate.summary,
    reasoning: candidate.reasoning ?? undefined,
    tags: candidate.tags,
    taskShortId: candidate.task?.shortId,
    sourceDocumentId: candidate.sourceDocument?.id,
    sourceDocumentPath: candidate.sourceDocument?.path,
    sourceDocumentHash: candidate.sourceDocument?.contentHash,
    captureSource: candidate.sourceDocument
      ? "AGENT_DOCUMENT"
      : "AGENT_SESSION",
    supersedesEventId: candidate.supersedesEvent?.id,
  });
  await prisma.memoryCandidate.update({
    where: { id: candidate.id },
    data: {
      status: "PROMOTED",
      promotedEventId: event.id,
      reviewedAt: new Date(),
    },
  });
  bumpMemoryMetric(
    candidate.workspaceId,
    candidate.sourceDocument
      ? "event_created_document"
      : "event_created_agent"
  );
  bumpMemoryMetric(candidate.workspaceId, "candidate_promoted");
  return { eventId: event.id, summary: event.summary };
}

export async function rejectMemoryCandidate(input: {
  candidateId: string;
  actingUserId: string;
  reason?: string;
}): Promise<void> {
  const candidate = await prisma.memoryCandidate.findUnique({
    where: { id: input.candidateId },
    select: { workspaceId: true },
  });
  if (!candidate) throw new ServiceError("Memory candidate not found", "NOT_FOUND");
  const membership = await getActorMembership(
    input.actingUserId,
    candidate.workspaceId
  );
  if (
    !membership ||
    (membership.role !== "LEADER" && membership.role !== "SUB_LEADER")
  ) {
    throw new ServiceError("Only workspace leaders can curate memory", "FORBIDDEN");
  }
  await prisma.memoryCandidate.update({
    where: { id: input.candidateId },
    data: {
      status: "REJECTED",
      criticReason: input.reason?.slice(0, 2000),
      reviewedAt: new Date(),
    },
  });
  bumpMemoryMetric(candidate.workspaceId, "candidate_rejected");
}

export async function listPendingMemoryCandidates(input: {
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<MemoryCandidateView[]> {
  const membership = await getActorMembership(input.userId, input.workspaceId);
  if (
    !membership ||
    (membership.role !== "LEADER" && membership.role !== "SUB_LEADER")
  ) {
    return [];
  }
  return prisma.memoryCandidate.findMany({
    where: { workspaceId: input.workspaceId, status: "PENDING" },
    orderBy: [{ durabilityScore: "desc" }, { createdAt: "desc" }],
    take: Math.min(input.limit ?? 20, 50),
    select: candidateSelect,
  });
}

export async function submitMemoryFeedback(input: {
  workspaceId: string;
  eventId: string;
  userId: string;
  reason: MemoryFeedbackReason;
  note?: string;
}): Promise<void> {
  const membership = await getActorMembership(input.userId, input.workspaceId);
  if (
    !membership ||
    (membership.role !== "LEADER" && membership.role !== "SUB_LEADER")
  ) {
    throw new ServiceError("Only workspace leaders can curate memory", "FORBIDDEN");
  }
  const event = await prisma.memoryEvent.findFirst({
    where: { id: input.eventId, workspaceId: input.workspaceId },
    select: { id: true, status: true },
  });
  if (!event) throw new ServiceError("Memory event not found", "NOT_FOUND");
  if (event.status === "OPEN") {
    throw new ServiceError(
      "Resolve open blockers instead of marking them as memory noise",
      "INVALID_INPUT"
    );
  }

  await prisma.$transaction([
    prisma.memoryFeedback.upsert({
      where: {
        eventId_userId_reason: {
          eventId: input.eventId,
          userId: input.userId,
          reason: input.reason,
        },
      },
      update: { note: input.note?.slice(0, 1000) ?? null },
      create: {
        workspaceId: input.workspaceId,
        eventId: input.eventId,
        userId: input.userId,
        reason: input.reason,
        note: input.note?.slice(0, 1000) ?? null,
      },
    }),
    prisma.memoryEvent.update({
      where: { id: input.eventId },
      data: {
        archivedAt: new Date(),
        archiveReason: `USER_${input.reason}`,
      },
    }),
  ]);
  bumpMemoryMetric(input.workspaceId, "feedback_archived");
}

export async function listArchivedMemoryEvents(input: {
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<
  {
    id: string;
    kind: MemoryEventKind;
    summary: string;
    archiveReason: string | null;
    createdAt: Date;
    archivedAt: Date | null;
  }[]
> {
  const membership = await getActorMembership(input.userId, input.workspaceId);
  if (
    !membership ||
    (membership.role !== "LEADER" && membership.role !== "SUB_LEADER")
  ) {
    return [];
  }
  return prisma.memoryEvent.findMany({
    where: { workspaceId: input.workspaceId, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    take: Math.min(input.limit ?? 20, 50),
    select: {
      id: true,
      kind: true,
      summary: true,
      archiveReason: true,
      createdAt: true,
      archivedAt: true,
    },
  });
}

export async function restoreArchivedMemoryEvent(input: {
  eventId: string;
  actingUserId: string;
}): Promise<void> {
  const event = await prisma.memoryEvent.findUnique({
    where: { id: input.eventId },
    select: { workspaceId: true },
  });
  if (!event) throw new ServiceError("Memory event not found", "NOT_FOUND");
  const membership = await getActorMembership(
    input.actingUserId,
    event.workspaceId
  );
  if (
    !membership ||
    (membership.role !== "LEADER" && membership.role !== "SUB_LEADER")
  ) {
    throw new ServiceError("Only workspace leaders can curate memory", "FORBIDDEN");
  }
  await prisma.memoryEvent.update({
    where: { id: input.eventId },
    data: {
      archivedAt: null,
      archiveReason: null,
      dreamedAt: null,
    },
  });
}
