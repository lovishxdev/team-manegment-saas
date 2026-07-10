import type { PlanTier } from "@/lib/generated/prisma/client";

/**
 * Per-tier limits. Single source of truth for entitlement enforcement.
 *
 * `null` means unlimited. Numbers are hard caps enforced at the service
 * layer via lib/billing/entitlements.ts. Downgrade policy is "grandfather
 * existing, block new growth" — see assertWithinMemberLimit etc.
 */
export type PlanLimits = {
  /** Max members per workspace (including leaders). */
  maxMembers: number | null;
  /** Max workspaces a single user can lead (create). User-scoped. */
  maxWorkspacesLed: number | null;
  /** Memory recall/query window in days. Older events are hidden, never deleted. */
  memoryRetentionDays: number | null;
  /** Max open (non-resolved) discussions per workspace. */
  maxOpenDiscussions: number | null;
  /** Highest MCP scope this tier may use: "context" or "full". */
  maxMcpScope: "context" | "full";
  /** WhatsApp bot access. Always true today (adoption wedge). */
  whatsapp: boolean;
  /**
   * Curated project memory (Dreaming): dedupe, contradiction resolution, and
   * INSIGHT patterns. Hobby gets raw capture only; Team+ gets the tended store.
   */
  curatedMemory: boolean;
  /**
   * Connected ambient coding-agent seats (editor hooks). `null` = unlimited.
   * Hobby includes 1 free seat; a second engineer's editor brief is an upgrade.
   */
  ambientAgentSeats: number | null;
  /** New-member onboarding brief + history backfill (Team-only onboarding tool). */
  onboardingBrief: boolean;
  /** Automatic cross-member blocker routing (ping the assignee they block). */
  blockerRouting: boolean;
  /** Workspace-leader analytics (blocked work, decision velocity, memory health). */
  leaderAnalytics: boolean;
  /** Guest / client access — external collaborators on a workspace. */
  guestAccess: boolean;
  /** Custom subdomain (Business). Reserved flag; routing not built yet. */
  customSubdomain: boolean;
  /** SSO (Business). Reserved flag; auth not built yet. */
  sso: boolean;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  HOBBY: {
    maxMembers: 5,
    maxWorkspacesLed: 1,
    memoryRetentionDays: 30,
    maxOpenDiscussions: 15,
    maxMcpScope: "context",
    whatsapp: true,
    curatedMemory: false,
    ambientAgentSeats: 1,
    onboardingBrief: false,
    blockerRouting: false,
    leaderAnalytics: false,
    guestAccess: false,
    customSubdomain: false,
    sso: false,
  },
  TEAM: {
    maxMembers: 25,
    maxWorkspacesLed: 5,
    memoryRetentionDays: 365,
    maxOpenDiscussions: null,
    maxMcpScope: "full",
    whatsapp: true,
    curatedMemory: true,
    ambientAgentSeats: null,
    onboardingBrief: true,
    blockerRouting: true,
    leaderAnalytics: true,
    guestAccess: true,
    customSubdomain: false,
    sso: false,
  },
  BUSINESS: {
    maxMembers: null,
    maxWorkspacesLed: null,
    memoryRetentionDays: null,
    maxOpenDiscussions: null,
    maxMcpScope: "full",
    whatsapp: true,
    curatedMemory: true,
    ambientAgentSeats: null,
    onboardingBrief: true,
    blockerRouting: true,
    leaderAnalytics: true,
    guestAccess: true,
    customSubdomain: true,
    sso: true,
  },
};

export const DEFAULT_PLAN_TIER: PlanTier = "HOBBY";

export function planLimits(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS[DEFAULT_PLAN_TIER];
}

/** Human-facing tier label for upgrade copy. */
export function planLabel(tier: PlanTier): string {
  switch (tier) {
    case "HOBBY":
      return "Hobby";
    case "TEAM":
      return "Team";
    case "BUSINESS":
      return "Business";
    default:
      return tier;
  }
}
