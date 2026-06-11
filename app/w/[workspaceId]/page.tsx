import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBoardState, ServiceError } from "@/lib/services/project";
import { getWorkspaceMembers } from "@/lib/services/workspace";
import { AppNav } from "@/components/app-nav";
import { InviteButton } from "@/components/invite-button";
import { NewTaskForm } from "@/components/new-task-form";
import {
  TaskBoard,
  type BoardMember,
  type BoardTask,
} from "@/components/task-board";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  let boardData;
  let memberData;
  try {
    [boardData, memberData] = await Promise.all([
      getBoardState(workspaceId, user.id),
      getWorkspaceMembers(workspaceId, user.id),
    ]);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const { workspace, board } = boardData;
  const { selfRole, members } = memberData;

  const tasks: BoardTask[] = Object.values(board)
    .flat()
    .map((t) => ({
      id: t.id,
      shortId: t.shortId,
      title: t.title,
      description: t.description,
      status: t.status,
      scope: t.scope,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      assigneeId: t.assignedTo?.id ?? null,
      assigneeEmail: t.assignedTo?.email ?? null,
      attachments: t.attachments,
    }));

  const boardMembers: BoardMember[] = members.map((m) => ({
    id: m.user.id,
    email: m.user.email,
  }));

  const canInvite = selfRole === "LEADER" || selfRole === "SUB_LEADER";

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {workspace.name}
            </h1>
            <div className="mt-1 flex gap-3 text-xs text-zinc-500">
              <Link
                href={`/w/${workspace.id}/members`}
                className="transition hover:text-indigo-300"
              >
                {members.length} member{members.length === 1 ? "" : "s"} →
              </Link>
              <Link
                href={`/w/${workspace.id}/assets`}
                className="transition hover:text-indigo-300"
              >
                assets →
              </Link>
              <Link
                href={`/w/${workspace.id}/whiteboard`}
                className="transition hover:text-indigo-300"
              >
                whiteboard →
              </Link>
            </div>
          </div>
          {canInvite && <InviteButton workspaceId={workspace.id} />}
        </div>

        <div className="mb-6 max-w-2xl">
          <NewTaskForm workspaceId={workspace.id} />
        </div>

        <TaskBoard
          workspaceId={workspace.id}
          tasks={tasks}
          members={boardMembers}
          currentUserId={user.id}
        />
      </main>
    </div>
  );
}
