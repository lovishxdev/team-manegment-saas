import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBoardView, ServiceError } from "@/lib/services/project";
import { displayUser } from "@/lib/username";
import { BoardPageContent } from "@/components/board-page-content";
import { BoardContentSkeleton } from "@/components/tab-content-skeleton";
import { type BoardTask } from "@/components/task-board";

async function BoardData({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const user = await requireUser();

  let boardData;
  try {
    boardData = await getBoardView(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const { board } = boardData;

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

  return (
    <BoardPageContent
      workspaceId={workspaceId}
      tasks={tasks}
      currentUserId={user.id}
    />
  );
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <Suspense fallback={<BoardContentSkeleton />}>
      <BoardData workspaceId={workspaceId} />
    </Suspense>
  );
}
