import { prisma } from "@/lib/prisma";
import { displayUser } from "@/lib/username";

const DAY_MS = 86_400_000;

export type AIUsageRollup = {
  label: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  tokensSaved: number;
  estimatedCostUsd: number;
  averageLatencyMs: number;
};

export type AdminAIAnalytics = {
  generatedAt: string;
  summary: {
    calls1d: number;
    calls7d: number;
    calls30d: number;
    tokens30d: number;
    tokensSaved30d: number;
    estimatedCost1d: number;
    estimatedCost7d: number;
    estimatedCost30d: number;
    errors30d: number;
  };
  byFeature: AIUsageRollup[];
  byModel: AIUsageRollup[];
  byWorkspace: AIUsageRollup[];
  byUser: AIUsageRollup[];
  daily: {
    day: string;
    calls: number;
    tokens: number;
    tokensSaved: number;
    estimatedCostUsd: number;
  }[];
};

type GroupRow = {
  _count: { _all: number };
  _sum: {
    inputTokens: number | null;
    outputTokens: number | null;
    cacheReadTokens: number | null;
    estimatedTokensSaved: number | null;
    estimatedCostUsd: number | null;
    durationMs: number | null;
  };
};

function rollup(label: string, row: GroupRow): AIUsageRollup {
  const calls = row._count._all;
  return {
    label,
    calls,
    inputTokens: row._sum.inputTokens ?? 0,
    outputTokens: row._sum.outputTokens ?? 0,
    cacheReadTokens: row._sum.cacheReadTokens ?? 0,
    tokensSaved: row._sum.estimatedTokensSaved ?? 0,
    estimatedCostUsd: row._sum.estimatedCostUsd ?? 0,
    averageLatencyMs:
      calls > 0 ? Math.round((row._sum.durationMs ?? 0) / calls) : 0,
  };
}

const SUMS = {
  inputTokens: true,
  outputTokens: true,
  cacheReadTokens: true,
  estimatedTokensSaved: true,
  estimatedCostUsd: true,
  durationMs: true,
} as const;

export async function getAdminAIAnalytics(): Promise<AdminAIAnalytics> {
  const now = Date.now();
  const since1d = new Date(now - DAY_MS);
  const since7d = new Date(now - 7 * DAY_MS);
  const since14d = new Date(now - 14 * DAY_MS);
  const since30d = new Date(now - 30 * DAY_MS);

  const [
    totals1d,
    totals7d,
    totals30d,
    featureRows,
    modelRows,
    workspaceRows,
    userRows,
    dailyRows,
    errors30d,
    saved30d,
  ] = await Promise.all([
    prisma.aIUsageRecord.aggregate({
      where: { createdAt: { gte: since1d }, provider: { not: "internal" } },
      _count: { _all: true },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.aIUsageRecord.aggregate({
      where: { createdAt: { gte: since7d }, provider: { not: "internal" } },
      _count: { _all: true },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.aIUsageRecord.aggregate({
      where: { createdAt: { gte: since30d }, provider: { not: "internal" } },
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        estimatedTokensSaved: true,
        estimatedCostUsd: true,
      },
    }),
    prisma.aIUsageRecord.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: since30d } },
      _count: { _all: true },
      _sum: SUMS,
    }),
    prisma.aIUsageRecord.groupBy({
      by: ["model"],
      where: { createdAt: { gte: since30d } },
      _count: { _all: true },
      _sum: SUMS,
    }),
    prisma.aIUsageRecord.groupBy({
      by: ["workspaceId"],
      where: { createdAt: { gte: since30d }, workspaceId: { not: null } },
      _count: { _all: true },
      _sum: SUMS,
    }),
    prisma.aIUsageRecord.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since30d }, userId: { not: null } },
      _count: { _all: true },
      _sum: SUMS,
    }),
    prisma.aIUsageRecord.findMany({
      where: { createdAt: { gte: since14d } },
      select: {
        createdAt: true,
        inputTokens: true,
        outputTokens: true,
        estimatedTokensSaved: true,
        estimatedCostUsd: true,
      },
    }),
    prisma.aIUsageRecord.count({
      where: { createdAt: { gte: since30d }, status: "ERROR" },
    }),
    prisma.aIUsageRecord.aggregate({
      where: { createdAt: { gte: since30d } },
      _sum: { estimatedTokensSaved: true },
    }),
  ]);

  const workspaceIds = workspaceRows
    .map((row) => row.workspaceId)
    .filter((id): id is string => Boolean(id));
  const userIds = userRows
    .map((row) => row.userId)
    .filter((id): id is string => Boolean(id));
  const [workspaces, users] = await Promise.all([
    prisma.workspace.findMany({
      where: { id: { in: workspaceIds } },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, email: true },
    }),
  ]);
  const workspaceNames = new Map(workspaces.map((row) => [row.id, row.name]));
  const userNames = new Map(
    users.map((user) => [user.id, displayUser(user)])
  );

  const dailyMap = new Map<
    string,
    {
      day: string;
      calls: number;
      tokens: number;
      tokensSaved: number;
      estimatedCostUsd: number;
    }
  >();
  for (let index = 13; index >= 0; index--) {
    const day = new Date(now - index * DAY_MS).toISOString().slice(0, 10);
    dailyMap.set(day, {
      day,
      calls: 0,
      tokens: 0,
      tokensSaved: 0,
      estimatedCostUsd: 0,
    });
  }
  for (const row of dailyRows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const bucket = dailyMap.get(day);
    if (!bucket) continue;
    bucket.calls++;
    bucket.tokens += row.inputTokens + row.outputTokens;
    bucket.tokensSaved += row.estimatedTokensSaved;
    bucket.estimatedCostUsd += row.estimatedCostUsd;
  }

  const sortCost = (a: AIUsageRollup, b: AIUsageRollup) =>
    b.estimatedCostUsd - a.estimatedCostUsd;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      calls1d: totals1d._count._all,
      calls7d: totals7d._count._all,
      calls30d: totals30d._count._all,
      tokens30d:
        (totals30d._sum.inputTokens ?? 0) +
        (totals30d._sum.outputTokens ?? 0),
      tokensSaved30d: saved30d._sum.estimatedTokensSaved ?? 0,
      estimatedCost1d: totals1d._sum.estimatedCostUsd ?? 0,
      estimatedCost7d: totals7d._sum.estimatedCostUsd ?? 0,
      estimatedCost30d: totals30d._sum.estimatedCostUsd ?? 0,
      errors30d,
    },
    byFeature: featureRows
      .map((row) => rollup(row.feature, row))
      .sort(sortCost),
    byModel: modelRows.map((row) => rollup(row.model, row)).sort(sortCost),
    byWorkspace: workspaceRows
      .map((row) =>
        rollup(
          workspaceNames.get(row.workspaceId ?? "") ?? "Unknown workspace",
          row
        )
      )
      .sort(sortCost),
    byUser: userRows
      .map((row) =>
        rollup(userNames.get(row.userId ?? "") ?? "Unknown user", row)
      )
      .sort(sortCost),
    daily: [...dailyMap.values()],
  };
}
