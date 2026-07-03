"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  TaskPriority,
  TaskStatus,
} from "@/lib/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { refreshUserWorkspaces } from "@/lib/revalidate-nav";
import {
  createTask,
  deleteAsset,
  deleteTask,
  ServiceError,
  updateAssetTags,
  updateTask,
  uploadAsset,
} from "@/lib/services/project";
import { Role } from "@/lib/generated/prisma/client";
import {
  acceptInvite,
  createInvite,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  leaveWorkspace,
  removeMember,
  renameWorkspace,
  revokeInvite,
  saveExcalidrawState,
  updateMemberRole,
} from "@/lib/services/workspace";
import {
  createWorkspaceLink,
  deleteWorkspaceLink,
  toggleWorkspaceLinkPin,
} from "@/lib/services/links";
import { displayUser } from "@/lib/username";
import { findOrCreateCategoryByName } from "@/lib/services/categories";
import {
  createTaskUpdate,
  listTaskUpdates,
} from "@/lib/services/task-updates";

export type ActionState = { error?: string; workspaceId?: string };

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
  refreshUserWorkspaces(user.id, workspace.id);
  return { workspaceId: workspace.id };
}

export async function createTaskAction(
  workspaceId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const newCategory = String(formData.get("newCategory") ?? "").trim();
  if (!title) return { error: "Task title is required" };

  try {
    let resolvedCategoryId = categoryId || undefined;
    let category: string | undefined;
    if (newCategory) {
      const created = await findOrCreateCategoryByName(workspaceId, newCategory);
      resolvedCategoryId = created.id;
    } else if (!resolvedCategoryId) {
      category = "General";
    }

    await createTask({
      workspaceId,
      title,
      categoryId: resolvedCategoryId,
      category,
      userId: user.id,
    });
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
  categoryId?: string;
  newCategory?: string;
  priority?: TaskPriority;
  /** ISO date string (yyyy-mm-dd) or null to clear */
  dueDate?: string | null;
  /** Full replacement list of free-form tags. */
  tags?: string[];
  /** Full replacement list of assignee user ids. */
  assigneeIds?: string[];
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
    let categoryId = edit.categoryId;
    let category: string | undefined;
    if (edit.newCategory?.trim()) {
      const created = await findOrCreateCategoryByName(
        workspaceId,
        edit.newCategory.trim()
      );
      categoryId = created.id;
    }

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
      categoryId,
      category,
      priority: edit.priority,
      dueDate,
      tags: edit.tags,
      assigneeIds: edit.assigneeIds,
    });
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

export async function renameWorkspaceAction(
  workspaceId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Workspace name is required" };

  try {
    await renameWorkspace(workspaceId, user.id, name);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshUserWorkspaces(user.id, workspaceId);
  revalidatePath(`/w/${workspaceId}/settings`);
  return {};
}

export async function createInviteAction(
  workspaceId: string
): Promise<ActionState & { inviteId?: string }> {
  const user = await requireUser();
  try {
    const invite = await createInvite(workspaceId, user.id);
    revalidatePath(`/w/${workspaceId}/settings`);
    return { inviteId: invite.id };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // keep in sync with next.config bodySizeLimit

export async function uploadAssetAction(
  workspaceId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "File is too large (max 10 MB)" };
  }

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const taskId = String(formData.get("taskId") ?? "") || undefined;

  try {
    await uploadAsset({
      workspaceId,
      uploadedById: user.id,
      file: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      tags,
      taskId,
    });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}/assets`);
  revalidatePath(`/w/${workspaceId}`);
  return {};
}

export async function updateAssetTagsAction(
  workspaceId: string,
  assetId: string,
  tags: string[]
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updateAssetTags({
      workspaceId,
      assetId,
      userId: user.id,
      tags,
    });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}/assets`);
  return {};
}

export async function deleteAssetAction(
  workspaceId: string,
  assetId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await deleteAsset({ workspaceId, assetId, userId: user.id });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}/assets`);
  return {};
}

export async function createLinkAction(
  workspaceId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  try {
    await createWorkspaceLink({
      workspaceId,
      userId: user.id,
      title,
      url,
      description: description || null,
    });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}/links`);
  return {};
}

export async function deleteLinkAction(
  workspaceId: string,
  linkId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await deleteWorkspaceLink({ workspaceId, linkId, userId: user.id });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}/links`);
  return {};
}

export async function toggleLinkPinAction(
  workspaceId: string,
  linkId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await toggleWorkspaceLinkPin({ workspaceId, linkId, userId: user.id });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}/links`);
  return {};
}

export async function saveWhiteboardAction(
  workspaceId: string,
  serialized: string
): Promise<ActionState> {
  const user = await requireUser();

  let state: unknown;
  try {
    state = JSON.parse(serialized);
  } catch {
    return { error: "Invalid whiteboard data" };
  }

  try {
    await saveExcalidrawState(workspaceId, user.id, state);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  // No revalidatePath: the canvas owns its state client-side; revalidating
  // would needlessly re-render the page on every autosave.
  return {};
}

export async function updateMemberRoleAction(
  workspaceId: string,
  targetUserId: string,
  role: Role
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updateMemberRole(workspaceId, user.id, targetUserId, role);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}/settings`);
  return {};
}

export async function removeMemberAction(
  workspaceId: string,
  targetUserId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await removeMember(workspaceId, user.id, targetUserId);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}/settings`);
  return {};
}

export async function leaveWorkspaceAction(
  workspaceId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await leaveWorkspace(workspaceId, user.id);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshUserWorkspaces(user.id);
  redirect("/dashboard");
}

export async function deleteWorkspaceAction(
  workspaceId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await deleteWorkspace(workspaceId, user.id);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshUserWorkspaces(user.id);
  redirect("/dashboard");
}

export async function revokeInviteAction(
  workspaceId: string,
  inviteId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await revokeInvite(inviteId, user.id);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}/settings`);
  return {};
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
  refreshUserWorkspaces(user.id, workspaceId);
  redirect(`/w/${workspaceId}`);
}

/** Loaded on demand when opening board filters or a task — not on initial page load. */
export async function fetchWorkspaceMemberLabelsAction(workspaceId: string) {
  const user = await requireUser();
  const { members } = await getWorkspaceMembers(workspaceId, user.id);
  return members.map((m) => ({
    id: m.user.id,
    label: displayUser(m.user),
  }));
}

export type TaskUpdateView = {
  id: string;
  body: string;
  createdAt: string;
  authorLabel: string;
};

export async function fetchTaskUpdatesAction(
  workspaceId: string,
  taskShortId: number
): Promise<{ updates: TaskUpdateView[]; error?: string }> {
  const user = await requireUser();
  try {
    const { updates } = await listTaskUpdates(
      workspaceId,
      user.id,
      taskShortId
    );
    return {
      updates: updates.map((u) => ({
        id: u.id,
        body: u.body,
        createdAt: u.createdAt.toISOString(),
        authorLabel: displayUser(u.author),
      })),
    };
  } catch (err) {
    return { updates: [], error: errorMessage(err) };
  }
}

export async function addTaskUpdateAction(
  workspaceId: string,
  taskShortId: number,
  body: string
): Promise<ActionState & { update?: TaskUpdateView }> {
  const user = await requireUser();
  try {
    const created = await createTaskUpdate({
      workspaceId,
      userId: user.id,
      shortId: taskShortId,
      body,
    });
    revalidatePath(`/w/${workspaceId}`);
    return {
      update: {
        id: created.id,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
        authorLabel: displayUser(created.author),
      },
    };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
