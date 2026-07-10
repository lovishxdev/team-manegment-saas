"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { setWorkspacePlanTier } from "@/lib/billing/entitlements";
import type { PlanTier } from "@/lib/generated/prisma/client";

const VALID_TIERS: PlanTier[] = ["HOBBY", "TEAM", "BUSINESS"];

/** Admin-only: set a workspace's billing tier (local dev gated by requireAdmin). */
export async function setWorkspacePlanAction(
  workspaceId: string,
  tier: PlanTier
): Promise<{ error?: string }> {
  await requireAdmin();
  if (!VALID_TIERS.includes(tier)) {
    return { error: "Invalid tier" };
  }
  await setWorkspacePlanTier(workspaceId, tier);
  revalidatePath("/admin/plans");
  return {};
}
