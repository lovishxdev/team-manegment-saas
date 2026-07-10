import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getWorkspaceMembers } from "@/lib/services/workspace";
import { getWorkspaceChrome } from "@/lib/services/workspace-chrome";
import { getWorkspaceEntitlements, memberCapReached } from "@/lib/billing/entitlements";
import { displayUser } from "@/lib/username";
import { WorkspaceHeaderActions } from "@/components/workspace/workspace-header-actions";

/** Header member avatars + invite button — streams separately from tab content. */
export async function WorkspaceHeaderActionsLoader({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const user = await requireUser();

  try {
    const [{ canInvite }, { members }, { tier, limits }] = await Promise.all([
      getWorkspaceChrome(workspaceId, user.id),
      getWorkspaceMembers(workspaceId, user.id),
      getWorkspaceEntitlements(workspaceId),
    ]);

    const nonGuestCount = members.filter((m) => m.role !== "GUEST").length;
    const inviteCapReason =
      canInvite && memberCapReached(tier, nonGuestCount)
        ? `Member limit reached (${limits.maxMembers}). Upgrade to invite more.`
        : undefined;

    return (
      <WorkspaceHeaderActions
        members={members.map((m) => ({
          id: m.user.id,
          label: displayUser(m.user),
        }))}
        workspaceId={workspaceId}
        canInvite={canInvite}
        inviteCapReason={inviteCapReason}
        canInviteGuest={canInvite && limits.guestAccess}
      />
    );
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }
}
