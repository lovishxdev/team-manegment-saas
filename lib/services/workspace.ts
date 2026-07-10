import { cache } from "react";
import { Prisma, Role } from "@/lib/generated/prisma/client";
import { invalidateMcpToken, invalidatePhone } from "@/lib/identity-cache";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getActorMembership, ServiceError, touchLastActiveWorkspace, resolveUserWorkspaceContext } from "@/lib/services/project";
import {
  normalizeUsername,
  validateUsernameFormat,
  displayUser,
} from "@/lib/username";
import { matchWorkspaceMember, normalizeMemberRef } from "@/lib/services/member-resolve";
import { isUsernameTaken } from "@/lib/username-server";
import { seedDefaultCategories } from "@/lib/services/categories";
import {
  assertCanAddMember,
  assertCanCreateWorkspace,
  ensureCanAddMember,
  getWorkspacePlan,
  workspaceFeature,
} from "@/lib/billing/entitlements";
import { scheduleOnboardingBrief } from "@/lib/memory/onboarding";

export async function createWorkspace(userId: string, name: string) {
  await assertCanCreateWorkspace(userId);

  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      memberships: {
        create: { userId, role: Role.LEADER },
      },
    },
  });
  await seedDefaultCategories(workspace.id);
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveWorkspaceId: workspace.id },
  });
  return workspace;
}

const DEFAULT_WORKSPACE_NAME = "workspace";

/**
 * Ensure a brand-new user has somewhere to work. Creates a workspace named
 * "workspace" when they have zero memberships. Idempotent.
 */
export async function ensureDefaultWorkspace(userId: string) {
  const count = await prisma.workspaceMembership.count({ where: { userId } });
  if (count > 0) return null;
  return createWorkspace(userId, DEFAULT_WORKSPACE_NAME);
}

/**
 * Reuses an existing workspace when the user already has the same name
 * (case-insensitive). Prevents duplicate boards from webhook retries.
 */
export async function findOrCreateWorkspaceByName(userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ServiceError("Workspace name cannot be empty", "INVALID_INPUT");
  }

  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
  });

  const existing = memberships.find(
    (m) => m.workspace.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveWorkspaceId: existing.workspace.id },
    });
    return { workspace: existing.workspace, created: false as const };
  }

  const workspace = await createWorkspace(userId, trimmed);
  return { workspace, created: true as const };
}

