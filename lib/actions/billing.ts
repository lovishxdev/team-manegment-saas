"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getActorMembership, ServiceError } from "@/lib/services/project";
import {
  getUserWorkspacesLedStatus,
  getWorkspaceLimitStatus,
  listUserLedWorkspacesForTrial,
  startTeamTrial,
  type TrialEligibleWorkspace,
  type UserWorkspacesLedStatus,
  type WorkspaceLimitStatus,
} from "@/lib/billing/entitlements";

/** Tier + usage snapshot for a workspace (UI upgrade hints). Member-gated. */
export async function fetchWorkspaceLimitsAction(
  workspaceId: string
): Promise<{ status?: WorkspaceLimitStatus; error?: string }> {
  const user = await requireUser();
  try {
    const membership = await getActorMembership(user.id, workspaceId);
    if (!membership) {
      throw new ServiceError(
        "You are not a member of this workspace",
        "FORBIDDEN"
      );
    }
    const status = await getWorkspaceLimitStatus(workspaceId);
    return { status };
  } catch (err) {
    return {
      error:
        err instanceof ServiceError
          ? err.message
          : "Could not load plan limits.",
    };
  }
}

/** Workspaces-led usage for the signed-in user (create-workspace hint). */
export async function fetchWorkspacesLedStatusAction(): Promise<{
  status?: UserWorkspacesLedStatus;
  error?: string;
}> {
  const user = await requireUser();
  try {
    const status = await getUserWorkspacesLedStatus(user.id);
    return { status };
  } catch {
    return { error: "Could not load plan limits." };
  }
}

/** Workspaces the user leads + trial eligibility (pricing Team CTA). */
export async function fetchTrialEligibleWorkspacesAction(): Promise<{
  workspaces?: TrialEligibleWorkspace[];
  error?: string;
}> {
  const user = await requireUser();
  try {
    const workspaces = await listUserLedWorkspacesForTrial(user.id);
    return { workspaces };
  } catch {
    return { error: "Could not load your workspaces." };
  }
}

/** Start a free Team trial on a workspace the user leads. */
export async function startTeamTrialAction(
  workspaceId: string
): Promise<{ expiresAt?: string; error?: string }> {
  const user = await requireUser();
  try {
    const { expiresAt } = await startTeamTrial(workspaceId, user.id);
    revalidatePath(`/w/${workspaceId}`);
    revalidatePath("/pricing");
    return { expiresAt: expiresAt.toISOString() };
  } catch (err) {
    return {
      error:
        err instanceof ServiceError
          ? err.message
          : "Could not start the trial. Please try again.",
    };
  }
}
