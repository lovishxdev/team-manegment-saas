import { requireUserLite } from "@/lib/auth";
import { displayUser } from "@/lib/username";
import { AppShellSidebar } from "@/components/layout/app-shell-sidebar";

/** Streams sidebar nav after the static shell frame paints. */
export async function AppShellSidebarLoader() {
  const user = await requireUserLite();

  return (
    <AppShellSidebar userId={user.id} userLabel={displayUser(user)} />
  );
}
