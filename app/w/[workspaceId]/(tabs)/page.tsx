import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBoardState, ServiceError } from "@/lib/services/project";
import { getWorkspaceMembers } from "@/lib/services/workspace";
import { BoardPageShell } from "@/components/board-page-shell";
import {
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
      tags: t.tags,
      assigneeId: t.assignedTo?.id ?? null,
      assigneeLabel: t.assignedTo?.username ?? t.assignedTo?.email ?? null,
      attachments: t.attachments,
    }));

  const boardMembers: BoardMember[] = members.map((m) => ({
    id: m.user.id,
    label: m.user.username ?? m.user.email,
  }));

  const canInvite = selfRole === "LEADER" || selfRole === "SUB_LEADER";

  return (
    <BoardPageShell
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      tasks={tasks}
      members={boardMembers}
      headerMembers={boardMembers}
      currentUserId={user.id}
      canInvite={canInvite}
    />
  );
}