/** Sidebar nav only needs workspace id + name; open-task badges come separately. */
export const listSidebarWorkspaces = cache(async function listSidebarWorkspaces(
  userId: string
) {
  return prisma.workspaceMembership.findMany({
    where: { userId },
    select: { workspace: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
  });
});

/** Per-request memo only — always hits the DB (no cross-request cache). */
export const listUserWorkspaces = cache(async function listUserWorkspaces(
  userId: string
) {
  return prisma.workspaceMembership.findMany({
    where: { userId },
    include: {
      workspace: {
        include: { _count: { select: { tasks: true, memberships: true } } },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
});

export type WorkspaceDashboardStats = {
  openTasks: number;
  assignedToYou: number;
};

/** Per-request memo — shared by sidebar badges and dashboard cards. */
export const getOpenTaskCountsByWorkspace = cache(
  async function getOpenTaskCountsByWorkspace(workspaceIds: string[]) {
    const counts = new Map<string, number>(
      workspaceIds.map((id) => [id, 0])
    );
    if (workspaceIds.length === 0) return counts;

    const openGroups = await prisma.task.groupBy({
      by: ["workspaceId"],
      where: { workspaceId: { in: workspaceIds }, status: { not: "DONE" } },
      _count: { _all: true },
    });

    for (const g of openGroups) {
      counts.set(g.workspaceId, g._count._all);
    }
    return counts;
  }
);

/** Open + assigned-to-me task counts per workspace for the dashboard cards. */
export const getWorkspaceDashboardStats = cache(
  async function getWorkspaceDashboardStats(
    userId: string,
    workspaceIds: string[]
  ): Promise<Map<string, WorkspaceDashboardStats>> {
    const stats = new Map<string, WorkspaceDashboardStats>(
      workspaceIds.map((id) => [id, { openTasks: 0, assignedToYou: 0 }])
    );
    if (workspaceIds.length === 0) return stats;

    const [openByWorkspace, assignedRows] = await Promise.all([
      getOpenTaskCountsByWorkspace(workspaceIds),
      prisma.taskAssignee.findMany({
        where: {
          userId,
          task: {
            workspaceId: { in: workspaceIds },
            status: { not: "DONE" },
          },
        },
        select: { task: { select: { workspaceId: true } } },
      }),
    ]);

    for (const [workspaceId, openTasks] of openByWorkspace) {
      stats.get(workspaceId)!.openTasks = openTasks;
    }
    for (const row of assignedRows) {
      stats.get(row.task.workspaceId)!.assignedToYou++;
    }

    return stats;
  }
);

export type WorkspaceDashboardMember = {
  id: string;
  label: string | null;
};

export type DashboardTaskPeek = {
  id: string;
  shortId: number;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  workspaceId: string;
  workspaceName: string;
  dueDate: string | null;
};

export type DashboardSearchTask = DashboardTaskPeek & {
  assignees: { id: string; label: string | null }[];
};

export type DashboardHomeSummary = {
  workspaceCount: number;
  openTasks: number;
  assignedToYou: number;
  taskPeeks: DashboardTaskPeek[];
};

/** Greeting stats + recent assigned tasks for the dashboard home. */
export async function getDashboardHomeSummary(
  userId: string
): Promise<DashboardHomeSummary> {
  const memberships = await listUserWorkspaces(userId);
  const workspaceIds = memberships.map((m) => m.workspace.id);
  const statsByWorkspace = await getWorkspaceDashboardStats(userId, workspaceIds);

  let openTasks = 0;
  let assignedToYou = 0;
  for (const stats of statsByWorkspace.values()) {
    openTasks += stats.openTasks;
    assignedToYou += stats.assignedToYou;
  }

  const assignedTasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      assignees: { some: { userId } },
      workspaceId: { in: workspaceIds },
    },
    select: {
      id: true,
      shortId: true,
      title: true,
      status: true,
      dueDate: true,
      workspaceId: true,
      workspace: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 4,
  });

  const taskPeeks: DashboardTaskPeek[] = assignedTasks.map((t) => ({
    id: t.id,
    shortId: t.shortId,
    title: t.title,
    status: t.status,
    workspaceId: t.workspaceId,
    workspaceName: t.workspace.name,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
  }));

  return {
    workspaceCount: memberships.length,
    openTasks,
    assignedToYou,
    taskPeeks,
  };
}

const DASHBOARD_SEARCH_LIMIT = 200;

/** Open tasks across all workspaces for dashboard client search. */
export async function getDashboardSearchIndex(
  userId: string
): Promise<DashboardSearchTask[]> {
  const memberships = await listUserWorkspaces(userId);
  const workspaceIds = memberships.map((m) => m.workspace.id);
  if (workspaceIds.length === 0) return [];

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      status: { not: "DONE" },
    },
    select: {
      id: true,
      shortId: true,
      title: true,
      status: true,
      dueDate: true,
      workspaceId: true,
      workspace: { select: { name: true } },
      assignees: {
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: DASHBOARD_SEARCH_LIMIT,
  });

  return tasks.map((task) => ({
    id: task.id,
    shortId: task.shortId,
    title: task.title,
    status: task.status,
    workspaceId: task.workspaceId,
    workspaceName: task.workspace.name,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assignees: task.assignees.map((assignee) => ({
      id: assignee.user.id,
      label: displayUser(assignee.user),
    })),
  }));
}

/** Member labels per workspace for dashboard cards. */
export async function getWorkspaceDashboardMembers(
  workspaceIds: string[]
): Promise<Map<string, WorkspaceDashboardMember[]>> {
  const membersByWorkspace = new Map<string, WorkspaceDashboardMember[]>(
    workspaceIds.map((id) => [id, []])
  );
  if (workspaceIds.length === 0) return membersByWorkspace;

  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId: { in: workspaceIds } },
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  for (const m of memberships) {
    membersByWorkspace.get(m.workspaceId)!.push({
      id: m.user.id,
      label: displayUser(m.user),
    });
  }

  return membersByWorkspace;
}

export async function getWorkspaceMembers(workspaceId: string, userId: string) {
  const self = await getActorMembership(userId, workspaceId);
  if (!self) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }

  const members = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, email: true, username: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
  return { selfRole: self.role, members };
}

const INVITER_ROLES: Role[] = [Role.LEADER, Role.SUB_LEADER];

