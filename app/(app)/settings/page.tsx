import { requireUser } from "@/lib/auth";
import { getMcpConnectorUrl } from "@/lib/app-origin";
import { ui } from "@/components/ui/ui";
import { CopyField } from "@/components/ui/copy-field";
import { DeleteAccount } from "@/components/settings/delete-account";
import { PhoneForm } from "@/components/settings/phone-form";
import { UsernameForm } from "@/components/settings/username-form";
import { McpScopeForm } from "@/components/settings/mcp-scope-form";
import { McpWorkspaceForm } from "@/components/settings/mcp-workspace-form";
import { AddToCursor } from "@/components/settings/add-to-cursor";
import { prisma } from "@/lib/prisma";
import { WhatsAppBotNumber } from "@/components/whatsapp/whatsapp-bot-number";
import { WhatsAppChatHistory } from "@/components/whatsapp/whatsapp-chat-history";
import {
  listWhatsAppChatHistory,
  userHasInitiatedWhatsAppChat,
} from "@/lib/services/conversation";
import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
  whatsAppBotDeepLink,
} from "@/lib/whatsapp-bot";

export default async function SettingsPage() {
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
  ).map((m) => ({ id: m.workspace.id, name: m.workspace.name }));

  return (
      <main className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <h1 className={ui.pageTitle}>Settings</h1>
          <p className={ui.pageSubtitle}>
            Profile, integrations, and account preferences.
          </p>
        </header>

        <section className={`${ui.contentPanel} mb-5`}>
          <h2 className={ui.sectionTitle}>Profile</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Signed in as{" "}
            <span className="font-mono text-xs text-ink">@{user.username}</span>
            {user.email ? (
              <>
                {" "}
                (<span className="font-mono text-xs text-ink-faint">
                  {user.email}
                </span>
                )
              </>
            ) : null}
            . Your username is shown to teammates on boards and member lists.
          </p>
          <UsernameForm currentUsername={user.username} />
        </section>

        <section className={`${ui.contentPanel} mb-5`}>
          <h2 className={ui.sectionTitle}>WhatsApp</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Link your number below, then send{" "}
            <span className="font-medium text-ink">hi</span> on WhatsApp to start
            the bot. Optional. Skip if you only use the web dashboard.
          </p>

          {whatsAppBotNumber ? (
            <div className="mb-6">
              <WhatsAppBotNumber
                e164={whatsAppBotNumber}
                display={formatWhatsAppBotNumber(whatsAppBotNumber)}
                deepLink={whatsAppBotDeepLink(whatsAppBotNumber)}
              />
              <p className="mt-3 text-xs text-ink-faint">
                During Meta&apos;s test mode, only numbers added as recipients
                in your WhatsApp app dashboard can message this bot.
              </p>
            </div>
          ) : (
            <p className="mb-6 rounded-lg border border-dashed border-line-strong bg-paper-deep/40 px-4 py-3 text-sm text-ink-soft">
              The WhatsApp bot number is not configured yet. Set{" "}
              <code className="rounded bg-paper px-1 py-0.5 font-mono text-xs">
                NEXT_PUBLIC_WHATSAPP_BOT_NUMBER
              </code>{" "}
              in your environment (E.164 digits, no + or spaces).
            </p>
          )}

          <h3 className="text-sm font-semibold text-ink">Your phone</h3>
          <p className="mb-3 mt-1 text-sm text-ink-soft">
            Country code + number, no + or spaces. Must match the WhatsApp
            account you message from. Leave empty if you don&apos;t use WhatsApp.
          </p>
          <PhoneForm currentPhone={user.phone} />

          {showWhatsAppHistory ? (
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm font-semibold text-ink">Recent chat</h3>
              <p className="mb-3 mt-1 text-xs text-ink-faint">
                Last messages with the Euclis bot (synced from WhatsApp).
              </p>
              <WhatsAppChatHistory messages={whatsAppHistory} />
            </div>
          ) : null}
        </section>

        <section className={`${ui.contentPanel} mb-5`}>
          <h2 className={ui.sectionTitle}>
            AI agent connectors
          </h2>
          <p className="mb-5 mt-1 text-sm text-ink-soft">
            Connect Claude, Cursor, or any MCP client to your Euclis account.
            Both sign you in with your Euclis login — no tokens to copy. When
            you approve a connection you choose what it can reach: one
            workspace (for coding agents) or all workspaces (for chat).
          </p>

          <h3 className="text-sm font-semibold text-ink">Cursor</h3>
          <p className="mb-3 mt-1 text-sm text-ink-soft">
            One click adds Euclis to Cursor so coding agents can pull project
            context (decisions, blockers) and post updates while they work.
          </p>
          <AddToCursor mcpUrl={mcpConnectorUrl} />

          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">Claude App</h3>
            <p className="mb-3 mt-1 text-sm text-ink-soft">
              In Claude, open <span className="text-ink">Settings → Connectors</span>
              , choose <span className="text-ink">Add custom connector</span>, and
              paste the URL below.
            </p>
            <CopyField value={mcpConnectorUrl} secret={false} />
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">
              Personal token (manual setup)
            </h3>
            <p className="mb-3 mt-1 text-sm text-ink-soft">
              If you connect with the bearer token instead of signing in, these
              settings define what that connection can do. Enforced server-side
              on every tool call.
            </p>
            <McpWorkspaceForm
              workspaces={workspaces}
              currentWorkspaceId={user.mcpWorkspaceId}
            />
            <div className="mt-4">
              <McpScopeForm currentScope={user.mcpScope} />
            </div>
          </div>
        </section>

        <DeleteAccount confirmLabel={user.email ?? "DELETE"} />
      </main>
  );
}
