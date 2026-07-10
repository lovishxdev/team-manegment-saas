import { cookies } from "next/headers";
import { getSessionClaims } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar-context";
import { PostHogIdentify } from "@/components/analytics/posthog-identify";
import { isAnalyticsOptOut } from "@/lib/analytics/opt-out";

/**
 * Persistent shell for all authenticated app routes (dashboard, settings,
 * workspace tabs). The sidebar and chrome stay mounted across navigation so
 * tab switches only re-fetch the inner page — not the whole sidebar.
 */
export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const [cookieStore, claims] = await Promise.all([
    cookies(),
    getSessionClaims(),
  ]);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell sidebarCollapsed={sidebarCollapsed} modal={modal}>
      <PostHogIdentify
        distinctId={claims.sub}
        email={claims.email}
        optOut={isAnalyticsOptOut(claims.sub, claims.email)}
      />
      {children}
    </AppShell>
  );
}
