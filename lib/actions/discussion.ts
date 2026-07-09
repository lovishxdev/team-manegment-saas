"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { PostKind, PostStatus } from "@/lib/generated/prisma/client";
import type { ChatMessageView } from "@/lib/chat-message";
import { parsePostKind } from "@/lib/post-kind";
import {
  createWorkspaceDiscussionTag,
  listWorkspaceDiscussionTags,
  type WorkspaceDiscussionTagRow,
} from "@/lib/services/discussion-tags";
import {
  createPost,
  createPostReply,
  deletePost,
  deletePostMessage,
  getPostThread,
  listPosts,
  listPostsForTask,
  listSavedPostMessages,
  setPostMessageSaved,
  setPostPinned,
  setPostStatus,
  setPostTaskLink,
  type PostFeedRow,
  type PostMessageRow,
  type PostTaskLinkRow,
  type SavedPostMessageRow,
} from "@/lib/services/post";
import { ServiceError } from "@/lib/services/project";
import { displayUser } from "@/lib/username";

type ActionState = { error?: string };

function errorMessage(err: unknown): string {
  if (err instanceof ServiceError) return err.message;
  if (process.env.NODE_ENV !== "production") {
    console.error("[discussion action]", err);
  }
  return "Something went wrong. Please try again.";
}

function discussionPaths(workspaceId: string, postId?: string) {
  const base = `/w/${workspaceId}/discussion`;
  return postId ? [base, `${base}/${postId}`] : [base];
}

function revalidateDiscussion(workspaceId: string, postId?: string) {
  for (const path of discussionPaths(workspaceId, postId)) {
    revalidatePath(path);
  }
}

export type SavedDiscussionMessageView = ChatMessageView & {
  postId: string;
  postTitle: string;
};

function toChatMessageView(message: PostMessageRow): ChatMessageView {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    authorId: message.author.id,
    authorLabel: displayUser(message.author),
    mentionedLabels: message.mentionedLabels,
    saved: message.saved,
    parentMessageId: message.parentMessageId,
    isAgentGenerated: message.isAgentGenerated,
    isAgentPrivate: message.isAgentPrivate,
    agentTriggeredByLabel: message.agentTriggeredByLabel,
  };
}

function toSavedMessageView(message: SavedPostMessageRow): SavedDiscussionMessageView {
  return {
    ...toChatMessageView(message),
    postId: message.postId,
    postTitle: message.postTitle,
  };
}

export type PostFeedView = {
  id: string;
  title: string;
  preview: string;
  kind: PostKind;
  status: PostStatus;
  pinned: boolean;
  authorId: string;
  authorLabel: string;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  taskId: string | null;
  taskShortId: number | null;
  taskTitle: string | null;
  tags: string[];
};

export type PostTaskLinkView = {
  id: string;
  title: string;
  kind: PostKind;
  replyCount: number;
  lastActivityAt: string;
  authorLabel: string;
};

function toPostFeedView(post: PostFeedRow): PostFeedView {
  return {
    id: post.id,
    title: post.title,
    preview: post.preview,
    kind: post.kind,
    status: post.status,
    pinned: post.pinned,
    authorId: post.authorId,
    authorLabel: post.authorLabel,
    replyCount: post.replyCount,
    lastActivityAt: post.lastActivityAt.toISOString(),
    createdAt: post.createdAt.toISOString(),
    taskId: post.taskId,
    taskShortId: post.taskShortId,
    taskTitle: post.taskTitle,
    tags: post.tags,
  };
}

function toPostTaskLinkView(post: PostTaskLinkRow): PostTaskLinkView {
  return {
    id: post.id,
    title: post.title,
    kind: post.kind,
    replyCount: post.replyCount,
    lastActivityAt: post.lastActivityAt.toISOString(),
    authorLabel: post.authorLabel,
  };
}

export async function fetchDiscussionPostsAction(
  workspaceId: string,
  options?: { kind?: string; tag?: string }
): Promise<{ posts: PostFeedView[]; error?: string }> {
  const user = await requireUser();
  try {
    const posts = await listPosts(workspaceId, user.id, {
      kind: parsePostKind(options?.kind),
      tag: options?.tag?.trim() || undefined,
    });
    return { posts: posts.map(toPostFeedView) };
  } catch (err) {
    return { posts: [], error: errorMessage(err) };
  }
}

