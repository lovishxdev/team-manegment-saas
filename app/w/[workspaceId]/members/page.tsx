import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getWorkspaceMembers, listInvites } from "@/lib/services/workspace";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
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
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <Link
            href={`/w/${workspaceId}`}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Back to board
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">
              {workspace.name} · Members
            </h1>
            {canInvite && <InviteButton workspaceId={workspaceId} />}
          </div>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">
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
            <h2 className="mb-3 text-sm font-medium text-zinc-400">
              Invite links ({invites.length})
            </h2>
            {invites.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-600">
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
    </div>
  );
}
