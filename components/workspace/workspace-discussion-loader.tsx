"use client";

import { useEffect, useState } from "react";
import { DiscussionFeed } from "@/components/discussion/discussion-feed";

export function WorkspaceDiscussionLoader({
  workspaceId,
  currentUserId,
  canManageDiscussions = false,
}: {
  workspaceId: string;
  currentUserId: string;
  canManageDiscussions?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <DiscussionFeed
      workspaceId={workspaceId}
      currentUserId={currentUserId}
      canManageDiscussions={canManageDiscussions}
    />
  );
}
