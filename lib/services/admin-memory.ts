import { prisma } from "@/lib/prisma";
import type { MemoryMetricName } from "@/lib/memory/metrics";

/**
 * Memory-pipeline analytics for the local admin dashboard: is capture
 * precise, is anything being recalled, and how many tokens does the memory
 * layer serve compared to raw history?
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** chars → rough token estimate (English/markdown averages ~4 chars/token). */
const CHARS_PER_TOKEN = 4;

export type AdminMemoryStat = {
  label: string;
  value: string;
  hint?: string;
};

export type AdminMemoryDay = {
  day: string;
  judgeRuns: number;
  eventsCreated: number;
  duplicatesSkipped: number;
  recalls: number;
  contextPulls: number;
  resolutionAsks: number;
  resolutionsConfirmed: number;
};

export type AdminMemoryWorkspace = {
  id: string;
  name: string;
  totalEvents: number;
  openBlockers: number;
  decisions: number;
  documents: number;
  superseded: number;
  events7d: number;
  briefTokens: number | null;
  rawHistoryTokens: number;
};

export type AdminDreamRun = {
  id: string;
  workspaceName: string;
  reviewed: number;
  merged: number;
  superseded: number;
  insights: number;
  archived: number;
  skipped: string | null;
  durationMs: number;
  createdAt: string;
};

export type AdminMemoryAnalytics = {
  generatedAt: string;
  capture: AdminMemoryStat[];
  recall: AdminMemoryStat[];
  dreaming: AdminMemoryStat[];
  tokens: AdminMemoryStat[];
  days: AdminMemoryDay[];
  workspaces: AdminMemoryWorkspace[];
  dreamRuns: AdminDreamRun[];
};

type MetricTotals = Map<MemoryMetricName, { count: number; sum: number }>;

function totalsFrom(
  rows: { metric: string; _sum: { count: number | null; sum: number | null } }[]
): MetricTotals {
  const map: MetricTotals = new Map();
  for (const row of rows) {
    map.set(row.metric as MemoryMetricName, {
      count: row._sum.count ?? 0,
      sum: row._sum.sum ?? 0,
    });
  }
  return map;
}

function count(totals: MetricTotals, metric: MemoryMetricName): number {
  return totals.get(metric)?.count ?? 0;
}

function avgTokens(totals: MetricTotals, metric: MemoryMetricName): number | null {
  const entry = totals.get(metric);
  if (!entry || entry.count === 0) return null;
  return Math.round(entry.sum / entry.count / CHARS_PER_TOKEN);
}

function formatTokens(tokens: number | null): string {
  if (tokens === null) return "—";
  return `~${tokens.toLocaleString()}`;
}

