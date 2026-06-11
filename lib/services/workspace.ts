import { Role } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/project";

export async function createWorkspace(userId: string, name: string) {
  const workspace = await prisma.workspace.create({
    data: {
      name,
      memberships: {
        create: { userId, role: Role.LEADER },
      },
    },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveWorkspaceId: workspace.id },
  });
  return workspace;
}

export async function listUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId },
    include: {
      workspace: {
        include: { _count: { select: { tasks: true, memberships: true } } },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  return memberships.map((m) => ({
    role: m.role,
    joinedAt: m.joinedAt,
    workspace: m.workspace,
  }));
}

export async function getWorkspaceMembers(workspaceId: string, userId: string) {
  const self = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!self) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }

  const members = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return { selfRole: self.role, members };
}

const INVITER_ROLES: Role[] = [Role.LEADER, Role.SUB_LEADER];

export async function createInvite(
  workspaceId: string,
  userId: string,
  options?: { maxUses?: number; expiresInHours?: number }
) {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership || !INVITER_ROLES.includes(membership.role)) {
    throw new ServiceError(
      "Only leaders and sub-leaders can create invites",
      "FORBIDDEN"
    );
  }

  const maxUses = options?.maxUses ?? 10;
  const expiresInHours = options?.expiresInHours ?? 72;

  return prisma.workspaceInvite.create({
    data: {
      workspaceId,
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
  return prisma.$transaction(async (tx) => {
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
    if (existing) return invite.workspace; // already a member; don't burn a use

    await tx.workspaceMembership.create({
      data: { userId, workspaceId: invite.workspaceId, role: Role.MEMBER },
    });
    await tx.workspaceInvite.update({
      where: { id: inviteId },
      data: { usesCount: { increment: 1 } },
    });
    await tx.user.update({
      where: { id: userId },
      data: { lastActiveWorkspaceId: invite.workspaceId },
    });

    return invite.workspace;
  });
}

async function requireLeader(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
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

/** LEADER only. Guards against demoting the last leader. */
export async function updateMemberRole(
  workspaceId: string,
  actorId: string,
  targetUserId: string,
  role: Role
) {
  await requireLeader(workspaceId, actorId);

  const target = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
  });
  if (!target) {
    throw new ServiceError("That user is not a member", "NOT_FOUND");
  }

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

/** LEADER only. Cannot remove the last leader (leave/delete instead). */
export async function removeMember(
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

/** Active + spent invites for the management UI. LEADER/SUB_LEADER. */
export async function listInvites(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
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

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: invite.workspaceId },
    },
  });
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
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
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
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { excalidrawState: state as object },
  });
}

/** Issues a fresh MCP token, invalidating the old one immediately. */
export async function regenerateMcpToken(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { mcpToken: crypto.randomUUID() },
    select: { mcpToken: true },
  });
}

/** Meta sends phone numbers as E.164 without the plus sign. */
const PHONE_REGEX = /^[1-9]\d{7,14}$/;

export async function updateUserPhone(userId: string, phone: string | null) {
  if (phone !== null && !PHONE_REGEX.test(phone)) {
    throw new ServiceError(
      "Phone must be country code + number with no + or spaces (e.g. 919876543210)",
      "INVALID_INPUT"
    );
  }
  return prisma.user.update({
    where: { id: userId },
    data: { phone },
  });
}
