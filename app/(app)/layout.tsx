import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar-context";
import { displayUser } from "@/lib/username";

/**
 * Persistent shell for all authenticated app routes (dashboard, settings,
 * workspace tabs). The sidebar and chrome stay mounted across navigation so
 * tab switches only re-fetch the inner page — not the whole sidebar.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell
      userId={user.id}
      userLabel={displayUser(user)}
      userPhone={user.phone}
      whatsappChatCached={Boolean(user.whatsappChatInitiatedAt)}
      sidebarCollapsed={sidebarCollapsed}
    >
      {children}
    </AppShell>
  );
}
