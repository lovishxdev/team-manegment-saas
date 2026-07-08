import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasInitiatedWhatsAppChat } from "@/lib/services/conversation";
import { staticAccountSettingsFields } from "@/lib/settings/account-settings-static";

export type McpOAuthConnection = {
  /** OAuthClient id — the revocation handle (never the token itself). */
  clientId: string;
  clientName: string;
  scope: string;
  workspaceId: string | null;
  /** ISO date of the most recent token for this client. */
  connectedAt: string;
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
  mcpConnectorUrl: string;
  mcpOAuthConnections: McpOAuthConnection[];
  workspaces: { id: string; name: string }[];
  deleteConfirmLabel: string;
};

/** User-specific settings — no WhatsApp chat history (loaded per section). */
export async function loadAccountSettingsData(): Promise<AccountSettingsData> {
  const user = await requireUser();
  const staticFields = staticAccountSettingsFields();
  const showWhatsAppHistory =
    Boolean(user.phone) || (await userHasInitiatedWhatsAppChat(user.id));

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
  const activeTokens = await prisma.oAuthToken.findMany({
    where: { userId: user.id, expiresAt: { gt: now } },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const byClient = new Map<string, McpOAuthConnection>();
  for (const token of activeTokens) {
    if (byClient.has(token.clientId)) continue;
    byClient.set(token.clientId, {
      clientId: token.clientId,
      clientName: token.client.name,
      scope: token.scope,
      workspaceId: token.workspaceId,
      connectedAt: token.createdAt.toISOString(),
    });
  }

  return {
    user: {
      username: user.username,
      email: user.email,
      phone: user.phone,
      mcpScope: user.mcpScope,
      mcpWorkspaceId: user.mcpWorkspaceId,
      mcpToken: user.mcpToken,
    },
    ...staticFields,
    showWhatsAppHistory,
    mcpOAuthConnections: [...byClient.values()],
    workspaces,
    deleteConfirmLabel: user.email ?? "DELETE",
  };
}
