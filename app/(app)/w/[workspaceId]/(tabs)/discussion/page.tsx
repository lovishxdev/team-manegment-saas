import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError, getActorMembership } from "@/lib/services/project";
import { WorkspaceDiscussionLoader } from "@/components/workspace/workspace-discussion-loader";
import { DiscussionContentSkeleton } from "@/components/ui/tab-content-skeleton";
import { ui } from "@/components/ui/ui";

async function DiscussionData({ workspaceId }: { workspaceId: string }) {
  const user = await requireUser();

  try {
    const membership = await getActorMembership(user.id, workspaceId);
    if (!membership) notFound();
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  return (
    <>
      <header className="mb-6">
        <h2 className={ui.settingsSectionTitle}>Discussion</h2>
        <p className={`${ui.fieldHint} mt-1 max-w-2xl`}>
          Team-wide conversation for updates, questions, and context that
          don&apos;t belong on a specific task.
        </p>
      </header>

      <WorkspaceDiscussionLoader
        workspaceId={workspaceId}
        currentUserId={user.id}
      />
    </>
  );
}

export default async function DiscussionPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <Suspense fallback={<DiscussionContentSkeleton />}>
      <DiscussionData workspaceId={workspaceId} />
    </Suspense>
  );
}
