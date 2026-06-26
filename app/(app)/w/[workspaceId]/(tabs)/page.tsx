import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBoardView, ServiceError } from "@/lib/services/project";
import { displayUser } from "@/lib/username";
import { BoardPageShell } from "@/components/board-page-shell";
import { type BoardTask } from "@/components/task-board";
import { Role } from "@/lib/generated/prisma/client";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  let boardData;
  try {
    boardData = await getBoardView(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const { workspace, board, selfRole } = boardData;

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
      assigneeLabel: t.assignedTo ? displayUser(t.assignedTo) : null,
      attachments: t.attachments,
    }));

  const canInvite =
    selfRole === Role.LEADER || selfRole === Role.SUB_LEADER;

  return (
    <BoardPageShell
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      tasks={tasks}
      currentUserId={user.id}
      canInvite={canInvite}
    />
  );
}
