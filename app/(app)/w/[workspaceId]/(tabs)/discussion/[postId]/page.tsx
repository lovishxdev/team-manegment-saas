import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError, getActorMembership } from "@/lib/services/project";
import { DiscussionThread } from "@/components/discussion/discussion-thread";
import { DiscussionContentSkeleton } from "@/components/ui/tab-content-skeleton";

async function DiscussionThreadData({
  workspaceId,
  postId,
}: {
  workspaceId: string;
  postId: string;
}) {
  const user = await requireUser();

  try {
    const membership = await getActorMembership(user.id, workspaceId);
    if (!membership) notFound();
    const canManageDiscussions =
      membership.role === "LEADER" || membership.role === "SUB_LEADER";

    return (
      <DiscussionThread
        workspaceId={workspaceId}
        postId={postId}
        currentUserId={user.id}
        canManageDiscussions={canManageDiscussions}
      />
    );
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }
}

export default async function DiscussionThreadPage({
  params,
}: {
  params: Promise<{ workspaceId: string; postId: string }>;
}) {
  const { workspaceId, postId } = await params;

  return (
    <Suspense fallback={<DiscussionContentSkeleton />}>
      <DiscussionThreadData workspaceId={workspaceId} postId={postId} />
    </Suspense>
  );
}
