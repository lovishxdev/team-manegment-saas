import { requireUserLite } from "@/lib/auth";
import { AppShellIntegrations } from "@/components/layout/app-shell-integrations";

/** Onboarding integrations banner — deferred so it never blocks first paint. */
export async function AppShellIntegrationsLoader() {
  const user = await requireUserLite();

  return (
    <AppShellIntegrations
      userId={user.id}
      userPhone={user.phone}
      whatsappChatCached={Boolean(user.whatsappChatInitiatedAt)}
    />
  );
}
