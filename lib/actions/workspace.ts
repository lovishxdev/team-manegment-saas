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
  searchTasks,
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
  deleteTaskUpdate,
  listTaskUpdates,
  setTaskUpdateSaved,
} from "@/lib/services/task-updates";
import {
  createWorkspaceMessage,
  deleteWorkspaceMessage,
  listWorkspaceMessages,
  setWorkspaceMessageSaved,
} from "@/lib/services/workspace-discussion";
import type { ChatMessageView } from "@/lib/chat-message";
import {
  listMemoryEvents,
  resolveMemoryEvent,
  type MemoryEventRow,
} from "@/lib/services/memory";
import { getMemoryDocument } from "@/lib/memory/documents";

export type ActionState = {
  error?: string;
  workspaceId?: string;
  inviteId?: string;
  shortId?: number;
};

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

export async function createWorkspaceWithInviteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Workspace name is required" };

  const workspace = await createWorkspace(user.id, name);
  refreshUserWorkspaces(user.id, workspace.id);

  try {
    const invite = await createInvite(workspace.id, user.id);
    return { workspaceId: workspace.id, inviteId: invite.id };
  } catch (err) {
    return { workspaceId: workspace.id, error: errorMessage(err) };
  }
}

export async function createTaskFromModalAction(
  workspaceId: string,
  edit: TaskEdit & { title: string }
): Promise<ActionState> {
  const user = await requireUser();
  const title = edit.title.trim();
  if (!title) return { error: "Task title is required" };

  let task;
  try {
    let resolvedCategoryId = edit.categoryId;
    let category: string | undefined;
    if (edit.newCategory?.trim()) {
      const created = await findOrCreateCategoryByName(
        workspaceId,
        edit.newCategory.trim()
      );
      resolvedCategoryId = created.id;
    } else if (!resolvedCategoryId) {
      category = "General";
    }

    let dueDate: Date | null | undefined = undefined;
    if (edit.dueDate !== undefined) {
      dueDate = edit.dueDate ? new Date(edit.dueDate) : null;
    }

    task = await createTask({
      workspaceId,
      title,
      description: edit.description ?? undefined,
      categoryId: resolvedCategoryId,
      category,
      priority: edit.priority,
      dueDate,
      assigneeIds: edit.assigneeIds,
      tags: edit.tags,
      userId: user.id,
    });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/w/${workspaceId}`);
  revalidatePath(`/w/${workspaceId}/tasks/${task.shortId}`);
  return { shortId: task.shortId };
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
  revalidatePath(`/w/${workspaceId}/tasks`, "layout");
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
  revalidatePath(`/w/${workspaceId}/tasks`, "layout");
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
  revalidatePath(`/w/${workspaceId}/tasks`, "layout");
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
  workspaceId: string,
  role?: "MEMBER" | "GUEST"
): Promise<ActionState & { inviteId?: string }> {
  const user = await requireUser();
  try {
    const invite = await createInvite(workspaceId, user.id, {
      role: role === "GUEST" ? "GUEST" : "MEMBER",
    });
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
  revalidatePath(`/w/${workspaceId}/tasks`, "layout");
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

export type TaskLinkOption = {
  shortId: number;
  title: string;
  status: TaskStatus;
};

/** Searchable task list for linking discussions to board tasks. */
export async function searchWorkspaceTasksAction(
  workspaceId: string,
  query?: string
): Promise<{ tasks: TaskLinkOption[]; error?: string }> {
  try {
    const user = await requireUser();
    const tasks = await searchTasks({
      workspaceId,
      userId: user.id,
      query: query?.trim() || undefined,
      limit: 8,
    });
    return {
      tasks: tasks.map((task) => ({
        shortId: task.shortId,
        title: task.title,
        status: task.status,
      })),
    };
  } catch (err) {
    return { tasks: [], error: errorMessage(err) };
  }
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

export type TaskUpdateView = ChatMessageView;
export type WorkspaceMessageView = ChatMessageView;

function toChatMessageView(
  message: {
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; email: string | null; username: string };
    mentionedLabels: string[];
    saved: boolean;
  }
): ChatMessageView {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    authorId: message.author.id,
    authorLabel: displayUser(message.author),
    mentionedLabels: message.mentionedLabels,
    saved: message.saved,
  };
}

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
      updates: updates.map((u) => toChatMessageView(u)),
    };
  } catch (err) {
    return { updates: [], error: errorMessage(err) };
  }
}

export type MemoryEventView = {
  id: string;
  kind: string;
  status: string;
  summary: string;
  reasoning: string | null;
  tags: string[];
  createdAt: string;
  resolvedAt: string | null;
  authorLabel: string | null;
  task: { shortId: number; title: string } | null;
  sourceDocumentPath: string | null;
  sourceDocument: {
    id: string;
    path: string;
    title: string;
    tags: string[];
    updatedAt: string;
    currentVersion: boolean;
  } | null;
  /** Curated by a dream pass yet? False = fresh capture, not reviewed. */
  reviewed: boolean;
};

function toMemoryEventView(e: MemoryEventRow): MemoryEventView {
  return {
    id: e.id,
    kind: e.kind,
    status: e.status,
    summary: e.summary,
    reasoning: e.reasoning,
    tags: e.tags,
    createdAt: e.createdAt.toISOString(),
    resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
    authorLabel: e.author ? displayUser(e.author) : null,
    task: e.task,
    sourceDocumentPath: e.sourceDocumentPath,
    sourceDocument: e.sourceDocument
      ? {
          id: e.sourceDocument.id,
          path: e.sourceDocument.path,
          title: e.sourceDocument.title,
          tags: e.sourceDocument.tags,
          updatedAt: e.sourceDocument.updatedAt.toISOString(),
          currentVersion:
            e.sourceDocumentHash !== null &&
            e.sourceDocument.contentHash === e.sourceDocumentHash,
        }
      : null,
    reviewed: e.dreamedAt !== null,
  };
}

export async function fetchTaskMemoryAction(
  workspaceId: string,
  taskShortId: number
): Promise<{ events: MemoryEventView[]; error?: string }> {
  const user = await requireUser();
  try {
    const events = await listMemoryEvents({
      workspaceId,
      userId: user.id,
      taskShortId,
    });
    return { events: events.map(toMemoryEventView) };
  } catch (err) {
    return { events: [], error: errorMessage(err) };
  }
}

export async function fetchMemoryDocumentAction(
  workspaceId: string,
  documentId: string
): Promise<{ content: string | null; error?: string }> {
  const user = await requireUser();
  try {
    const document = await getMemoryDocument({
      workspaceId,
      userId: user.id,
      documentId,
    });
    return document
      ? { content: document.content }
      : { content: null, error: "Memory document not found" };
  } catch (err) {
    return { content: null, error: errorMessage(err) };
  }
}

export async function resolveMemoryEventAction(
  workspaceId: string,
  eventId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await resolveMemoryEvent({ workspaceId, userId: user.id, eventId });
    revalidatePath(`/w/${workspaceId}/memory`);
    revalidatePath(`/w/${workspaceId}`);
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
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
      update: toChatMessageView(created),
    };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteTaskUpdateAction(
  workspaceId: string,
  updateId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await deleteTaskUpdate({
      workspaceId,
      userId: user.id,
      updateId,
    });
    revalidatePath(`/w/${workspaceId}`);
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function setTaskUpdateSavedAction(
  workspaceId: string,
  updateId: string,
  saved: boolean
): Promise<ActionState & { saved?: boolean }> {
  const user = await requireUser();
  try {
    const nextSaved = await setTaskUpdateSaved({
      workspaceId,
      userId: user.id,
      updateId,
      saved,
    });
    return { saved: nextSaved };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function fetchWorkspaceMessagesAction(
  workspaceId: string
): Promise<{ messages: WorkspaceMessageView[]; error?: string }> {
  const user = await requireUser();
  try {
    const messages = await listWorkspaceMessages(workspaceId, user.id);
    return {
      messages: messages.map((message) => toChatMessageView(message)),
    };
  } catch (err) {
    return { messages: [], error: errorMessage(err) };
  }
}

export async function addWorkspaceMessageAction(
  workspaceId: string,
  body: string
): Promise<ActionState & { message?: WorkspaceMessageView }> {
  const user = await requireUser();
  try {
    const created = await createWorkspaceMessage({
      workspaceId,
      userId: user.id,
      body,
    });
    return {
      message: toChatMessageView(created),
    };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteWorkspaceMessageAction(
  workspaceId: string,
  messageId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await deleteWorkspaceMessage({
      workspaceId,
      userId: user.id,
      messageId,
    });
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function setWorkspaceMessageSavedAction(
  workspaceId: string,
  messageId: string,
  saved: boolean
): Promise<ActionState & { saved?: boolean }> {
  const user = await requireUser();
  try {
    const nextSaved = await setWorkspaceMessageSaved({
      workspaceId,
      userId: user.id,
      messageId,
      saved,
    });
    return { saved: nextSaved };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
