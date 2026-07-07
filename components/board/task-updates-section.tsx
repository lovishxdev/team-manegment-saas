"use client";

import { useCallback } from "react";
import {
  addTaskUpdateAction,
  deleteTaskUpdateAction,
  fetchTaskUpdatesAction,
  setTaskUpdateSavedAction,
} from "@/lib/actions/workspace";
import type { MentionMember } from "@/lib/mentions";
import { DiscussionSection } from "@/components/discussion/discussion-section";

export function TaskUpdatesSection({
  workspaceId,
  taskId,
  taskShortId,
  currentUserId,
  members,
  onReady,
}: {
  workspaceId: string;
  taskId: string;
  taskShortId: number;
  currentUserId: string;
  members: MentionMember[];
  /** Fires once after the first updates fetch finishes (layout is stable). */
  onReady?: () => void;
}) {
  const loadMessages = useCallback(
    () =>
      fetchTaskUpdatesAction(workspaceId, taskShortId).then((result) => ({
        messages: result.updates,
        error: result.error,
      })),
    [workspaceId, taskShortId]
  );

  const postMessage = useCallback(
    (body: string) =>
      addTaskUpdateAction(workspaceId, taskShortId, body).then((result) => ({
        message: result.update,
        error: result.error,
      })),
    [workspaceId, taskShortId]
  );

  const deleteMessage = useCallback(
    (id: string) =>
      deleteTaskUpdateAction(workspaceId, id).then((result) => ({
        error: result.error,
      })),
    [workspaceId]
  );

  const toggleSaved = useCallback(
    (id: string, saved: boolean) =>
      setTaskUpdateSavedAction(workspaceId, id, saved).then((result) => ({
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
        channelName: `task-updates-${taskId}`,
        table: "TaskUpdate",
        filter: `taskId=eq.${taskId}`,
      }}
      loadMessages={loadMessages}
      postMessage={postMessage}
      deleteMessage={deleteMessage}
      toggleSaved={toggleSaved}
      emptyMessagesHint="Share progress, blockers, and context with your team."
      emptySavedHint="Save updates from the menu on any message to find them here."
      composePlaceholder="Share progress, blockers, or context… (@ to mention)"
      deleteConfirm="Delete this update? This cannot be undone."
      onReady={onReady}
    />
  );
}
