import { prisma } from "@/lib/prisma";
import { getActorMembership, ServiceError } from "@/lib/services/project";
import { workspaceFeature } from "@/lib/billing/entitlements";
import { displayUser } from "@/lib/username";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;

export type DailyPoint = { day: string; count: number };
export type LabelCount = { label: string; count: number };
export type OpenBlocker = {
  id: string;
  summary: string;
  taskShortId: number | null;
  ageDays: number;
};

export type WorkspaceMemoryAnalytics = {
  headline: {
    decisions: number;
    openBlockers: number;
    insights: number;
    documents: number;
    activeMemory: number;
  };
  capture: {
    events7d: number;
    events30d: number;
    daily: DailyPoint[];
    bySource: {
      agent: number;
      document: number;
      discussion: number;
      taskUpdate: number;
      explicit: number;
    };
  };
  blockers: {
    open: number;
    resolved30d: number;
    oldestOpenAgeDays: number | null;
    medianResolutionDays: number | null;
    oldest: OpenBlocker[];
  };
  curation: {
    reviewedPct: number;
    unreviewed: number;
    superseded: number;
    archived: number;
    dreamRuns30d: number;
    merged30d: number;
    insights30d: number;
    archived30d: number;
    lastDream:
      | { at: string; merged: number; superseded: number; insights: number }
      | null;
  };
  contributors: LabelCount[];
  topics: LabelCount[];
  usage: {
    recall30d: number;
    contextPull30d: number;
    briefs30d: number;
    briefAvgChars: number;
    agentSeats: number;
  };
  documentReviews: {
    accepted30d: number;
    rejected30d: number;
    rejected: {
      path: string;
      title: string | null;
      reason: string;
      explicit: boolean;
      reviewedAt: string;
    }[];
  };
};

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Workspace-scoped memory analytics for the workspace leader (Team+).
 * Leadership-gated and entitlement-gated; throws otherwise.
 */
