import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
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
  const user = await requireUser();

  return (
    <AppShell userId={user.id} userLabel={displayUser(user)}>
      {children}
    </AppShell>
  );
}
