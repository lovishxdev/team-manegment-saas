import { prisma } from "@/lib/prisma";
import { ServiceError, touchLastActiveWorkspace } from "@/lib/services/project";
import { sendWhatsAppList } from "@/lib/whatsapp-messages";

const WS_PICK_PREFIX = "ws_pick_";

export function workspacePickId(workspaceId: string): string {
  return `${WS_PICK_PREFIX}${workspaceId}`;
}

export function parseWorkspacePickId(buttonId: string): string | null {
  if (!buttonId.startsWith(WS_PICK_PREFIX)) return null;
  const id = buttonId.slice(WS_PICK_PREFIX.length);
  return id.length > 0 ? id : null;
}

/** Multiple memberships and no pinned active workspace — ask before acting. */
export async function shouldPromptWorkspacePick(
  userId: string
): Promise<boolean> {
  const [count, user] = await Promise.all([
    prisma.workspaceMembership.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveWorkspaceId: true },
    }),
  ]);
  return count > 1 && !user?.lastActiveWorkspaceId;
}

export async function listWorkspacePickerOptions(userId: string) {
  return prisma.workspaceMembership.findMany({
    where: { userId },
    select: { workspace: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
  });
}

export async function sendWorkspacePicker(
  to: string,
  workspaces: { id: string; name: string }[],
  body = "You belong to multiple workspaces. Which one should I use for this request?"
): Promise<boolean> {
  if (workspaces.length === 0) return false;

  return sendWhatsAppList(
    to,
    body,
    "Pick workspace",
    [
      {
        title: "Your workspaces",
        rows: workspaces.map((w) => ({
          id: workspacePickId(w.id),
          title: w.name.slice(0, 24),
          description: "Use this workspace",
        })),
      },
    ],
    { header: "Euclis", footer: "You can switch anytime" }
  );
}

export async function activateWorkspace(
  userId: string,
  workspaceId: string
): Promise<{ workspaceId: string; workspaceName: string }> {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!membership) {
    throw new ServiceError(
      "That workspace is not in your account",
      "NOT_FOUND"
    );
  }
  await touchLastActiveWorkspace(userId, workspaceId);
  return {
    workspaceId: membership.workspace.id,
    workspaceName: membership.workspace.name,
  };
}
