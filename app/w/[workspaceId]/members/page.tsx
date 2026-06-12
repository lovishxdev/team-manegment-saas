import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getWorkspaceMembers, listInvites } from "@/lib/services/workspace";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { DangerZone } from "@/components/danger-zone";
import { InviteButton } from "@/components/invite-button";
import { InviteRow } from "@/components/invite-row";
import { MemberRow } from "@/components/member-row";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
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
    <AppShell
      userId={user.id}
      userLabel={user.username ?? user.email}
      activeWorkspaceId={workspaceId}
      activeTab="members"
    >
      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Members
          </h1>
          {canInvite && <InviteButton workspaceId={workspaceId} />}
        </div>

        <section className="mb-8">
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
          <section className="mb-8">
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

        <DangerZone
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          isLeader={isLeader}
        />
      </main>
    </AppShell>
  );
}