export async function createInvite(
  workspaceId: string,
  userId: string,
  options?: { maxUses?: number; expiresInHours?: number; role?: Role }
) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership || !INVITER_ROLES.includes(membership.role)) {
    throw new ServiceError(
      "Only leaders and sub-leaders can create invites",
      "FORBIDDEN"
    );
  }

  const role = options?.role ?? Role.MEMBER;
  if (role === Role.GUEST) {
    // Guest (client) access is a Team+ feature.
    if (!(await workspaceFeature(workspaceId, "guestAccess"))) {
      throw new ServiceError(
        "Guest access is available on the Team plan. Upgrade to invite clients.",
        "UPGRADE_REQUIRED"
      );
    }
  } else {
    // Members count against the cap; guests are uncapped (block new growth).
    await assertCanAddMember(workspaceId);
  }

  const maxUses = options?.maxUses ?? 10;
  const expiresInHours = options?.expiresInHours ?? 72;

  return prisma.workspaceInvite.create({
    data: {
      workspaceId,
      role,
      maxUses,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
    },
  });
}

/** Public lookup for the invite landing page (no membership required). */
export async function getInvite(inviteId: string) {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!invite) return null;

  const expired = invite.expiresAt < new Date();
  const exhausted = invite.usesCount >= invite.maxUses;
  return { ...invite, valid: !expired && !exhausted, expired, exhausted };
}

export async function acceptInvite(inviteId: string, userId: string) {
  const { workspace, joined, role } = await prisma.$transaction(async (tx) => {
    const invite = await tx.workspaceInvite.findUnique({
      where: { id: inviteId },
      include: { workspace: { select: { id: true, name: true } } },
    });
    if (!invite) {
      throw new ServiceError("Invite not found", "NOT_FOUND");
    }
    if (invite.expiresAt < new Date()) {
      throw new ServiceError("This invite has expired", "FORBIDDEN");
    }
    if (invite.usesCount >= invite.maxUses) {
      throw new ServiceError("This invite has no uses left", "FORBIDDEN");
    }

    const existing = await tx.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: invite.workspaceId } },
    });
    // already a member; don't burn a use
    if (existing) return { workspace: invite.workspace, joined: false, role: existing.role };

    const role = invite.role;

    // Guests are read-only clients and don't count against the member cap.
    // Members: authoritative cap gate at join time (prevents overshoot from
    // multiple valid invites); existing members grandfathered above.
    if (role !== Role.GUEST) {
      const [tier, memberCount] = await Promise.all([
        getWorkspacePlan(invite.workspaceId),
        tx.workspaceMembership.count({
          where: { workspaceId: invite.workspaceId, role: { not: Role.GUEST } },
        }),
      ]);
      ensureCanAddMember(tier, memberCount);
    }

    await tx.workspaceMembership.create({
      data: { userId, workspaceId: invite.workspaceId, role },
    });
    await tx.workspaceInvite.update({
      where: { id: inviteId },
      data: { usesCount: { increment: 1 } },
    });
    await tx.user.update({
      where: { id: userId },
      data: { lastActiveWorkspaceId: invite.workspaceId },
    });

    return { workspace: invite.workspace, joined: true, role };
  });

  // Team-only: send new members (not guests) a project onboarding digest.
  if (joined && role !== Role.GUEST) {
    scheduleOnboardingBrief(workspace.id, userId);
  }

  return workspace;
}

async function requireLeader(workspaceId: string, userId: string) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership || membership.role !== Role.LEADER) {
    throw new ServiceError("Only leaders can do this", "FORBIDDEN");
  }
  return membership;
}

async function countLeaders(workspaceId: string): Promise<number> {
  return prisma.workspaceMembership.count({
    where: { workspaceId, role: Role.LEADER },
  });
}

/** Asserts the actor is a LEADER and returns the target's membership row. */
async function requireLeaderAndTarget(
  workspaceId: string,
  actorId: string,
  targetUserId: string
) {
  await requireLeader(workspaceId, actorId);

  const target = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
  });
  if (!target) {
    throw new ServiceError("That user is not a member", "NOT_FOUND");
  }
  return target;
}

/** LEADER only. Guards against demoting the last leader. */
export async function updateMemberRole(
  workspaceId: string,
  actorId: string,
  targetUserId: string,
  role: Role
) {
  const target = await requireLeaderAndTarget(workspaceId, actorId, targetUserId);

  if (target.role === Role.LEADER && role !== Role.LEADER) {
    if ((await countLeaders(workspaceId)) <= 1) {
      throw new ServiceError(
        "Promote someone else to leader first - a workspace needs at least one",
        "INVALID_INPUT"
      );
    }
  }

  return prisma.workspaceMembership.update({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    data: { role },
  });
}

