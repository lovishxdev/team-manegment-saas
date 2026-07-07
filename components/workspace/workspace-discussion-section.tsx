"use client";

import { useCallback } from "react";
import {
  addWorkspaceMessageAction,
  deleteWorkspaceMessageAction,
  fetchWorkspaceMessagesAction,
  setWorkspaceMessageSavedAction,
} from "@/lib/actions/workspace";
import type { MentionMember } from "@/lib/mentions";
import { DiscussionSection } from "@/components/discussion/discussion-section";

export function WorkspaceDiscussionSection({
  workspaceId,
  currentUserId,
  members,
}: {
  workspaceId: string;
  currentUserId: string;
  members: MentionMember[];
}) {
  const loadMessages = useCallback(
    () =>
      fetchWorkspaceMessagesAction(workspaceId).then((result) => ({
        messages: result.messages,
        error: result.error,
      })),
    [workspaceId]
  );

  const postMessage = useCallback(
    (body: string) =>
      addWorkspaceMessageAction(workspaceId, body).then((result) => ({
        message: result.message,
        error: result.error,
      })),
    [workspaceId]
  );

  const deleteMessage = useCallback(
    (id: string) =>
      deleteWorkspaceMessageAction(workspaceId, id).then((result) => ({
        error: result.error,
      })),
    [workspaceId]
  );

  const toggleSaved = useCallback(
    (id: string, saved: boolean) =>
      setWorkspaceMessageSavedAction(workspaceId, id, saved).then((result) => ({
        saved: result.saved,
        error: result.error,
      })),
    [workspaceId]
  );

  return (
    <DiscussionSection
      workspaceId={workspaceId}
      currentUserId={currentUserId}
      members={members}
      realtime={{
        channelName: `workspace-discussion-${workspaceId}`,
        table: "WorkspaceMessage",
        filter: `workspaceId=eq.${workspaceId}`,
      }}
      loadMessages={loadMessages}
      postMessage={postMessage}
      deleteMessage={deleteMessage}
      toggleSaved={toggleSaved}
      emptyMessagesHint="Start the team conversation — share updates, questions, or context."
      composePlaceholder="Share updates, questions, or context with the team… (@ to mention)"
    />
  );
}
