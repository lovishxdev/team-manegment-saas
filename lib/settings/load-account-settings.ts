import { requireUser } from "@/lib/auth";
import { getMcpConnectorUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import {
  listWhatsAppChatHistory,
  userHasInitiatedWhatsAppChat,
} from "@/lib/services/conversation";
import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
  whatsAppBotDeepLink,
} from "@/lib/whatsapp-bot";
export type McpOAuthConnection = {
  clientName: string;
  scope: string;
  workspaceId: string | null;
};

export type AccountSettingsData = {
  user: {
    username: string;
    email: string | null;
    phone: string | null;
    mcpScope: string;
    mcpWorkspaceId: string | null;
    /** Personal bearer token — used by the ambient-memory hook installer. */
    mcpToken: string;
  };
  whatsAppBotNumber: string | null;
  whatsAppBotDisplay: string | null;
  whatsAppDeepLink: string | null;
  showWhatsAppHistory: boolean;
  whatsAppHistory: Awaited<ReturnType<typeof listWhatsAppChatHistory>>;
  mcpConnectorUrl: string;
  mcpOAuthConnections: McpOAuthConnection[];
  workspaces: { id: string; name: string }[];
  deleteConfirmLabel: string;
};

export async function loadAccountSettingsData(): Promise<AccountSettingsData> {
  const user = await requireUser();
  const whatsAppBotNumber = getWhatsAppBotNumber();
  const mcpConnectorUrl = await getMcpConnectorUrl();
  const showWhatsAppHistory =
    Boolean(user.phone) || (await userHasInitiatedWhatsAppChat(user.id));
  const whatsAppHistory = showWhatsAppHistory
    ? await listWhatsAppChatHistory(user.id)
    : [];
  const workspaces = (
    await prisma.workspaceMembership.findMany({
      where: { userId: user.id },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "desc" },
    })
  ).map((membership) => ({
    id: membership.workspace.id,
    name: membership.workspace.name,
  }));

  const now = new Date();
  const mcpOAuthConnections = (
    await prisma.oAuthToken.findMany({
      where: { userId: user.id, expiresAt: { gt: now } },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    })
  ).map((token) => ({
    clientName: token.client.name,
    scope: token.scope,
    workspaceId: token.workspaceId,
  }));

  return {
    user: {
      username: user.username,
      email: user.email,
      phone: user.phone,
      mcpScope: user.mcpScope,
      mcpWorkspaceId: user.mcpWorkspaceId,
      mcpToken: user.mcpToken,
    },
    whatsAppBotNumber,
    whatsAppBotDisplay: whatsAppBotNumber
      ? formatWhatsAppBotNumber(whatsAppBotNumber)
      : null,
    whatsAppDeepLink: whatsAppBotNumber
      ? whatsAppBotDeepLink(whatsAppBotNumber)
      : null,
    showWhatsAppHistory,
    whatsAppHistory,
    mcpConnectorUrl,
    mcpOAuthConnections,
    workspaces,
    deleteConfirmLabel: user.email ?? "DELETE",
  };
}
