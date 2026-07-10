import { prisma } from "@/lib/prisma";
import type { PlanTier } from "@/lib/generated/prisma/client";
import { displayUser } from "@/lib/username";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

export type AdminStat = {
  label: string;
  value: number;
  hint?: string;
};

export type AdminRecentUser = {
  id: string;
  label: string | null;
  email: string | null;
  phone: string | null;
  whatsappConnected: boolean;
  createdAt: string;
};

export type AdminRecentWorkspace = {
  id: string;
  name: string;
  memberCount: number;
  taskCount: number;
  createdAt: string;
};

export type AdminOverview = {
  generatedAt: string;
  stats: {
    users: AdminStat[];
    workspaces: AdminStat[];
    activity: AdminStat[];
    whatsapp: AdminStat[];
    memory: AdminStat[];
  };
  recentUsers: AdminRecentUser[];
  recentWorkspaces: AdminRecentWorkspace[];
};

export type AdminUserUsage = {
  id: string;
  label: string | null;
  email: string | null;
  phone: string | null;
  whatsappConnected: boolean;
  joinedAt: string;
  workspaceCount: number;
  tasksCreated: number;
  taskUpdates: number;
  assetsUploaded: number;
  linksCreated: number;
  whatsappMessages: number;
  botActions: number;
  activity7d: number;
  lastActiveAt: string | null;
};

export type AdminUserAnalytics = {
  generatedAt: string;
  summary: {
    totalUsers: number;
    active7d: number;
    active30d: number;
    whatsappUsers: number;
  };
  users: AdminUserUsage[];
};

function countByKey<T extends string>(
  rows: Array<Record<T, string | null> & { _count: { _all: number } }>,
  key: T
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = row[key];
    if (!id) continue;
    map.set(id, row._count._all);
  }
  return map;
}

function maxDateByKey<T extends string>(
  rows: Array<Record<T, string | null> & { _max: { createdAt: Date | null } }>,
  key: T
): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const row of rows) {
    const id = row[key];
    const date = row._max.createdAt;
    if (!id || !date) continue;
    map.set(id, date);
  }
  return map;
}

function bumpLastActive(
  map: Map<string, Date>,
  userId: string,
  date: Date | null | undefined
): void {
  if (!date) return;
  const existing = map.get(userId);
  if (!existing || date > existing) map.set(userId, date);
}

