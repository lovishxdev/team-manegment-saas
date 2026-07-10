import { Role, type PlanTier } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getActorMembership, ServiceError } from "@/lib/services/project";
import {
  planLabel,
  planLimits,
  DEFAULT_PLAN_TIER,
  type PlanLimits,
} from "@/lib/billing/plans";
import { billingProvider, effectiveTier } from "@/lib/billing/provider";

/**
 * Central entitlement layer. Every surface (web actions, MCP, WhatsApp)
 * enforces tiers by calling these helpers from the service layer — never
 * in the UI alone. Downgrade policy: grandfather existing, block new
 * growth (a workspace over cap keeps its members but can't add more).
 */

export type WorkspaceEntitlements = {
  tier: PlanTier;
  limits: PlanLimits;
};

/** Effective tier for a workspace (via the billing provider). */
export async function getWorkspacePlan(workspaceId: string): Promise<PlanTier> {
  return billingProvider().getWorkspacePlan(workspaceId);
}

/** Tier + resolved limits for a workspace. */
export async function getWorkspaceEntitlements(
  workspaceId: string
): Promise<WorkspaceEntitlements> {
  const tier = await getWorkspacePlan(workspaceId);
  return { tier, limits: planLimits(tier) };
}

/** Resolve a single entitlement flag/limit for a workspace (generic accessor). */
export async function workspaceFeature<K extends keyof PlanLimits>(
  workspaceId: string,
  key: K
): Promise<PlanLimits[K]> {
  const { limits } = await getWorkspaceEntitlements(workspaceId);
  return limits[key];
}

function upgradeError(message: string): ServiceError {
  return new ServiceError(message, "UPGRADE_REQUIRED");
}

// ---------------------------------------------------------------------------
// Member cap (per workspace)
// ---------------------------------------------------------------------------

/**
 * Pure guard: throws if adding one more member would exceed the tier cap.
 * `currentMemberCount` is the number of members already in the workspace.
 */
export function ensureCanAddMember(
  tier: PlanTier,
  currentMemberCount: number
): void {
  const { maxMembers } = planLimits(tier);
  if (maxMembers !== null && currentMemberCount >= maxMembers) {
    throw upgradeError(
      `This workspace is on the ${planLabel(tier)} plan (up to ${maxMembers} members). ` +
        `Upgrade to add more members.`
    );
  }
}

/** Pure boolean: is the workspace at/over its member cap for this tier? */
export function memberCapReached(
  tier: PlanTier,
  currentMemberCount: number
): boolean {
  const { maxMembers } = planLimits(tier);
  return maxMembers !== null && currentMemberCount >= maxMembers;
}

/**
 * Async convenience: resolves the tier, counts current members, and guards.
 * Use for preflight (invite creation). The authoritative check at join time
 * lives inside acceptInvite's transaction via ensureCanAddMember.
 */
export async function assertCanAddMember(workspaceId: string): Promise<void> {
  const [tier, memberCount] = await Promise.all([
    getWorkspacePlan(workspaceId),
    // Guests are read-only clients and don't count against the member cap.
    prisma.workspaceMembership.count({
      where: { workspaceId, role: { not: Role.GUEST } },
    }),
  ]);
  ensureCanAddMember(tier, memberCount);
}

// ---------------------------------------------------------------------------
// Workspaces-led cap (per user)
// ---------------------------------------------------------------------------

/**
 * The workspaces-led allowance for a user = the most generous cap among the
 * tiers of the workspaces they currently lead (unlimited wins). A user who
 * leads a Team/Business workspace can create more; a pure-Hobby user gets 1.
 * Falls back to the default (Hobby) tier when they lead nothing yet.
 */
export async function resolveWorkspacesLedLimit(
  userId: string
): Promise<number | null> {
  const led = await prisma.workspaceMembership.findMany({
    where: { userId, role: Role.LEADER },
    select: {
      workspace: { select: { planTier: true, planExpiresAt: true } },
    },
  });

  const tiers: PlanTier[] =
    led.length === 0
      ? [DEFAULT_PLAN_TIER]
      : led.map((m) =>
          effectiveTier(m.workspace.planTier, m.workspace.planExpiresAt)
        );

  let best: number | null = 0;
  for (const tier of tiers) {
    const cap = planLimits(tier).maxWorkspacesLed;
    if (cap === null) return null; // unlimited beats everything
    if (best !== null && cap > best) best = cap;
  }
  return best;
}

