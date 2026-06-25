import {
  refresh,
  revalidatePath,
  revalidateTag,
  updateTag,
} from "next/cache";

export function userWorkspacesTag(userId: string) {
  return `workspaces-${userId}`;
}

function revalidateWorkspacePaths(workspaceId?: string) {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/settings", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  if (workspaceId) {
    revalidatePath(`/w/${workspaceId}`);
    revalidatePath(`/w/${workspaceId}/settings`);
    revalidatePath(`/w/${workspaceId}/assets`);
    revalidatePath(`/w/${workspaceId}/whiteboard`);
  }
}

/** Server Actions — read-your-own-writes + refresh client router cache. */
export function refreshUserWorkspaces(userId: string, workspaceId?: string) {
  updateTag(userWorkspacesTag(userId));
  refresh();
  revalidateWorkspacePaths(workspaceId);
}

/** Route handlers / webhooks — purge tagged cache on demand. */
export function revalidateUserWorkspaces(userId: string, workspaceId?: string) {
  revalidateTag(userWorkspacesTag(userId), { expire: 0 });
  revalidateWorkspacePaths(workspaceId);
}
