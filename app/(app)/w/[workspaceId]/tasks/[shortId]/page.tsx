import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { displayUser } from "@/lib/username";
import { mapRowToBoardTask } from "@/lib/board/map-board-task";
import {
  getTask,
  getWorkspaceTaskFormMeta,
  ServiceError,
} from "@/lib/services/project";
import { getWorkspaceMembers } from "@/lib/services/workspace";
import { TaskPage } from "@/components/board/task-page";
import { TaskPageSkeleton } from "@/components/ui/loading";
import { parseTaskTabParam } from "@/lib/task-navigation";

async function TaskDetailData({
  workspaceId,
  shortId,
  initialSection,
}: {
  workspaceId: string;
  shortId: number;
  initialSection?: "updates" | "memory";
}) {
  const user = await requireUser();

  let task;
  let meta;
  let memberRows;
  try {
    [task, meta, { members: memberRows }] = await Promise.all([
      getTask(workspaceId, user.id, shortId),
      getWorkspaceTaskFormMeta(workspaceId, user.id),
      getWorkspaceMembers(workspaceId, user.id),
    ]);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const boardMembers = memberRows.map((member) => ({
    id: member.user.id,
    label: displayUser(member.user),
  }));

  return (
    <TaskPage
      mode="edit"
      workspaceId={workspaceId}
      workspaceName={meta.workspace.name}
      categories={meta.categories}
      currentUserId={user.id}
      task={mapRowToBoardTask(task)}
      members={boardMembers}
      initialSection={initialSection}
    />
  );
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; shortId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ workspaceId, shortId: shortIdRaw }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const shortId = Number.parseInt(shortIdRaw, 10);
  if (!Number.isFinite(shortId)) notFound();
  const initialSection = parseTaskTabParam(query.tab);

  return (
    <Suspense fallback={<TaskPageSkeleton />}>
      <TaskDetailData
        workspaceId={workspaceId}
        shortId={shortId}
        initialSection={initialSection}
      />
    </Suspense>
  );
}