/** Throws if the user has reached their workspaces-led cap. */
export async function assertCanCreateWorkspace(userId: string): Promise<void> {
  const [limit, ledCount] = await Promise.all([
    resolveWorkspacesLedLimit(userId),
    prisma.workspaceMembership.count({
      where: { userId, role: Role.LEADER },
    }),
  ]);

  if (limit !== null && ledCount >= limit) {
    throw upgradeError(
      limit === 1
        ? `The Hobby plan includes 1 workspace. Upgrade to Team to create more.`
        : `Your plan allows up to ${limit} workspaces. Upgrade to create more.`
    );
  }
}

// ---------------------------------------------------------------------------
// Open-discussion cap (per workspace)
// ---------------------------------------------------------------------------

/** Throws if the workspace has hit its open-discussion cap for the tier. */
export async function assertCanCreateDiscussion(
  workspaceId: string
): Promise<void> {
  const { tier, limits } = await getWorkspaceEntitlements(workspaceId);
  const cap = limits.maxOpenDiscussions;
  if (cap === null) return;

  const openCount = await prisma.post.count({
    where: { workspaceId, status: "OPEN" },
  });
  if (openCount >= cap) {
    throw upgradeError(
      `The ${planLabel(tier)} plan allows ${cap} open discussions. ` +
        `Close or resolve one, or upgrade to start another.`
    );
  }
}

// ---------------------------------------------------------------------------
// Memory retention window (per workspace)
// ---------------------------------------------------------------------------

/**
 * Earliest `createdAt` to include in memory recall/list results for a
 * workspace, or null when retention is unlimited. Events older than this
 * are hidden from queries — never deleted (grandfather policy).
 */
export async function memoryRetentionCutoff(
  workspaceId: string
): Promise<Date | null> {
  const { limits } = await getWorkspaceEntitlements(workspaceId);
  const days = limits.memoryRetentionDays;
  if (days === null) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Aggregated status (for UI hints)
// ---------------------------------------------------------------------------

export type WorkspaceLimitStatus = {
  tier: PlanTier;
  planName: string;
  limits: PlanLimits;
  memberCount: number;
  atMemberCap: boolean;
  openDiscussions: number;
  atDiscussionCap: boolean;
};

/** One-shot usage + cap snapshot for a workspace (powers UI upgrade hints). */
export async function getWorkspaceLimitStatus(
  workspaceId: string
): Promise<WorkspaceLimitStatus> {
  const { tier, limits } = await getWorkspaceEntitlements(workspaceId);
  const [memberCount, openDiscussions] = await Promise.all([
    prisma.workspaceMembership.count({
      where: { workspaceId, role: { not: Role.GUEST } },
    }),
    limits.maxOpenDiscussions === null
      ? Promise.resolve(0)
      : prisma.post.count({ where: { workspaceId, status: "OPEN" } }),
  ]);

  return {
    tier,
    planName: planLabel(tier),
    limits,
    memberCount,
    atMemberCap:
      limits.maxMembers !== null && memberCount >= limits.maxMembers,
    openDiscussions,
    atDiscussionCap:
      limits.maxOpenDiscussions !== null &&
      openDiscussions >= limits.maxOpenDiscussions,
  };
}

export type UserWorkspacesLedStatus = {
  limit: number | null;
  ledCount: number;
  canCreate: boolean;
};

/** Workspaces-led usage for a user (powers the create-workspace hint). */
export async function getUserWorkspacesLedStatus(
  userId: string
): Promise<UserWorkspacesLedStatus> {
  const [limit, ledCount] = await Promise.all([
    resolveWorkspacesLedLimit(userId),
    prisma.workspaceMembership.count({
      where: { userId, role: Role.LEADER },
    }),
  ]);
  return {
    limit,
    ledCount,
    canCreate: limit === null || ledCount < limit,
  };
}

// ---------------------------------------------------------------------------
// Admin: set a workspace's tier (used by the local admin plans page)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Ambient coding-agent seats (per workspace; seat = distinct engineer)
// ---------------------------------------------------------------------------

/**
 * Record/refresh a user's ambient-agent seat on a workspace and enforce the
 * tier cap. Seat = user (headcount). Existing seats are grandfathered; a new
 * engineer beyond the cap is blocked (returns { ok: false }).
 */
export async function claimAgentSeat(
  workspaceId: string,
  userId: string
): Promise<{ ok: boolean; limit: number | null; seats: number }> {
  const existing = await prisma.agentSeat.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { workspaceId: true },
  });

  const limit = await workspaceFeature(workspaceId, "ambientAgentSeats");

  if (existing) {
    await prisma.agentSeat.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { lastSeenAt: new Date() },
    });
    const seats = await prisma.agentSeat.count({ where: { workspaceId } });
    return { ok: true, limit, seats };
  }

  const seats = await prisma.agentSeat.count({ where: { workspaceId } });
  if (limit !== null && seats >= limit) {
    return { ok: false, limit, seats };
  }

  await prisma.agentSeat.create({ data: { workspaceId, userId } });
  return { ok: true, limit, seats: seats + 1 };
}