export async function getWorkspaceMemoryAnalytics(
  workspaceId: string,
  userId: string
): Promise<WorkspaceMemoryAnalytics> {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }
  if (membership.role !== "LEADER" && membership.role !== "SUB_LEADER") {
    throw new ServiceError("Leader analytics is leaders only", "FORBIDDEN");
  }
  if (!(await workspaceFeature(workspaceId, "leaderAnalytics"))) {
    throw new ServiceError(
      "Leader analytics is available on the Team plan",
      "UPGRADE_REQUIRED"
    );
  }

  const active = { supersededByEventId: null, archivedAt: null } as const;
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * DAY_MS);
  const since30d = new Date(now.getTime() - 30 * DAY_MS);
  const trendStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      (TREND_DAYS - 1) * DAY_MS
  );

  const [
    byKind,
    documentCount,
    events7d,
    events30d,
    trendRows,
    metrics30d,
    openBlockerRows,
    resolvedBlockerRows,
    unreviewed,
    reviewed,
    superseded,
    archived,
    lastDream,
    contributorGroups,
    tagRows,
    agentSeats,
    documentReviewCounts,
    rejectedDocuments,
  ] = await Promise.all([
    prisma.memoryEvent.groupBy({
      by: ["kind"],
      where: { workspaceId, ...active },
      _count: { _all: true },
    }),
    prisma.memoryDocument.count({ where: { workspaceId } }),
    prisma.memoryEvent.count({
      where: { workspaceId, createdAt: { gte: since7d } },
    }),
    prisma.memoryEvent.count({
      where: { workspaceId, createdAt: { gte: since30d } },
    }),
    prisma.memoryEvent.findMany({
      where: { workspaceId, createdAt: { gte: trendStart } },
      select: { createdAt: true },
    }),
    prisma.memoryMetric.groupBy({
      by: ["metric"],
      where: { workspaceId, day: { gte: since30d } },
      _sum: { count: true, sum: true },
    }),
    prisma.memoryEvent.findMany({
      where: {
        workspaceId,
        ...active,
        status: "OPEN",
        kind: { in: ["BLOCKER", "DEPENDENCY"] },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        summary: true,
        createdAt: true,
        task: { select: { shortId: true } },
      },
    }),
    prisma.memoryEvent.findMany({
      where: {
        workspaceId,
        kind: { in: ["BLOCKER", "DEPENDENCY"] },
        status: "RESOLVED",
        resolvedAt: { gte: since30d, not: null },
      },
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.memoryEvent.count({
      where: { workspaceId, ...active, dreamedAt: null },
    }),
    prisma.memoryEvent.count({
      where: { workspaceId, ...active, dreamedAt: { not: null } },
    }),
    prisma.memoryEvent.count({
      where: { workspaceId, supersededByEventId: { not: null } },
    }),
    prisma.memoryEvent.count({
      where: { workspaceId, archivedAt: { not: null } },
    }),
    prisma.memoryDreamRun.findFirst({
      where: { workspaceId, skipped: null },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        merged: true,
        superseded: true,
        insights: true,
      },
    }),
    prisma.memoryEvent.groupBy({
      by: ["authorId"],
      where: { workspaceId, ...active, authorId: { not: null } },
      _count: { _all: true },
    }),
    prisma.memoryEvent.findMany({
      where: { workspaceId, ...active },
      select: { tags: true },
    }),
    prisma.agentSeat.count({ where: { workspaceId } }),
    prisma.memoryDocumentReview.groupBy({
      by: ["accepted"],
      where: { workspaceId, reviewedAt: { gte: since30d } },
      _count: { _all: true },
    }),
    prisma.memoryDocumentReview.findMany({
      where: { workspaceId, accepted: false },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      select: {
        path: true,
        title: true,
        reason: true,
        explicit: true,
        reviewedAt: true,
      },
    }),
  ]);

  const kindCount = (kind: string) =>
    byKind.find((r) => r.kind === kind)?._count._all ?? 0;
  const activeMemory = byKind.reduce((sum, r) => sum + r._count._all, 0);

  // Capture trend (last TREND_DAYS days, UTC buckets)
  const bucket = new Map<string, number>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(trendStart.getTime() + i * DAY_MS);
    bucket.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of trendRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    if (bucket.has(key)) bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }
  const daily: DailyPoint[] = [...bucket.entries()].map(([day, count]) => ({
    day,
    count,
  }));

  const metric = (name: string) =>
    metrics30d.find((m) => m.metric === name)?._sum.count ?? 0;
  const metricSum = (name: string) =>
    metrics30d.find((m) => m.metric === name)?._sum.sum ?? 0;

  // Blocker resolution time (median, days)
  const resolutionDays = resolvedBlockerRows
    .filter((r) => r.resolvedAt)
    .map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / DAY_MS);
  const medianResolutionDays = median(resolutionDays);
  const medianRounded =
    medianResolutionDays === null
      ? null
      : Math.round(medianResolutionDays * 10) / 10;

  const oldest: OpenBlocker[] = openBlockerRows.slice(0, 5).map((b) => ({
    id: b.id,
    summary: b.summary,
    taskShortId: b.task?.shortId ?? null,
    ageDays: daysBetween(b.createdAt, now),
  }));
  const oldestOpenAgeDays =
    openBlockerRows.length > 0
      ? daysBetween(openBlockerRows[0].createdAt, now)
      : null;

  // Contributors (top 5 by authored events)
  const authorIds = contributorGroups
    .map((g) => g.authorId)
    .filter((id): id is string => Boolean(id));
  const users =
    authorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, username: true, email: true },
        })
      : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const contributors: LabelCount[] = contributorGroups
    .map((g) => ({
      label: g.authorId
        ? displayUser(userById.get(g.authorId) ?? { username: null, email: null })
        : "Unknown",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Topics (top 5 tags)
  const tagFreq = new Map<string, number>();
  for (const row of tagRows) {
    for (const tag of row.tags) {
      tagFreq.set(tag, (tagFreq.get(tag) ?? 0) + 1);
    }
  }
  const topics: LabelCount[] = [...tagFreq.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const reviewedTotal = reviewed + unreviewed;
  const reviewedPct =
    reviewedTotal > 0 ? Math.round((reviewed / reviewedTotal) * 100) : 100;

  const briefs30d = metric("brief_built");

  return {
    headline: {
      decisions: kindCount("DECISION"),
      openBlockers: openBlockerRows.length,
      insights: kindCount("INSIGHT"),
      documents: documentCount,
      activeMemory,
    },
    capture: {
      events7d,
      events30d,
      daily,
      bySource: {
        agent: metric("event_created_agent"),
        document: metric("event_created_document"),
        discussion: metric("event_created_post"),
        taskUpdate: metric("event_created_thread"),
        explicit: metric("event_created_explicit"),
      },
    },
    blockers: {
      open: openBlockerRows.length,
      resolved30d: resolvedBlockerRows.length,
      oldestOpenAgeDays,
      medianResolutionDays: medianRounded,
      oldest,
    },
    curation: {
      reviewedPct,
      unreviewed,
      superseded,
      archived,
      dreamRuns30d: metric("dream_run"),
      merged30d: metric("dream_merge"),
      insights30d: metric("dream_insight"),
      archived30d: metric("dream_archive"),
      lastDream: lastDream
        ? {
            at: lastDream.createdAt.toISOString(),
            merged: lastDream.merged,
            superseded: lastDream.superseded,
            insights: lastDream.insights,
          }
        : null,
    },
    contributors,
    topics,
    usage: {
      recall30d: metric("recall_query"),
      contextPull30d: metric("context_pull"),
      briefs30d,
      briefAvgChars: briefs30d > 0 ? Math.round(metricSum("brief_built") / briefs30d) : 0,
      agentSeats,
    },
    documentReviews: {
      accepted30d:
        documentReviewCounts.find((row) => row.accepted)?._count._all ?? 0,
      rejected30d:
        documentReviewCounts.find((row) => !row.accepted)?._count._all ?? 0,
      rejected: rejectedDocuments.map((document) => ({
        ...document,
        reviewedAt: document.reviewedAt.toISOString(),
      })),
    },
  };
}
