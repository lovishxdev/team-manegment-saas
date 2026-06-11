"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  TaskPriority,
  TaskScope,
  TaskStatus,
} from "@/lib/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import {
  assignTask,
  createTask,
  deleteTask,
  ServiceError,
  updateTask,
  updateTaskStatus,
} from "@/lib/services/project";
import {
  acceptInvite,
  createInvite,
  createWorkspace,
} from "@/lib/services/workspace";

export type ActionState = { error?: string };

function errorMessage(err: unknown): string {
  return err instanceof ServiceError ? err.message : "Something went wrong";
}

export async function createWorkspaceAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Workspace name is required" };

  const workspace = await createWorkspace(user.id, name);
  redirect(`/w/${workspace.id}`);
}

export async function createTaskAction(
  workspaceId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const scope = String(formData.get("scope") ?? "GENERAL") as TaskScope;
  if (!title) return { error: "Task title is required" };

  try {
    await createTask({ workspaceId, title, scope, userId: user.id });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}`);
  return {};
}

export type TaskEdit = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  scope?: TaskScope;
  priority?: TaskPriority;
  /** ISO date string (yyyy-mm-dd) or null to clear */
  dueDate?: string | null;
  assignee?: string | null;
};

export async function updateTaskAction(
  workspaceId: string,
  taskId: string,
  edit: TaskEdit
): Promise<ActionState> {
  const user = await requireUser();

  let dueDate: Date | null | undefined = undefined;
  if (edit.dueDate !== undefined) {
    if (edit.dueDate === null || edit.dueDate === "") {
      dueDate = null;
    } else {
      const parsed = new Date(edit.dueDate);
      if (isNaN(parsed.getTime())) return { error: "Invalid due date" };
      dueDate = parsed;
    }
  }

  try {
    await updateTask({
      workspaceId,
      taskId,
      userId: user.id,
      title: edit.title?.trim() || undefined,
      description:
        edit.description === undefined
          ? undefined
          : edit.description?.trim() || null,
      status: edit.status,
      scope: edit.scope,
      priority: edit.priority,
      dueDate,
      assignee: edit.assignee,
    });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}`);
  return {};
}

export async function updateTaskStatusAction(
  workspaceId: string,
  taskId: string,
  status: TaskStatus
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updateTaskStatus({ workspaceId, taskId, status, userId: user.id });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}`);
  return {};
}

export async function deleteTaskAction(
  workspaceId: string,
  taskId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await deleteTask({ workspaceId, taskId, userId: user.id });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}`);
  return {};
}

export async function assignTaskAction(
  workspaceId: string,
  taskId: string,
  assigneeId: string | null
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await assignTask({ workspaceId, taskId, assigneeId, userId: user.id });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}`);
  return {};
}

export async function createInviteAction(
  workspaceId: string
): Promise<ActionState & { inviteId?: string }> {
  const user = await requireUser();
  try {
    const invite = await createInvite(workspaceId, user.id);
    return { inviteId: invite.id };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function acceptInviteAction(inviteId: string): Promise<ActionState> {
  const user = await requireUser();
  let workspaceId: string;
  try {
    const workspace = await acceptInvite(inviteId, user.id);
    workspaceId = workspace.id;
  } catch (err) {
    return { error: errorMessage(err) };
  }
  redirect(`/w/${workspaceId}`);
}