const ROLE_RANK: Record<Role, number> = {
  [Role.GUEST]: -1,
  [Role.MEMBER]: 0,
  [Role.SUB_LEADER]: 1,
  [Role.LEADER]: 2,
};

export function formatMemberRole(role: Role): string {
  return role.replace("_", " ");
}

/** Resolve a workspace member by user id, username, or email fragment. */
export async function resolveWorkspaceMember(
  workspaceId: string,
  identifier: string
): Promise<{
  userId: string;
  role: Role;
  user: { id: string; email: string | null; username: string | null };
}> {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, email: true, username: true } } },
  });

  const matched = matchWorkspaceMember(memberships, identifier);
  if (matched.kind === "one") {
    return {
      userId: matched.member.user.id,
      role: matched.member.role,
      user: matched.member.user,
    };
  }
  if (matched.kind === "ambiguous") {
    throw new ServiceError(
      `Multiple members match "${normalizeMemberRef(identifier) || identifier.trim()}": ${matched.members
        .map((m) => displayUser(m.user))
        .join(", ")}. Be more specific.`,
      "AMBIGUOUS_WORKSPACE"
    );
  }
  throw new ServiceError(
    `No workspace member matches "${normalizeMemberRef(identifier) || identifier.trim()}"`,
    "NOT_FOUND"
  );
}

/** LEADER only. Promotes a member to SUB_LEADER or LEADER. */
export async function promoteMember(
  workspaceId: string,
  actorId: string,
  memberRef: string,
  newRole: Role = Role.SUB_LEADER
) {
  if (newRole !== Role.SUB_LEADER && newRole !== Role.LEADER) {
    throw new ServiceError(
      "Promotion supports SUB_LEADER or LEADER only",
      "INVALID_INPUT"
    );
  }

  const target = await resolveWorkspaceMember(workspaceId, memberRef);
  if (target.userId === actorId) {
    throw new ServiceError("You cannot change your own role here", "INVALID_INPUT");
  }
  if (target.role === newRole) {
    throw new ServiceError(
      `@${displayUser(target.user)} is already ${formatMemberRole(newRole)}`,
      "INVALID_INPUT"
    );
  }
  if (ROLE_RANK[newRole] <= ROLE_RANK[target.role]) {
    throw new ServiceError(
      "That is not a promotion — use demote_member to lower someone's role",
      "INVALID_INPUT"
    );
  }

  const updated = await updateMemberRole(
    workspaceId,
    actorId,
    target.userId,
    newRole
  );
  return { ...target, role: updated.role };
}

/** LEADER only. Demotes a member to MEMBER or SUB_LEADER. */
export async function demoteMember(
  workspaceId: string,
  actorId: string,
  memberRef: string,
  newRole: Role = Role.MEMBER
) {
  if (newRole !== Role.MEMBER && newRole !== Role.SUB_LEADER) {
    throw new ServiceError(
      "Demotion supports MEMBER or SUB_LEADER only",
      "INVALID_INPUT"
    );
  }

  const target = await resolveWorkspaceMember(workspaceId, memberRef);
  if (target.userId === actorId) {
    throw new ServiceError("You cannot change your own role here", "INVALID_INPUT");
  }
  if (target.role === newRole) {
    throw new ServiceError(
      `@${displayUser(target.user)} is already ${formatMemberRole(newRole)}`,
      "INVALID_INPUT"
    );
  }
  if (ROLE_RANK[newRole] >= ROLE_RANK[target.role]) {
    throw new ServiceError(
      "That is not a demotion — use promote_member to raise someone's role",
      "INVALID_INPUT"
    );
  }

  const updated = await updateMemberRole(
    workspaceId,
    actorId,
    target.userId,
    newRole
  );
  return { ...target, role: updated.role };
}

/** LEADER only. Demote by resolved user id (confirmation flows). */
export async function demoteMemberById(
  workspaceId: string,
  actorId: string,
  targetUserId: string,
  newRole: Role
) {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    include: { user: { select: { id: true, email: true, username: true } } },
  });
  if (!membership) {
    throw new ServiceError("That user is not a member", "NOT_FOUND");
  }
  return demoteMember(
    workspaceId,
    actorId,
    membership.user.username ?? membership.user.email ?? targetUserId,
    newRole
  );
}

