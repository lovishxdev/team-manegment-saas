"use client";

import { useEffect, useState } from "react";
import { fetchWorkspaceMemberLabelsAction } from "@/lib/actions/workspace";
import type { MentionMember } from "@/lib/mentions";
import { WorkspaceDiscussionSection } from "@/components/workspace/workspace-discussion-section";

export function WorkspaceDiscussionLoader({
  workspaceId,
  currentUserId,
}: {
  workspaceId: string;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<MentionMember[]>([]);

  useEffect(() => {
    fetchWorkspaceMemberLabelsAction(workspaceId).then((loaded) => {
      setMembers(loaded);
    });
  }, [workspaceId]);

  return (
    <WorkspaceDiscussionSection
      workspaceId={workspaceId}
      currentUserId={currentUserId}
      members={members}
    />
  );
}
