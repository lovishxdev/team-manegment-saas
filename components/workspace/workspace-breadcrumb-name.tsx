import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getWorkspaceChrome } from "@/lib/services/workspace-chrome";

export async function WorkspaceBreadcrumbName({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const user = await requireUser();

  try {
    const { workspace } = await getWorkspaceChrome(workspaceId, user.id);
    return workspace.name;
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }
}
