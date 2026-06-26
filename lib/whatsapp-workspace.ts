import { prisma } from "@/lib/prisma";
import { ServiceError, touchLastActiveWorkspace } from "@/lib/services/project";
import { sendWhatsAppText } from "@/lib/whatsapp";
import {
  sendWhatsAppList,
  WHATSAPP_LIST_MAX_ROWS,
} from "@/lib/whatsapp-messages";

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

export async function userHasAnyWorkspace(userId: string): Promise<boolean> {
  const count = await prisma.workspaceMembership.count({ where: { userId } });
  return count > 0;
}

export function formatNoWorkspaceWhatsAppReply(dashboardUrl: string): string {
  const url = `${dashboardUrl.replace(/\/$/, "")}/dashboard`;
  return [
    "You don't have a workspace yet.",
    "",
    'Say something like: *create a workspace called My Team*',
    "",
    "Or create one in the dashboard:",
    url,
  ].join("\n");
}

function chunkWorkspaces<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

async function sendWorkspacePickerTextFallback(
  to: string,
  workspaces: { id: string; name: string }[],
  body: string
): Promise<boolean> {
  const lines = workspaces
    .map((w, i) => `${i + 1}. *${w.name.trim()}*`)
    .join("\n");
  return sendWhatsAppText(
    to,
    `${body}\n\n${lines}\n\nReply with the workspace name to switch.`
  );
}

export async function sendWorkspacePicker(
  to: string,
  workspaces: { id: string; name: string }[],
  body = "You belong to multiple workspaces. Which one should I use for this request?"
): Promise<boolean> {
  const valid = workspaces.filter((w) => w.id && w.name?.trim());
  if (valid.length === 0) return false;

  const pages = chunkWorkspaces(valid, WHATSAPP_LIST_MAX_ROWS);
  const totalPages = pages.length;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageNum = i + 1;
    const isFirst = pageNum === 1;
    const isLast = pageNum === totalPages;

    const listBody = isFirst
      ? totalPages > 1
        ? `${body}\n\nTap a workspace below. ${totalPages} lists in total.`
        : body
      : `More workspaces (${pageNum} of ${totalPages}):`;

    const sent = await sendWhatsAppList(
      to,
      listBody,
      totalPages === 1 ? "Pick workspace" : `Page ${pageNum}`,
      [
        {
          title:
            totalPages === 1
              ? "Your workspaces"
              : `Workspaces ${pageNum}/${totalPages}`,
          rows: page.map((w) => ({
            id: workspacePickId(w.id),
            title: w.name.trim().slice(0, 24),
            description: "Use this workspace",
          })),
        },
      ],
      {
        header: isFirst ? "Euclis" : "More workspaces",
        footer: isLast ? "You can switch anytime" : undefined,
      }
    );

    if (!sent) {
      return sendWorkspacePickerTextFallback(to, valid, body);
    }
  }

  return true;
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
