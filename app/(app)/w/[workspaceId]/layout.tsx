import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getWorkspaceChrome } from "@/lib/services/workspace-chrome";

/**
 * Guard every /w/{workspaceId}/… route (tabs + tasks). Invalid or
 * inaccessible workspaces hit the segment not-found before tab chrome streams.
 */
export default async function WorkspaceIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  try {
    await getWorkspaceChrome(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  return children;
}
