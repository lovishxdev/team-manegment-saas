import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getWorkspaceMembers, listInvites } from "@/lib/services/workspace";
import { getWorkspaceMemoryAnalytics } from "@/lib/services/workspace-analytics";
import { workspaceFeature } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/prisma";
import { DangerZone } from "@/components/settings/danger-zone";
import { WorkspaceMemoryInsights } from "@/components/workspace/workspace-memory-insights";
import { InviteRow } from "@/components/members/invite-row";
import { MemberRow } from "@/components/members/member-row";
import { WorkspaceRenameForm } from "@/components/workspace/workspace-rename-form";
import { SettingsContentSkeleton } from "@/components/ui/tab-content-skeleton";
import { ui } from "@/components/ui/ui";

async function SettingsData({ workspaceId }: { workspaceId: string }) {
  const user = await requireUser();

  let memberData;
  let workspace;
  try {
    [memberData, workspace] = await Promise.all([
      getWorkspaceMembers(workspaceId, user.id),
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { id: true, name: true },
      }),
    ]);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const { selfRole, members } = memberData;
  const isLeader = selfRole === "LEADER";
  const canInvite = isLeader || selfRole === "SUB_LEADER";
  const invites = canInvite ? await listInvites(workspaceId, user.id) : [];

  // Leader analytics (Team+): workspace-scoped memory insights for leaders.
  const analytics =
    canInvite && (await workspaceFeature(workspaceId, "leaderAnalytics"))
      ? await getWorkspaceMemoryAnalytics(workspaceId, user.id).catch(() => null)
      : null;

  return (
    <>
      {analytics ? (
        <section className="mb-10">
          <h2 className={ui.settingsSectionTitle}>Project insights</h2>
          <p className={`${ui.fieldHint} mb-4`}>
            A snapshot of your workspace&apos;s memory — decisions, blockers, and
            curation health.
          </p>
          <WorkspaceMemoryInsights analytics={analytics} />
        </section>
      ) : null}

      <section className="mb-10 max-w-2xl">
        <h2 className={ui.settingsSectionTitle}>General</h2>
        <p className={`${ui.fieldHint} mb-4`}>
          Rename this workspace. Only leaders can change the name.
        </p>
        {isLeader ? (
          <WorkspaceRenameForm
            workspaceId={workspaceId}
            initialName={workspace.name}
          />
        ) : (
          <p className="rounded-lg border border-line bg-white px-3.5 py-3 text-[15px] text-ink shadow-[0_1px_3px_rgba(26,26,26,0.04)]">
            {workspace.name}
          </p>
        )}
      </section>

      <section className="mb-10">
        <h2 className={ui.settingsSectionTitle}>Members ({members.length})</h2>
        <p className={`${ui.fieldHint} mb-4`}>
          Manage roles and remove members from this workspace.
        </p>
        <div className="flex flex-col gap-3">
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              workspaceId={workspaceId}
              member={{
                userId: m.user.id,
                email: m.user.email,
                username: m.user.username,
                role: m.role,
                joinedAt: m.joinedAt.toISOString(),
              }}
              canManage={isLeader}
              isSelf={m.user.id === user.id}
            />
          ))}
        </div>
      </section>

      {canInvite && (
        <section className="mb-10">
          <h2 className={ui.settingsSectionTitle}>
            Invite links ({invites.length})
          </h2>
          <p className={`${ui.fieldHint} mb-4`}>
            Share links to invite new members. Revoke any link that should no
            longer work.
          </p>
          {invites.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-faint">
              No invites yet. Generate one with the button above.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {invites.map((invite) => (
                <InviteRow
                  key={invite.id}
                  workspaceId={workspaceId}
                  invite={{
                    id: invite.id,
                    usesCount: invite.usesCount,
                    maxUses: invite.maxUses,
                    expiresAt: invite.expiresAt.toISOString(),
                    active: invite.active,
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mb-8 max-w-2xl">
        <h2 className={ui.settingsSectionTitle}>Danger zone</h2>
        <p className={`${ui.fieldHint} mb-4`}>
          Leave or permanently delete this workspace.
        </p>
        <DangerZone
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          isLeader={isLeader}
        />
      </section>
    </>
  );
}

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <Suspense fallback={<SettingsContentSkeleton />}>
      <SettingsData workspaceId={workspaceId} />
    </Suspense>
  );
}
