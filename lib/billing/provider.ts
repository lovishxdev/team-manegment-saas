import type { PlanTier } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLAN_TIER } from "@/lib/billing/plans";

/**
 * Billing provider abstraction. Enforcement code (entitlements.ts) only
 * talks to this interface, so swapping the stub for Stripe later never
 * touches the enforcement call sites.
 */
export interface BillingProvider {
  /** Effective tier for a workspace (respects expiry). */
  getWorkspacePlan(workspaceId: string): Promise<PlanTier>;
}

/** Resolve the effective tier from stored fields (expired paid plan → default). */
export function effectiveTier(
  planTier: PlanTier,
  planExpiresAt: Date | null
): PlanTier {
  const expired = planExpiresAt !== null && planExpiresAt.getTime() < Date.now();
  return expired ? DEFAULT_PLAN_TIER : planTier;
}

/**
 * Stub provider: reads Workspace.planTier directly. An expired paid plan
 * (planExpiresAt in the past) falls back to the default (Hobby) tier.
 * Everyone is Hobby unless an admin flips the field.
 */
export class StubBillingProvider implements BillingProvider {
  async getWorkspacePlan(workspaceId: string): Promise<PlanTier> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { planTier: true, planExpiresAt: true },
    });
    if (!workspace) return DEFAULT_PLAN_TIER;

    return effectiveTier(workspace.planTier, workspace.planExpiresAt);
  }
}

let provider: BillingProvider = new StubBillingProvider();

export function billingProvider(): BillingProvider {
  return provider;
}

/** Test/seams: swap the provider (e.g. StripeBillingProvider later). */
export function setBillingProvider(next: BillingProvider): void {
  provider = next;
}
