import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getWorkspaceTaskFormMeta, ServiceError } from "@/lib/services/project";
import { TaskPage } from "@/components/board/task-page";
import { TaskPageSkeleton } from "@/components/ui/loading";
import {
  parseTaskStatusParam,
  type TaskStatus,
} from "@/lib/task-navigation";

async function NewTaskData({
  workspaceId,
  defaultStatus,
}: {
  workspaceId: string;
  defaultStatus?: TaskStatus;
}) {
  const user = await requireUser();

  let meta;
  try {
    meta = await getWorkspaceTaskFormMeta(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const { workspace, categories } = meta;

  return (
    <TaskPage
      mode="create"
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      categories={categories}
      currentUserId={user.id}
      defaultStatus={defaultStatus}
    />
  );
}

export default async function NewTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const defaultStatus = parseTaskStatusParam(query.status);

  return (
    <Suspense fallback={<TaskPageSkeleton />}>
      <NewTaskData workspaceId={workspaceId} defaultStatus={defaultStatus} />
    </Suspense>
  );
}
