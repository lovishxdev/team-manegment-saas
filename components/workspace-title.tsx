import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getWorkspaceChrome } from "@/lib/services/workspace-chrome";

export async function WorkspaceTitle({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const user = await requireUser();

  try {
    const { workspace } = await getWorkspaceChrome(workspaceId, user.id);
    return (
      <h1 className="mt-5 text-[3rem] font-semibold leading-tight tracking-tight text-ink sm:text-[3.375rem]">
        {workspace.name}
      </h1>
    );
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }
}