/** LEADER only. Cannot remove the last leader (leave/delete instead). */
export async function removeMember(
  workspaceId: string,
  actorId: string,
  targetUserId: string
) {
  const target = await requireLeaderAndTarget(workspaceId, actorId, targetUserId);

  if (target.role === Role.LEADER && (await countLeaders(workspaceId)) <= 1) {
    throw new ServiceError(
      "The last leader can't be removed",
      "INVALID_INPUT"
    );
  }

  await prisma.workspaceMembership.delete({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
  });
}

/** Anyone can leave, except the last leader of a non-empty workspace. */
export async function leaveWorkspace(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }

  if (membership.role === Role.LEADER && (await countLeaders(workspaceId)) <= 1) {
    const otherMembers = await prisma.workspaceMembership.count({
      where: { workspaceId, userId: { not: userId } },
    });
    if (otherMembers > 0) {
      throw new ServiceError(
        "You're the only leader - promote someone else before leaving, or delete the workspace",
        "INVALID_INPUT"
      );
    }
  }

  await prisma.workspaceMembership.delete({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
}

/** LEADER only. Cascade deletes tasks, assets, memberships, invites. */
export async function deleteWorkspace(workspaceId: string, userId: string) {
  await requireLeader(workspaceId, userId);
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

/** LEADER only. Renames the workspace; blocks duplicate names among the actor's workspaces. */
export async function renameWorkspace(
  workspaceId: string,
  userId: string,
  name: string
) {
  await requireLeader(workspaceId, userId);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ServiceError("Workspace name cannot be empty", "INVALID_INPUT");
  }

  const duplicate = await prisma.workspaceMembership.findFirst({
    where: {
      userId,
      workspaceId: { not: workspaceId },
      workspace: { name: { equals: trimmed, mode: "insensitive" } },
    },
  });
  if (duplicate) {
    throw new ServiceError(
      "You already have a workspace with that name",
      "INVALID_INPUT"
    );
  }

  return prisma.workspace.update({
    where: { id: workspaceId },
    data: { name: trimmed },
  });
}

/** Active + spent invites for the management UI. LEADER/SUB_LEADER. */
export async function listInvites(workspaceId: string, userId: string) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership || !INVITER_ROLES.includes(membership.role)) {
    throw new ServiceError(
      "Only leaders and sub-leaders can view invites",
      "FORBIDDEN"
    );
  }

  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return invites.map((invite) => ({
    ...invite,
    active: invite.expiresAt > now && invite.usesCount < invite.maxUses,
  }));
}

export async function revokeInvite(inviteId: string, userId: string) {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite) throw new ServiceError("Invite not found", "NOT_FOUND");

  const membership = await getActorMembership(userId, invite.workspaceId);
  if (!membership || !INVITER_ROLES.includes(membership.role)) {
    throw new ServiceError(
      "Only leaders and sub-leaders can revoke invites",
      "FORBIDDEN"
    );
  }

  await prisma.workspaceInvite.delete({ where: { id: inviteId } });
}

/** Whiteboard state. Any member can read and draw. */
export async function getExcalidrawState(workspaceId: string, userId: string) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { id: true, name: true, excalidrawState: true },
  });
  return workspace;
}

export async function saveExcalidrawState(
  workspaceId: string,
  userId: string,
  state: unknown
) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }
  if (membership.role === "GUEST") {
    throw new ServiceError(
      "Guests have read-only access to this workspace.",
      "FORBIDDEN"
    );
  }
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { excalidrawState: state as object },
  });
}

export type UserWorkspaceChoice = {
  id: string;
  name: string;
  role: Role;
  isActive: boolean;
};

/** Workspace list for bots (id, name, role, active flag). */
export async function listUserWorkspaceChoices(
  userId: string
): Promise<UserWorkspaceChoice[]> {
  const [memberships, user] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where: { userId },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveWorkspaceId: true },
    }),
  ]);

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    role: m.role,
    isActive: m.workspace.id === user?.lastActiveWorkspaceId,
  }));
}

/** Set the user's active workspace by name or id. */
export async function switchWorkspace(userId: string, workspaceHint: string) {
  const ctx = await resolveUserWorkspaceContext(userId, workspaceHint);
  await touchLastActiveWorkspace(userId, ctx.workspaceId);
  return ctx;
}

export type WorkspaceSummary = {
  workspace: { id: string; name: string };
  role: Role;
  memberCount: number;
  openTasks: number;
  assignedToYou: number;
  tasksByStatus: Record<"TODO" | "IN_PROGRESS" | "DONE", number>;
};

