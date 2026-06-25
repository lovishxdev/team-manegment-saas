import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { displayUser } from "@/lib/username";

/**
 * Persistent shell for the workspace tabs (board / assets / settings).
 * Because the sidebar + chrome live here instead of inside each page, the
 * App Router keeps them mounted when switching tabs — only the inner page
 * re-fetches, so navigation no longer re-queries the whole sidebar.
 *
 * The whiteboard route is intentionally a sibling of this group (not a child),
 * so it keeps its full-screen canvas without the shell.
 */
export default async function WorkspaceTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell userId={user.id} userLabel={displayUser(user)}>
      {children}
    </AppShell>
  );
}