export async function fetchDiscussionThreadAction(
  workspaceId: string,
  postId: string
): Promise<{
  post?: {
    id: string;
    title: string;
    kind: PostKind;
    status: PostStatus;
    pinned: boolean;
    replyCount: number;
    lastActivityAt: string;
    createdAt: string;
    authorId: string;
    taskId: string | null;
    taskShortId: number | null;
    taskTitle: string | null;
  };
  messages?: ChatMessageView[];
  error?: string;
}> {
  const user = await requireUser();
  try {
    const thread = await getPostThread(workspaceId, user.id, postId);
    return {
      post: {
        id: thread.post.id,
        title: thread.post.title,
        kind: thread.post.kind,
        status: thread.post.status,
        pinned: thread.post.pinned,
        replyCount: thread.post.replyCount,
        lastActivityAt: thread.post.lastActivityAt.toISOString(),
        createdAt: thread.post.createdAt.toISOString(),
        authorId: thread.post.authorId,
        taskId: thread.post.taskId,
        taskShortId: thread.post.taskShortId,
        taskTitle: thread.post.taskTitle,
      },
      messages: thread.messages.map(toChatMessageView),
    };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function createDiscussionPostAction(
  workspaceId: string,
  body: string,
  options?: {
    title?: string;
    kind?: string;
    taskId?: string;
    taskShortId?: number;
    tags?: string[];
  }
): Promise<ActionState & { postId?: string; message?: ChatMessageView }> {
  const user = await requireUser();
  try {
    const created = await createPost({
      workspaceId,
      userId: user.id,
      body,
      title: options?.title,
      kind: parsePostKind(options?.kind),
      taskId: options?.taskId,
      taskShortId: options?.taskShortId,
      tags: options?.tags,
    });
    revalidateDiscussion(workspaceId);
    if (options?.taskId) {
      revalidatePath(`/w/${workspaceId}/tasks/${options.taskId}`);
    }
    return {
      postId: created.postId,
      message: toChatMessageView(created.message),
    };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function createDiscussionReplyAction(
  workspaceId: string,
  postId: string,
  body: string,
  parentMessageId: string
): Promise<ActionState & { message?: ChatMessageView }> {
  const user = await requireUser();
  try {
    const message = await createPostReply({
      workspaceId,
      userId: user.id,
      postId,
      body,
      parentMessageId,
    });
    revalidateDiscussion(workspaceId, postId);
    return { message: toChatMessageView(message) };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteDiscussionMessageAction(
  workspaceId: string,
  postId: string,
  messageId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await deletePostMessage({
      workspaceId,
      userId: user.id,
      messageId,
    });
    revalidateDiscussion(workspaceId, postId);
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteDiscussionAction(
  workspaceId: string,
  postId: string
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await deletePost({
      workspaceId,
      userId: user.id,
      postId,
    });
    revalidateDiscussion(workspaceId);
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function setDiscussionMessageSavedAction(
  workspaceId: string,
  postId: string,
  messageId: string,
  saved: boolean
): Promise<ActionState & { saved?: boolean }> {
  const user = await requireUser();
  try {
    const nextSaved = await setPostMessageSaved({
      workspaceId,
      userId: user.id,
      messageId,
      saved,
    });
    revalidateDiscussion(workspaceId, postId);
    return { saved: nextSaved };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function setDiscussionPinnedAction(
  workspaceId: string,
  postId: string,
  pinned: boolean
): Promise<ActionState & { pinned?: boolean }> {
  const user = await requireUser();
  try {
    const nextPinned = await setPostPinned({
      workspaceId,
      userId: user.id,
      postId,
      pinned,
    });
    revalidateDiscussion(workspaceId, postId);
    return { pinned: nextPinned };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function setDiscussionStatusAction(
  workspaceId: string,
  postId: string,
  status: PostStatus
): Promise<ActionState & { status?: PostStatus }> {
  const user = await requireUser();
  try {
    const nextStatus = await setPostStatus({
      workspaceId,
      userId: user.id,
      postId,
      status,
    });
    revalidateDiscussion(workspaceId, postId);
    return { status: nextStatus };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function setDiscussionTaskLinkAction(
  workspaceId: string,
  postId: string,
  taskShortId: number | null
): Promise<
  ActionState & {
    taskId?: string | null;
    taskShortId?: number | null;
    taskTitle?: string | null;
  }
> {
  const user = await requireUser();
  try {
    const linked = await setPostTaskLink({
      workspaceId,
      userId: user.id,
      postId,
      taskId: null,
      ...(taskShortId === null ? {} : { taskShortId }),
    });
    revalidateDiscussion(workspaceId, postId);
    return linked;
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function fetchTaskLinkedDiscussionsAction(
  workspaceId: string,
  taskId: string
): Promise<{ posts: PostTaskLinkView[]; error?: string }> {
  const user = await requireUser();
  try {
    const posts = await listPostsForTask(workspaceId, user.id, taskId);
    return { posts: posts.map(toPostTaskLinkView) };
  } catch (err) {
    return { posts: [], error: errorMessage(err) };
  }
}

export async function fetchSavedDiscussionMessagesAction(
  workspaceId: string
): Promise<{ messages: SavedDiscussionMessageView[]; error?: string }> {
  const user = await requireUser();
  try {
    const messages = await listSavedPostMessages(workspaceId, user.id);
    return { messages: messages.map(toSavedMessageView) };
  } catch (err) {
    return { messages: [], error: errorMessage(err) };
  }
}

export type DiscussionTagView = {
  id: string;
  name: string;
  slug: string;
};

function toDiscussionTagView(tag: WorkspaceDiscussionTagRow): DiscussionTagView {
  return { id: tag.id, name: tag.name, slug: tag.slug };
}

export async function fetchDiscussionTagsAction(
  workspaceId: string
): Promise<{ tags: DiscussionTagView[]; error?: string }> {
  const user = await requireUser();
  try {
    const tags = await listWorkspaceDiscussionTags(workspaceId, user.id);
    return { tags: tags.map(toDiscussionTagView) };
  } catch (err) {
    return { tags: [], error: errorMessage(err) };
  }
}

export async function createDiscussionTagAction(
  workspaceId: string,
  name: string
): Promise<ActionState & { tag?: DiscussionTagView }> {
  const user = await requireUser();
  try {
    const tag = await createWorkspaceDiscussionTag(workspaceId, user.id, name);
    revalidateDiscussion(workspaceId);
    return { tag: toDiscussionTagView(tag) };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
