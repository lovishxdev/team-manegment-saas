import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBoardView, ServiceError } from "@/lib/services/project";
import { displayUser } from "@/lib/username";
import { BoardPageContent } from "@/components/board/board-page-content";
import { BoardContentSkeleton } from "@/components/ui/tab-content-skeleton";
import { type BoardTask } from "@/components/board/task-board";

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

  const { board, categories } = boardData;

  const tasks: BoardTask[] = Object.values(board)
    .flat()
    .map((t) => ({
      id: t.id,
      shortId: t.shortId,
      title: t.title,
      description: t.description,
      status: t.status,
      categoryId: t.category.id,
      categoryName: t.category.name,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      tags: t.tags,
      assignees: t.assignees.map((a) => ({
        id: a.user.id,
        label: displayUser(a.user),
      })),
      attachments: t.attachments,
    }));

  return (
    <BoardPageContent
      workspaceId={workspaceId}
      tasks={tasks}
      categories={categories}
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