export async function setWorkspacePlanTier(
  workspaceId: string,
  tier: PlanTier,
  options?: {
    /** Provenance: "admin" (default) | "trial" | "stripe". */
    source?: string;
    /** Null (default) = no expiry. */
    expiresAt?: Date | null;
    /** Stamp trialStartedAt (one-trial-per-lifetime marker). */
    markTrialStarted?: boolean;
  }
): Promise<void> {
  const source = options?.source ?? "admin";
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      planTier: tier,
      planSource: source,
      planExpiresAt: options?.expiresAt ?? null,
      ...(options?.markTrialStarted ? { trialStartedAt: new Date() } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Self-serve trials
// ---------------------------------------------------------------------------

export const TRIAL_DAYS = 14;
export const TRIAL_TIER: PlanTier = "TEAM";

export type TrialStatus = {
  onTrial: boolean;
  daysLeft: number;
  expiresAt: string | null;
  /** True when ≤ 3 days remain — used to emphasize the upgrade CTA. */
  expiringSoon: boolean;
};

/** Active-trial snapshot for a workspace (empty when not on a live trial). */
export async function getWorkspaceTrialStatus(
  workspaceId: string
): Promise<TrialStatus> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { planSource: true, planExpiresAt: true },
  });

  const empty: TrialStatus = {
    onTrial: false,
    daysLeft: 0,
    expiresAt: null,
    expiringSoon: false,
  };
  if (!workspace || workspace.planSource !== "trial" || !workspace.planExpiresAt) {
    return empty;
  }

  const remainingMs = workspace.planExpiresAt.getTime() - Date.now();
  if (remainingMs <= 0) return empty; // expired → naturally reverted to Hobby

  const daysLeft = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return {
    onTrial: true,
    daysLeft,
    expiresAt: workspace.planExpiresAt.toISOString(),
    expiringSoon: daysLeft <= 3,
  };
}

export type TrialEligibleWorkspace = {
  id: string;
  name: string;
  currentTier: PlanTier;
  trialUsed: boolean;
  eligible: boolean;
};

/** Workspaces the user leads, annotated with trial eligibility (for the pricing CTA). */
export async function listUserLedWorkspacesForTrial(
  userId: string
): Promise<TrialEligibleWorkspace[]> {
  const led = await prisma.workspaceMembership.findMany({
    where: { userId, role: Role.LEADER },
    orderBy: { joinedAt: "desc" },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
          planTier: true,
          planExpiresAt: true,
          trialStartedAt: true,
        },
      },
    },
  });

  return led.map(({ workspace }) => {
    const currentTier = effectiveTier(workspace.planTier, workspace.planExpiresAt);
    const trialUsed = workspace.trialStartedAt !== null;
    return {
      id: workspace.id,
      name: workspace.name,
      currentTier,
      trialUsed,
      // Eligible only if still effectively Hobby and never trialed before.
      eligible: currentTier === "HOBBY" && !trialUsed,
    };
  });
}

/**
 * Start a self-serve Team trial on a workspace the user leads.
 * One trial per workspace lifetime; blocked if already on a paid/active plan.
 * Reuses setWorkspacePlanTier (same path admin uses) with trial provenance.
 */
export async function startTeamTrial(
  workspaceId: string,
  userId: string
): Promise<{ expiresAt: Date }> {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }
  if (membership.role !== Role.LEADER) {
    throw new ServiceError(
      "Only the workspace leader can start a trial",
      "FORBIDDEN"
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { planTier: true, planExpiresAt: true, trialStartedAt: true },
  });
  if (!workspace) {
    throw new ServiceError("Workspace not found", "NOT_FOUND");
  }
  if (workspace.trialStartedAt) {
    throw upgradeError(
      "This workspace has already used its free trial. Contact us to upgrade."
    );
  }
  if (effectiveTier(workspace.planTier, workspace.planExpiresAt) !== "HOBBY") {
    throw upgradeError("This workspace is already on a paid plan.");
  }

  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  await setWorkspacePlanTier(workspaceId, TRIAL_TIER, {
    source: "trial",
    expiresAt,
    markTrialStarted: true,
  });
  return { expiresAt };
}