export async function getAdminMemoryAnalytics(): Promise<AdminMemoryAnalytics> {
  const since7d = new Date(Date.now() - 7 * DAY_MS);
  const since14d = new Date(Date.now() - 14 * DAY_MS);

  const [
    totals7d,
    dailyRows,
    eventsByWorkspaceKind,
    openByWorkspace,
    supersededByWorkspace,
    events7dByWorkspace,
    documentsByWorkspace,
    workspaces,
    rawHistoryRows,
    briefByWorkspace,
    unreviewedCount,
    dreamRunRows,
  ] = await Promise.all([
    prisma.memoryMetric.groupBy({
      by: ["metric"],
      where: { day: { gte: since7d } },
      _sum: { count: true, sum: true },
    }),
    prisma.memoryMetric.groupBy({
      by: ["day", "metric"],
      where: { day: { gte: since14d } },
      _sum: { count: true },
    }),
    prisma.memoryEvent.groupBy({
      by: ["workspaceId", "kind"],
      _count: { _all: true },
    }),
    prisma.memoryEvent.groupBy({
      by: ["workspaceId"],
      where: { status: "OPEN" },
      _count: { _all: true },
    }),
    prisma.memoryEvent.groupBy({
      by: ["workspaceId"],
      where: { supersededByEventId: { not: null } },
      _count: { _all: true },
    }),
    prisma.memoryEvent.groupBy({
      by: ["workspaceId"],
      where: { createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.memoryDocument.groupBy({
      by: ["workspaceId"],
      _count: { _all: true },
    }),
    prisma.workspace.findMany({ select: { id: true, name: true } }),
    // Raw-history baseline: what a session would have to read without the
    // memory layer (all update text in the workspace).
    prisma.$queryRaw<{ workspaceId: string; chars: bigint }[]>`
      SELECT "workspaceId", COALESCE(SUM(LENGTH(body)), 0)::bigint AS chars
      FROM "TaskUpdate"
      GROUP BY "workspaceId"
    `,
    prisma.memoryMetric.groupBy({
      by: ["workspaceId"],
      where: { metric: "brief_built", day: { gte: since7d } },
      _sum: { count: true, sum: true },
    }),
    prisma.memoryEvent.count({
      where: {
        dreamedAt: null,
        supersededByEventId: null,
        archivedAt: null,
      },
    }),
    prisma.memoryDreamRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        reviewed: true,
        merged: true,
        superseded: true,
        insights: true,
        archived: true,
        skipped: true,
        durationMs: true,
        createdAt: true,
        workspace: { select: { name: true } },
      },
    }),
  ]);

  const totals = totalsFrom(totals7d);

  const judgeRuns = count(totals, "judge_run");
  const agentEvents = count(totals, "event_created_agent");
  const documentEvents = count(totals, "event_created_document");
  const threadEvents = count(totals, "event_created_thread");
  const postEvents = count(totals, "event_created_post");
  const explicitEvents = count(totals, "event_created_explicit");
  const dupes = count(totals, "event_skipped_duplicate");
  const allCreated =
    agentEvents + documentEvents + threadEvents + postEvents + explicitEvents;

  const capture: AdminMemoryStat[] = [
    {
      label: "Judge runs (7d)",
      value: judgeRuns.toLocaleString(),
      hint: `avg transcript ${formatTokens(avgTokens(totals, "judge_run"))} tokens`,
    },
    {
      label: "Events captured (7d)",
      value: allCreated.toLocaleString(),
      hint: `${agentEvents} agent · ${documentEvents} document · ${threadEvents} task · ${postEvents} discussion · ${explicitEvents} explicit`,
    },
    {
      label: "Events per judge run",
      value:
        judgeRuns > 0
          ? ((agentEvents + documentEvents) / judgeRuns).toFixed(2)
          : "—",
      hint: "healthy is well below 1 — most sessions record nothing",
    },
    {
      label: "Duplicates blocked (7d)",
      value: dupes.toLocaleString(),
      hint: "near-duplicate guard skips",
    },
  ];

  const asks = count(totals, "resolution_ask");
  const confirmed = count(totals, "resolution_confirmed");
  const recall: AdminMemoryStat[] = [
    {
      label: "Recall queries (7d)",
      value: count(totals, "recall_query").toLocaleString(),
      hint: "recall_memory tool",
    },
    {
      label: "Context pulls (7d)",
      value: count(totals, "context_pull").toLocaleString(),
      hint: "get_project_context tool",
    },
    {
      label: "Briefs built (7d)",
      value: count(totals, "brief_built").toLocaleString(),
      hint: "ambient hook refreshes",
    },
    {
      label: "Resolution asks → confirmed (7d)",
      value: `${asks} → ${confirmed}`,
      hint: "all resolutions are human-confirmed",
    },
  ];

  const dreaming: AdminMemoryStat[] = [
    {
      label: "Dream runs (7d)",
      value: count(totals, "dream_run").toLocaleString(),
      hint: "scheduled memory maintenance cycles",
    },
    {
      label: "Duplicates merged (7d)",
      value: count(totals, "dream_merge").toLocaleString(),
      hint: "hidden behind a canonical event",
    },
    {
      label: "Insights surfaced (7d)",
      value: count(totals, "dream_insight").toLocaleString(),
      hint: "cross-event patterns",
    },
    {
      label: "Events archived (7d)",
      value: count(totals, "dream_archive").toLocaleString(),
      hint: "stale resolved rows retired",
    },
    {
      label: "Awaiting review",
      value: unreviewedCount.toLocaleString(),
      hint: "active events not yet seen by a dream",
    },
  ];

  const rawCharsByWorkspace = new Map(
    rawHistoryRows.map((r) => [r.workspaceId, Number(r.chars)])
  );
  const totalRawTokens = Math.round(
    [...rawCharsByWorkspace.values()].reduce((a, b) => a + b, 0) /
      CHARS_PER_TOKEN
  );
  const briefTokens = avgTokens(totals, "brief_built");
  const pullTokens = avgTokens(totals, "context_pull");

  const tokens: AdminMemoryStat[] = [
    {
      label: "Avg brief size",
      value: formatTokens(briefTokens),
      hint: "tokens injected into each new agent session",
    },
    {
      label: "Avg context pull",
      value: formatTokens(pullTokens),
      hint: "tokens per get_project_context response",
    },
    {
      label: "Raw history (all workspaces)",
      value: formatTokens(totalRawTokens),
      hint: "task-update text an agent would otherwise need",
    },
    {
      label: "Compression",
      value:
        briefTokens !== null && totalRawTokens > 0
          ? `${Math.max(1, Math.round(totalRawTokens / Math.max(briefTokens, 1)))}×`
          : "—",
      hint: "raw history vs one brief",
    },
  ];

  const byDay = new Map<string, AdminMemoryDay>();
  for (const row of dailyRows) {
    const day = row.day.toISOString().slice(0, 10);
    const entry =
      byDay.get(day) ??
      ({
        day,
        judgeRuns: 0,
        eventsCreated: 0,
        duplicatesSkipped: 0,
        recalls: 0,
        contextPulls: 0,
        resolutionAsks: 0,
        resolutionsConfirmed: 0,
      } satisfies AdminMemoryDay);
    const n = row._sum.count ?? 0;
    switch (row.metric as MemoryMetricName) {
      case "judge_run":
        entry.judgeRuns += n;
        break;
      case "event_created_agent":
      case "event_created_document":
      case "event_created_thread":
      case "event_created_post":
      case "event_created_explicit":
        entry.eventsCreated += n;
        break;
      case "event_skipped_duplicate":
        entry.duplicatesSkipped += n;
        break;
      case "recall_query":
        entry.recalls += n;
        break;
      case "context_pull":
        entry.contextPulls += n;
        break;
      case "resolution_ask":
        entry.resolutionAsks += n;
        break;
      case "resolution_confirmed":
        entry.resolutionsConfirmed += n;
        break;
      case "brief_built":
      case "dream_run":
      case "dream_merge":
      case "dream_insight":
      case "dream_archive":
        break;
    }
    byDay.set(day, entry);
  }
  const days = [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));

  const kindCounts = new Map<string, Map<string, number>>();
  for (const row of eventsByWorkspaceKind) {
    const inner = kindCounts.get(row.workspaceId) ?? new Map<string, number>();
    inner.set(row.kind, row._count._all);
    kindCounts.set(row.workspaceId, inner);
  }
  const openCounts = new Map(
    openByWorkspace.map((r) => [r.workspaceId, r._count._all])
  );
  const supersededCounts = new Map(
    supersededByWorkspace.map((r) => [r.workspaceId, r._count._all])
  );
  const events7dCounts = new Map(
    events7dByWorkspace.map((r) => [r.workspaceId, r._count._all])
  );
  const documentCounts = new Map(
    documentsByWorkspace.map((r) => [r.workspaceId, r._count._all])
  );
  const briefStats = new Map(
    briefByWorkspace.map((r) => [
      r.workspaceId,
      { count: r._sum.count ?? 0, sum: r._sum.sum ?? 0 },
    ])
  );

  const workspaceRows: AdminMemoryWorkspace[] = workspaces
    .map((ws) => {
      const kinds = kindCounts.get(ws.id);
      const totalEvents = kinds
        ? [...kinds.values()].reduce((a, b) => a + b, 0)
        : 0;
      const brief = briefStats.get(ws.id);
      return {
        id: ws.id,
        name: ws.name,
        totalEvents,
        openBlockers: openCounts.get(ws.id) ?? 0,
        decisions: kinds?.get("DECISION") ?? 0,
        documents: documentCounts.get(ws.id) ?? 0,
        superseded: supersededCounts.get(ws.id) ?? 0,
        events7d: events7dCounts.get(ws.id) ?? 0,
        briefTokens:
          brief && brief.count > 0
            ? Math.round(brief.sum / brief.count / CHARS_PER_TOKEN)
            : null,
        rawHistoryTokens: Math.round(
          (rawCharsByWorkspace.get(ws.id) ?? 0) / CHARS_PER_TOKEN
        ),
      };
    })
    .filter((ws) => ws.totalEvents > 0 || ws.events7d > 0)
    .sort((a, b) => b.totalEvents - a.totalEvents);

  return {
    generatedAt: new Date().toISOString(),
    capture,
    recall,
    dreaming,
    tokens,
    days,
    workspaces: workspaceRows,
    dreamRuns: dreamRunRows.map((run) => ({
      id: run.id,
      workspaceName: run.workspace.name,
      reviewed: run.reviewed,
      merged: run.merged,
      superseded: run.superseded,
      insights: run.insights,
      archived: run.archived,
      skipped: run.skipped,
      durationMs: run.durationMs,
      createdAt: run.createdAt.toISOString(),
    })),
  };
}