/** Quick workspace health snapshot for bots. */
export async function getWorkspaceSummary(
  workspaceId: string,
  userId: string
): Promise<WorkspaceSummary> {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }

  const [workspace, memberCount, openTasks, assignedToYou, byStatus] =
    await Promise.all([
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { id: true, name: true },
      }),
      prisma.workspaceMembership.count({ where: { workspaceId } }),
      prisma.task.count({
        where: { workspaceId, status: { not: "DONE" } },
      }),
      prisma.task.count({
        where: {
          workspaceId,
          status: { not: "DONE" },
          assignees: { some: { userId } },
        },
      }),
      prisma.task.groupBy({
        by: ["status"],
        where: { workspaceId },
        _count: { _all: true },
      }),
    ]);

  await touchLastActiveWorkspace(userId, workspaceId);

  const tasksByStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  for (const row of byStatus) {
    tasksByStatus[row.status] = row._count._all;
  }

  return {
    workspace,
    role: membership.role,
    memberCount,
    openTasks,
    assignedToYou,
    tasksByStatus,
  };
}

/** Issues a fresh MCP token, invalidating the old one immediately. */
export async function regenerateMcpToken(userId: string) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { mcpToken: true },
  });
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { mcpToken: crypto.randomUUID() },
    select: { mcpToken: true },
  });
  // Evict the old token from the auth cache so revocation is instant.
  invalidateMcpToken(current?.mcpToken);
  return updated;
}

/** Meta sends phone numbers as E.164 without the plus sign. */
const PHONE_REGEX = /^[1-9]\d{7,14}$/;

/** Sets the user's unique handle. Input is lowercased. */
export async function updateUsername(userId: string, username: string) {
  const normalized = normalizeUsername(username);
  try {
    validateUsernameFormat(normalized);
  } catch (err) {
    throw new ServiceError(
      err instanceof Error ? err.message : "Invalid username",
      "INVALID_INPUT"
    );
  }
  if (await isUsernameTaken(normalized, userId)) {
    throw new ServiceError(
      `Username "${normalized}" is already taken`,
      "INVALID_INPUT"
    );
  }
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { username: normalized },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ServiceError(
        `Username "${normalized}" is already taken`,
        "INVALID_INPUT"
      );
    }
    throw err;
  }
}

export async function updateUserPhone(userId: string, phone: string | null) {
  if (phone !== null && !PHONE_REGEX.test(phone)) {
    throw new ServiceError(
      "Enter a valid mobile number (country code + number, digits only)",
      "INVALID_INPUT"
    );
  }
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: userId },
      data: { phone },
    });
  } catch (err) {
    // One phone = one account: the WhatsApp bot routes messages by number,
    // so a number linked elsewhere must be explicitly rejected.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ServiceError(
        "This phone number is already linked to another account. Remove it there first.",
        "INVALID_INPUT"
      );
    }
    throw err;
  }

  // Evict both numbers so the WhatsApp bot sees the change immediately.
  invalidatePhone(current?.phone);
  invalidatePhone(phone);
  return updated;
}

/**
 * Permanently deletes the user's account: leaves or removes workspaces,
 * deletes the app profile, then removes the Supabase Auth user.
 */
export async function deleteUserAccount(userId: string) {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true } } },
  });

  for (const membership of memberships) {
    const { workspaceId, role, workspace } = membership;
    const otherMembers = await prisma.workspaceMembership.count({
      where: { workspaceId, userId: { not: userId } },
    });

    if (role === Role.LEADER && (await countLeaders(workspaceId)) <= 1) {
      if (otherMembers > 0) {
        throw new ServiceError(
          `You're the only leader of "${workspace.name}". Promote someone else or delete that workspace before deleting your account.`,
          "INVALID_INPUT"
        );
      }
      await prisma.workspace.delete({ where: { id: workspaceId } });
      continue;
    }

    await prisma.workspaceMembership.delete({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
  }

  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, mcpToken: true },
  });

  await prisma.user.delete({ where: { id: userId } });

  invalidatePhone(profile?.phone);
  invalidateMcpToken(profile?.mcpToken);

  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
  if (error) {
    console.error("Supabase auth delete failed:", error.message);
    throw new ServiceError(
      "Your app data was removed, but sign-in cleanup failed. Contact support if you still see this email in use.",
      "INVALID_INPUT"
    );
  }
}
