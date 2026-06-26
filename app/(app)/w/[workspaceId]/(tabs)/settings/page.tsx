import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getWorkspaceMembers, listInvites } from "@/lib/services/workspace";
import { prisma } from "@/lib/prisma";
import { DangerZone } from "@/components/settings/danger-zone";
import { InviteRow } from "@/components/members/invite-row";
import { MemberRow } from "@/components/members/member-row";
import { WorkspaceRenameForm } from "@/components/workspace/workspace-rename-form";
import { SettingsContentSkeleton } from "@/components/ui/tab-content-skeleton";

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

  return (
    <>
      <section className="mb-10 max-w-2xl">
        <h2 className="mb-1 text-sm font-semibold text-ink">General</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Rename this workspace. Only leaders can change the name.
        </p>
        {isLeader ? (
          <WorkspaceRenameForm
            workspaceId={workspaceId}
            initialName={workspace.name}
          />
        ) : (
          <p className="rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink">
            {workspace.name}
          </p>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
          Members ({members.length})
        </h2>
        <div className="flex flex-col gap-2">
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
          <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Invite links ({invites.length})
          </h2>
          {invites.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-faint">
              No invites yet. Generate one with the button above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
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