/** Per-user usage across web + WhatsApp — sorted by recent activity. */
export async function getAdminUserAnalytics(): Promise<AdminUserAnalytics> {
  const since7d = daysAgo(7);
  const since30d = daysAgo(30);

  const [
    users,
    workspaceCounts,
    tasksCreated,
    tasksCreated7d,
    taskUpdates,
    taskUpdates7d,
    assets,
    assets7d,
    links,
    links7d,
    whatsappMessages,
    whatsappMessages7d,
    botActions,
    botActions7d,
    latestUpdates,
    latestTasks,
    latestWhatsapp,
    latestAssets,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        whatsappChatInitiatedAt: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
    }),
    prisma.workspaceMembership.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["createdById"],
      where: { createdById: { not: null } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["createdById"],
      where: { createdById: { not: null }, createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.taskUpdate.groupBy({
      by: ["authorId"],
      _count: { _all: true },
    }),
    prisma.taskUpdate.groupBy({
      by: ["authorId"],
      where: { createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.asset.groupBy({
      by: ["uploadedById"],
      _count: { _all: true },
    }),
    prisma.asset.groupBy({
      by: ["uploadedById"],
      where: { createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.workspaceLink.groupBy({
      by: ["createdById"],
      _count: { _all: true },
    }),
    prisma.workspaceLink.groupBy({
      by: ["createdById"],
      where: { createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.whatsAppMessage.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.whatsAppMessage.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.botActionLog.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.botActionLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.taskUpdate.groupBy({
      by: ["authorId"],
      _max: { createdAt: true },
    }),
    prisma.task.groupBy({
      by: ["createdById"],
      where: { createdById: { not: null } },
      _max: { createdAt: true },
    }),
    prisma.whatsAppMessage.groupBy({
      by: ["userId"],
      _max: { createdAt: true },
    }),
    prisma.asset.groupBy({
      by: ["uploadedById"],
      _max: { createdAt: true },
    }),
  ]);

  const workspacesByUser = countByKey(workspaceCounts, "userId");
  const tasksByUser = countByKey(tasksCreated, "createdById");
  const tasks7dByUser = countByKey(tasksCreated7d, "createdById");
  const updatesByUser = countByKey(taskUpdates, "authorId");
  const updates7dByUser = countByKey(taskUpdates7d, "authorId");
  const assetsByUser = countByKey(assets, "uploadedById");
  const assets7dByUser = countByKey(assets7d, "uploadedById");
  const linksByUser = countByKey(links, "createdById");
  const links7dByUser = countByKey(links7d, "createdById");
  const whatsappByUser = countByKey(whatsappMessages, "userId");
  const whatsapp7dByUser = countByKey(whatsappMessages7d, "userId");
  const botByUser = countByKey(botActions, "userId");
  const bot7dByUser = countByKey(botActions7d, "userId");

  const lastActiveByUser = new Map<string, Date>();
  for (const [userId, date] of maxDateByKey(latestUpdates, "authorId")) {
    bumpLastActive(lastActiveByUser, userId, date);
  }
  for (const [userId, date] of maxDateByKey(latestTasks, "createdById")) {
    bumpLastActive(lastActiveByUser, userId, date);
  }
  for (const [userId, date] of maxDateByKey(latestWhatsapp, "userId")) {
    bumpLastActive(lastActiveByUser, userId, date);
  }
  for (const [userId, date] of maxDateByKey(latestAssets, "uploadedById")) {
    bumpLastActive(lastActiveByUser, userId, date);
  }

  const usage: AdminUserUsage[] = users.map((user) => {
    const tasksCreatedCount = tasksByUser.get(user.id) ?? 0;
    const taskUpdatesCount = updatesByUser.get(user.id) ?? 0;
    const assetsCount = assetsByUser.get(user.id) ?? 0;
    const linksCount = linksByUser.get(user.id) ?? 0;
    const whatsappCount = whatsappByUser.get(user.id) ?? 0;
    const botCount = botByUser.get(user.id) ?? 0;

    const activity7d =
      (tasks7dByUser.get(user.id) ?? 0) +
      (updates7dByUser.get(user.id) ?? 0) +
      (assets7dByUser.get(user.id) ?? 0) +
      (links7dByUser.get(user.id) ?? 0) +
      (whatsapp7dByUser.get(user.id) ?? 0) +
      (bot7dByUser.get(user.id) ?? 0);

    const lastActive = lastActiveByUser.get(user.id);

    return {
      id: user.id,
      label: displayUser(user),
      email: user.email,
      phone: user.phone,
      whatsappConnected: Boolean(user.whatsappChatInitiatedAt),
      joinedAt: user.createdAt.toISOString(),
      workspaceCount: workspacesByUser.get(user.id) ?? user._count.memberships,
      tasksCreated: tasksCreatedCount,
      taskUpdates: taskUpdatesCount,
      assetsUploaded: assetsCount,
      linksCreated: linksCount,
      whatsappMessages: whatsappCount,
      botActions: botCount,
      activity7d,
      lastActiveAt: lastActive?.toISOString() ?? null,
    };
  });

  usage.sort((a, b) => {
    const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
    const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.activity7d - a.activity7d;
  });

  const active7d = usage.filter((user) => user.activity7d > 0).length;
  const active30d = usage.filter(
    (user) =>
      user.lastActiveAt !== null && new Date(user.lastActiveAt) >= since30d
  ).length;
  const whatsappUsers = usage.filter((user) => user.whatsappConnected).length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsers: usage.length,
      active7d,
      active30d,
      whatsappUsers,
    },
    users: usage,
  };
}

export type AdminWorkspacePlan = {
  id: string;
  name: string;
  planTier: PlanTier;
  planSource: string;
  memberCount: number;
  createdAt: string;
};

/** All workspaces with their billing tier — for the admin plans manager. */
export async function getAdminWorkspacePlans(): Promise<AdminWorkspacePlan[]> {
  const workspaces = await prisma.workspace.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      planTier: true,
      planSource: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });

  return workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    planTier: w.planTier,
    planSource: w.planSource,
    memberCount: w._count.memberships,
    createdAt: w.createdAt.toISOString(),
  }));
}

/** Read-only aggregates for the local admin dashboard. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const since7d = daysAgo(7);
  const since30d = daysAgo(30);

  const [
    userCount,
    usersLast7d,
    usersLast30d,
    whatsappConnected,
    workspaceCount,
    workspacesLast7d,
    taskCount,
    tasksLast7d,
    taskUpdateCount,
    taskUpdatesLast7d,
    assetCount,
    assetsLast7d,
    memoryEventCount,
    memoryEventsLast7d,
    whatsappQueuePending,
    whatsappQueueProcessing,
    whatsappQueueFailed,
    whatsappMessagesLast7d,
    botActionsLast7d,
    recentUsers,
    recentWorkspaces,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.user.count({ where: { createdAt: { gte: since30d } } }),
    prisma.user.count({ where: { whatsappChatInitiatedAt: { not: null } } }),
    prisma.workspace.count(),
    prisma.workspace.count({ where: { createdAt: { gte: since7d } } }),
    prisma.task.count(),
    prisma.task.count({ where: { createdAt: { gte: since7d } } }),
    prisma.taskUpdate.count(),
    prisma.taskUpdate.count({ where: { createdAt: { gte: since7d } } }),
    prisma.asset.count(),
    prisma.asset.count({ where: { createdAt: { gte: since7d } } }),
    prisma.memoryEvent.count(),
    prisma.memoryEvent.count({ where: { createdAt: { gte: since7d } } }),
    prisma.whatsAppInboundQueue.count({ where: { status: "pending" } }),
    prisma.whatsAppInboundQueue.count({ where: { status: "processing" } }),
    prisma.whatsAppInboundQueue.count({ where: { status: "failed" } }),
    prisma.whatsAppMessage.count({ where: { createdAt: { gte: since7d } } }),
    prisma.botActionLog.count({ where: { createdAt: { gte: since7d } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        whatsappChatInitiatedAt: true,
        createdAt: true,
      },
    }),
    prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { memberships: true, tasks: true } },
      },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      users: [
        { label: "Total users", value: userCount },
        { label: "Signups (7d)", value: usersLast7d },
        { label: "Signups (30d)", value: usersLast30d },
        {
          label: "WhatsApp connected",
          value: whatsappConnected,
          hint: "Users who messaged the bot",
        },
      ],
      workspaces: [
        { label: "Total workspaces", value: workspaceCount },
        { label: "Created (7d)", value: workspacesLast7d },
      ],
      activity: [
        { label: "Tasks", value: taskCount },
        { label: "Tasks created (7d)", value: tasksLast7d },
        { label: "Task updates", value: taskUpdateCount },
        { label: "Updates (7d)", value: taskUpdatesLast7d },
        { label: "Assets", value: assetCount },
        { label: "Assets uploaded (7d)", value: assetsLast7d },
      ],
      whatsapp: [
        { label: "Queue pending", value: whatsappQueuePending },
        { label: "Queue processing", value: whatsappQueueProcessing },
        { label: "Queue failed", value: whatsappQueueFailed },
        { label: "Chat messages (7d)", value: whatsappMessagesLast7d },
        { label: "Bot actions (7d)", value: botActionsLast7d },
      ],
      memory: [
        { label: "Memory events", value: memoryEventCount },
        { label: "Captured (7d)", value: memoryEventsLast7d },
      ],
    },
    recentUsers: recentUsers.map((user) => ({
      id: user.id,
      label: displayUser(user),
      email: user.email,
      phone: user.phone,
      whatsappConnected: Boolean(user.whatsappChatInitiatedAt),
      createdAt: user.createdAt.toISOString(),
    })),
    recentWorkspaces: recentWorkspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      memberCount: workspace._count.memberships,
      taskCount: workspace._count.tasks,
      createdAt: workspace.createdAt.toISOString(),
    })),
  };
}
