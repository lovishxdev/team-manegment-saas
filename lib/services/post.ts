import { prisma } from "@/lib/prisma";
import type { PostKind, PostStatus } from "@/lib/generated/prisma/client";
import { schedulePostClosedMemoryCapture, schedulePostMessageMemoryCapture } from "@/lib/memory/capture";
import {
  resolvePostTagsForWorkspace,
} from "@/lib/services/discussion-tags";
import { getActorMembership, ServiceError } from "@/lib/services/project";
import { assertCanCreateDiscussion } from "@/lib/billing/entitlements";
import { resolveDiscussionMentionUserIds, mentionLabelsForUsers, bodyMentionsAgent } from "@/lib/mentions";
import {
  postBodyPreview,
  postFeedTitle,
  postThreadTitle,
  PRIVATE_AGENT_DISCUSSION_TITLE,
} from "@/lib/post-title";
import { displayUser } from "@/lib/username";

export const MAX_POST_BODY = 8000;
export const DEFAULT_POSTS_LIMIT = 50;
export const MAX_POSTS_LIMIT = 100;

const authorSelect = {
  id: true,
  email: true,
  username: true,
} as const;

const messageSelect = {
  id: true,
  postId: true,
  body: true,
  parentMessageId: true,
  isAgentGenerated: true,
  isAgentPrivate: true,
  agentTriggeredByUserId: true,
  createdAt: true,
  author: { select: authorSelect },
  agentTriggeredBy: { select: authorSelect },
  mentions: {
    select: {
      user: { select: authorSelect },
    },
  },
} as const;

export type PostFeedRow = {
  id: string;
  title: string;
  preview: string;
  kind: PostKind;
  status: PostStatus;
  pinned: boolean;
  authorId: string;
  authorLabel: string;
  replyCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  taskId: string | null;
  taskShortId: number | null;
  taskTitle: string | null;
  tags: string[];
};

export type PostTaskLinkRow = {
  id: string;
  title: string;
  kind: PostKind;
  replyCount: number;
  lastActivityAt: Date;
  authorLabel: string;
};

export type PostMessageRow = {
  id: string;
  postId: string;
  body: string;
  parentMessageId: string | null;
  isAgentGenerated: boolean;
  isAgentPrivate: boolean;
  agentTriggeredByUserId: string | null;
  agentTriggeredByLabel: string | null;
  createdAt: Date;
  author: { id: string; email: string | null; username: string };
  mentionedLabels: string[];
  saved: boolean;
};

export type SavedPostMessageRow = PostMessageRow & {
  postTitle: string;
};

export type PostThread = {
  post: {
    id: string;
    title: string;
    kind: PostKind;
    status: PostStatus;
    pinned: boolean;
    workspaceId: string;
    authorId: string;
    replyCount: number;
    createdAt: Date;
    lastActivityAt: Date;
    taskId: string | null;
    taskShortId: number | null;
    taskTitle: string | null;
    tags: string[];
  };
  messages: PostMessageRow[];
};

function mapPostMessageRow(
  message: {
    id: string;
    postId: string;
    body: string;
    parentMessageId: string | null;
    isAgentGenerated: boolean;
    isAgentPrivate: boolean;
    agentTriggeredByUserId: string | null;
    createdAt: Date;
    author: { id: string; email: string | null; username: string };
    agentTriggeredBy?: { id: string; email: string | null; username: string } | null;
    mentions: { user: { id: string; email: string | null; username: string } }[];
  },
  savedIds: Set<string>
): PostMessageRow {
  return {
    id: message.id,
    postId: message.postId,
    body: message.body,
    parentMessageId: message.parentMessageId,
    isAgentGenerated: message.isAgentGenerated,
    isAgentPrivate: message.isAgentPrivate,
    agentTriggeredByUserId: message.agentTriggeredByUserId,
    agentTriggeredByLabel: message.agentTriggeredBy
      ? displayUser(message.agentTriggeredBy)
      : null,
    createdAt: message.createdAt,
    author: message.author,
    mentionedLabels: message.mentions.map((m) => displayUser(m.user)),
    saved: savedIds.has(message.id),
  };
}

function canViewPostMessageForUser(
  message: {
    isAgentGenerated: boolean;
    agentTriggeredByUserId: string | null;
    isAgentPrivate: boolean;
    authorId: string;
  },
  userId: string
): boolean {
  if (message.isAgentGenerated) {
    return message.agentTriggeredByUserId === userId;
  }
  if (message.isAgentPrivate) {
    return message.authorId === userId;
  }
  return true;
}

async function savedMessageIdsForPost(
  userId: string,
  postId: string
): Promise<Set<string>> {
  const rows = await prisma.postMessageSave.findMany({
    where: { userId, message: { postId } },
    select: { messageId: true },
  });
  return new Set(rows.map((row) => row.messageId));
}

async function savedMessageIdsForWorkspace(
  userId: string,
  workspaceId: string
): Promise<Set<string>> {
  const rows = await prisma.postMessageSave.findMany({
    where: { userId, message: { post: { workspaceId } } },
    select: { messageId: true },
  });
  return new Set(rows.map((row) => row.messageId));
}

async function requireWorkspaceMember(userId: string, workspaceId: string) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }
  return membership;
}

/** Member who may write — blocks read-only guests. Use in discussion mutations. */
async function requireWriteMember(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceMember(userId, workspaceId);
  if (membership.role === "GUEST") {
    throw new ServiceError(
      "Guests have read-only access to this workspace.",
      "FORBIDDEN"
    );
  }
  return membership;
}

function isLeadership(role: string): boolean {
  return role === "LEADER" || role === "SUB_LEADER";
}

const postTaskSelect = {
  id: true,
  shortId: true,
  title: true,
} as const;

const postFeedSelect = {
  id: true,
  title: true,
  kind: true,
  status: true,
  pinned: true,
  authorId: true,
  taskId: true,
  tags: true,
  replyCount: true,
  lastActivityAt: true,
  createdAt: true,
  author: { select: authorSelect },
  task: { select: postTaskSelect },
  messages: {
    where: { parentMessageId: null },
    take: 1,
    select: { body: true, isAgentPrivate: true, authorId: true },
  },
} as const;

function postVisibleInFeed(
  post: {
    authorId: string;
    messages: { isAgentPrivate: boolean; authorId: string }[];
  },
  userId: string
): boolean {
  const opener = post.messages[0];
  if (!opener?.isAgentPrivate) return true;
  return opener.authorId === userId;
}

function mapPostFeedRow(post: {
  id: string;
  title: string | null;
  kind: PostKind;
  status: PostStatus;
  pinned: boolean;
  authorId: string;
  taskId: string | null;
  replyCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  tags: string[];
  author: { id: string; email: string | null; username: string };
  task: { id: string; shortId: number; title: string } | null;
  messages: { body: string; isAgentPrivate?: boolean }[];
}): PostFeedRow {
  const opener = post.messages[0];
  const openerBody = opener?.body ?? "";
  const title = opener?.isAgentPrivate
    ? PRIVATE_AGENT_DISCUSSION_TITLE
    : postFeedTitle(post.title, openerBody);
  return {
    id: post.id,
    title,
    preview: postBodyPreview(openerBody),
    kind: post.kind,
    status: post.status,
    pinned: post.pinned,
    authorId: post.authorId,
    authorLabel: displayUser(post.author),
    replyCount: post.replyCount,
    lastActivityAt: post.lastActivityAt,
    createdAt: post.createdAt,
    taskId: post.taskId,
    taskShortId: post.task?.shortId ?? null,
    taskTitle: post.task?.title ?? null,
    tags: post.tags,
  };
}

export async function listPosts(
  workspaceId: string,
  userId: string,
  options?: { limit?: number; before?: Date; kind?: PostKind; tag?: string }
): Promise<PostFeedRow[]> {
  await requireWorkspaceMember(userId, workspaceId);
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_POSTS_LIMIT),
    MAX_POSTS_LIMIT
  );

  const posts = await prisma.post.findMany({
    where: {
      workspaceId,
      ...(options?.kind ? { kind: options.kind } : {}),
      ...(options?.tag ? { tags: { has: options.tag } } : {}),
      ...(options?.before ? { lastActivityAt: { lt: options.before } } : {}),
    },
    orderBy: [{ pinned: "desc" }, { lastActivityAt: "desc" }],
    take: limit,
    select: postFeedSelect,
  });

  return posts.filter((post) => postVisibleInFeed(post, userId)).map(mapPostFeedRow);
}

export async function listPostsForTask(
  workspaceId: string,
  userId: string,
  taskId: string
): Promise<PostTaskLinkRow[]> {
  await requireWorkspaceMember(userId, workspaceId);

  const posts = await prisma.post.findMany({
    where: { workspaceId, taskId },
    orderBy: [{ pinned: "desc" }, { lastActivityAt: "desc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      authorId: true,
      replyCount: true,
      lastActivityAt: true,
      author: { select: authorSelect },
      messages: {
        where: { parentMessageId: null },
        take: 1,
        select: { body: true, isAgentPrivate: true, authorId: true },
      },
    },
  });

  return posts
    .filter((post) => postVisibleInFeed(post, userId))
    .map((post) => {
    const opener = post.messages[0];
    const openerBody = opener?.body ?? "";
    const title = opener?.isAgentPrivate
      ? PRIVATE_AGENT_DISCUSSION_TITLE
      : postFeedTitle(post.title, openerBody);
    return {
      id: post.id,
      title,
      kind: post.kind,
      replyCount: post.replyCount,
      lastActivityAt: post.lastActivityAt,
      authorLabel: displayUser(post.author),
    };
  });
}

export async function getPostThread(
  workspaceId: string,
  userId: string,
  postId: string
): Promise<PostThread> {
  await requireWorkspaceMember(userId, workspaceId);

  const post = await prisma.post.findFirst({
    where: { id: postId, workspaceId },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      pinned: true,
      workspaceId: true,
      authorId: true,
      taskId: true,
      tags: true,
      replyCount: true,
      createdAt: true,
      lastActivityAt: true,
      task: { select: postTaskSelect },
      messages: {
        orderBy: { createdAt: "asc" },
        select: messageSelect,
      },
    },
  });
  if (!post) {
    throw new ServiceError("Discussion not found", "NOT_FOUND");
  }

  const opener = post.messages.find((m) => m.parentMessageId === null);
  const savedIds = await savedMessageIdsForPost(userId, postId);

  const visibleMessages = post.messages.filter((message) =>
    canViewPostMessageForUser(
      {
        isAgentGenerated: message.isAgentGenerated,
        agentTriggeredByUserId: message.agentTriggeredByUserId,
        isAgentPrivate: message.isAgentPrivate,
        authorId: message.author.id,
      },
      userId
    )
  );

  if (visibleMessages.length === 0) {
    throw new ServiceError("Discussion not found", "NOT_FOUND");
  }

  const visibleOpener = visibleMessages.find((m) => m.parentMessageId === null);

  return {
    post: {
      id: post.id,
      title: postThreadTitle(post.title, visibleOpener?.body ?? opener?.body ?? ""),
      kind: post.kind,
      status: post.status,
      pinned: post.pinned,
      workspaceId: post.workspaceId,
      authorId: post.authorId,
      replyCount: post.replyCount,
      createdAt: post.createdAt,
      lastActivityAt: post.lastActivityAt,
      taskId: post.taskId,
      taskShortId: post.task?.shortId ?? null,
      taskTitle: post.task?.title ?? null,
      tags: post.tags,
    },
    messages: visibleMessages.map((message) =>
      mapPostMessageRow(message, savedIds)
    ),
  };
}

async function createPostMessageRecord(input: {
  postId: string;
  workspaceId: string;
  userId: string;
  body: string;
  parentMessageId: string | null;
  mentionRefs?: string[];
  createdAt?: Date;
}): Promise<PostMessageRow> {
  const body = input.body.trim();
  if (!body) {
    throw new ServiceError("Message can't be empty", "INVALID_INPUT");
  }
  if (body.length > MAX_POST_BODY) {
    throw new ServiceError(
      `Message is too long (max ${MAX_POST_BODY} characters)`,
      "INVALID_INPUT"
    );
  }

  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId: input.workspaceId },
    include: { user: { select: authorSelect } },
  });
  const mentionedUserIds = resolveDiscussionMentionUserIds(
    memberships,
    body,
    input.mentionRefs
  ).filter((id) => id !== input.userId);

  if (input.parentMessageId) {
    const post = await prisma.post.findFirst({
      where: { id: input.postId, workspaceId: input.workspaceId },
      select: { status: true },
    });
    if (!post) {
      throw new ServiceError("Discussion not found", "NOT_FOUND");
    }
    if (post.status === "RESOLVED") {
      throw new ServiceError(
        "This discussion is closed — reopen it to reply",
        "INVALID_INPUT"
      );
    }

    const parent = await prisma.postMessage.findFirst({
      where: { id: input.parentMessageId, postId: input.postId },
      select: { id: true },
    });
    if (!parent) {
      throw new ServiceError("Parent message not found", "NOT_FOUND");
    }
  }

  const isAgentPrivate = bodyMentionsAgent(body);

  const message = await prisma.postMessage.create({
    data: {
      postId: input.postId,
      authorId: input.userId,
      body,
      parentMessageId: input.parentMessageId,
      isAgentPrivate,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      ...(mentionedUserIds.length > 0
        ? {
            mentions: {
              create: mentionedUserIds.map((userId) => ({ userId })),
            },
          }
        : {}),
    },
    select: messageSelect,
  });

  const activityAt = input.createdAt ?? new Date();
  if (!isAgentPrivate) {
    await prisma.post.update({
      where: { id: input.postId },
      data: {
        lastActivityAt: activityAt,
        ...(input.parentMessageId ? { replyCount: { increment: 1 } } : {}),
      },
    });
  }

  schedulePostMessageMemoryCapture(message.id);

  return {
    ...mapPostMessageRow(message, new Set()),
    mentionedLabels: mentionLabelsForUsers(memberships, mentionedUserIds),
  };
}

export async function createPost(input: {
  workspaceId: string;
  userId: string;
  body: string;
  title?: string | null;
  kind?: PostKind;
  taskId?: string | null;
  taskShortId?: number;
  tags?: string[];
  mentionRefs?: string[];
}): Promise<{ postId: string; message: PostMessageRow }> {
  const body = input.body.trim();
  if (!body) {
    throw new ServiceError("Message can't be empty", "INVALID_INPUT");
  }

  await requireWriteMember(input.userId, input.workspaceId);

  // Tier cap on open discussions (grandfather existing, block new).
  await assertCanCreateDiscussion(input.workspaceId);

  let taskId = input.taskId ?? null;
  if (input.taskShortId !== undefined) {
    const task = await prisma.task.findFirst({
      where: { workspaceId: input.workspaceId, shortId: input.taskShortId },
      select: { id: true },
    });
    if (!task) {
      throw new ServiceError(
        `Task #${input.taskShortId} not found in this workspace`,
        "NOT_FOUND"
      );
    }
    taskId = task.id;
  } else if (taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId: input.workspaceId },
      select: { id: true },
    });
    if (!task) {
      throw new ServiceError("Linked task not found in this workspace", "NOT_FOUND");
    }
  }

  const kind = input.kind ?? "DISCUSSION";
  const title = input.title?.trim() || null;
  const tags = await resolvePostTagsForWorkspace(
    input.workspaceId,
    input.userId,
    input.tags
  );
  const post = await prisma.post.create({
    data: {
      workspaceId: input.workspaceId,
      authorId: input.userId,
      title,
      kind,
      taskId,
      tags,
    },
    select: { id: true },
  });

  const message = await createPostMessageRecord({
    postId: post.id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    body,
    parentMessageId: null,
    mentionRefs: input.mentionRefs,
  });

  return { postId: post.id, message };
}

export async function createPostReply(input: {
  workspaceId: string;
  userId: string;
  postId: string;
  body: string;
  parentMessageId: string;
  mentionRefs?: string[];
}): Promise<PostMessageRow> {
  await requireWriteMember(input.userId, input.workspaceId);

  const post = await prisma.post.findFirst({
    where: { id: input.postId, workspaceId: input.workspaceId },
    select: { id: true, status: true },
  });
  if (!post) {
    throw new ServiceError("Discussion not found", "NOT_FOUND");
  }
  if (post.status === "RESOLVED") {
    throw new ServiceError(
      "This discussion is closed — reopen it to reply",
      "INVALID_INPUT"
    );
  }

  return createPostMessageRecord({
    postId: input.postId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    body: input.body,
    parentMessageId: input.parentMessageId,
    mentionRefs: input.mentionRefs,
  });
}

export async function createAgentBranchReply(input: {
  workspaceId: string;
  triggeredByUserId: string;
  postId: string;
  parentMessageId: string;
  body: string;
}): Promise<PostMessageRow> {
  await requireWriteMember(input.triggeredByUserId, input.workspaceId);

  const body = input.body.trim();
  if (!body) {
    throw new ServiceError("Agent reply can't be empty", "INVALID_INPUT");
  }
  if (body.length > MAX_POST_BODY) {
    throw new ServiceError(
      `Message is too long (max ${MAX_POST_BODY} characters)`,
      "INVALID_INPUT"
    );
  }

  const post = await prisma.post.findFirst({
    where: { id: input.postId, workspaceId: input.workspaceId },
    select: { id: true, status: true },
  });
  if (!post) {
    throw new ServiceError("Discussion not found", "NOT_FOUND");
  }
  if (post.status === "RESOLVED") {
    throw new ServiceError(
      "This discussion is closed — reopen it to branch an agent",
      "INVALID_INPUT"
    );
  }

  const parent = await prisma.postMessage.findFirst({
    where: { id: input.parentMessageId, postId: input.postId },
    select: { id: true },
  });
  if (!parent) {
    throw new ServiceError("Parent message not found", "NOT_FOUND");
  }

  const message = await prisma.postMessage.create({
    data: {
      postId: input.postId,
      authorId: input.triggeredByUserId,
      body,
      parentMessageId: input.parentMessageId,
      isAgentGenerated: true,
      agentTriggeredByUserId: input.triggeredByUserId,
    },
    select: messageSelect,
  });

  schedulePostMessageMemoryCapture(message.id);

  return {
    ...mapPostMessageRow(message, new Set()),
    mentionedLabels: [],
  };
}

export async function deletePostMessage(input: {
  workspaceId: string;
  userId: string;
  messageId: string;
}): Promise<void> {
  const message = await prisma.postMessage.findUnique({
    where: { id: input.messageId },
    select: {
      id: true,
      authorId: true,
      parentMessageId: true,
      post: { select: { id: true, workspaceId: true } },
      _count: { select: { replies: true } },
    },
  });
  if (!message || message.post.workspaceId !== input.workspaceId) {
    throw new ServiceError("Message not found", "NOT_FOUND");
  }

  await requireWriteMember(input.userId, input.workspaceId);
  if (message.authorId !== input.userId) {
    throw new ServiceError("You can only delete your own messages", "FORBIDDEN");
  }
  if (message.parentMessageId === null) {
    throw new ServiceError("Can't delete the opening message — delete the whole discussion instead", "INVALID_INPUT");
  }
  if (message._count.replies > 0) {
    throw new ServiceError("Can't delete a message that has replies", "INVALID_INPUT");
  }

  await prisma.$transaction([
    prisma.postMessage.delete({ where: { id: input.messageId } }),
    prisma.post.update({
      where: { id: message.post.id },
      data: { replyCount: { decrement: 1 } },
    }),
  ]);
}

export async function deletePost(input: {
  workspaceId: string;
  userId: string;
  postId: string;
}): Promise<void> {
  const membership = await requireWriteMember(input.userId, input.workspaceId);

  const post = await prisma.post.findFirst({
    where: { id: input.postId, workspaceId: input.workspaceId },
    select: { id: true, authorId: true },
  });
  if (!post) {
    throw new ServiceError("Discussion not found", "NOT_FOUND");
  }

  const canManage =
    isLeadership(membership.role) || post.authorId === input.userId;
  if (!canManage) {
    throw new ServiceError(
      "Only the author or workspace leaders can delete discussions",
      "FORBIDDEN"
    );
  }

  await prisma.post.delete({ where: { id: input.postId } });
}

export async function setPostMessageSaved(input: {
  workspaceId: string;
  userId: string;
  messageId: string;
  saved: boolean;
}): Promise<boolean> {
  const message = await prisma.postMessage.findUnique({
    where: { id: input.messageId },
    select: {
      id: true,
      isAgentGenerated: true,
      isAgentPrivate: true,
      post: { select: { workspaceId: true } },
    },
  });
  if (!message || message.post.workspaceId !== input.workspaceId) {
    throw new ServiceError("Message not found", "NOT_FOUND");
  }

  await requireWriteMember(input.userId, input.workspaceId);

  if (input.saved && (message.isAgentGenerated || message.isAgentPrivate)) {
    throw new ServiceError(
      "Private agent messages can't be saved",
      "INVALID_INPUT"
    );
  }

  if (input.saved) {
    await prisma.postMessageSave.upsert({
      where: {
        messageId_userId: {
          messageId: input.messageId,
          userId: input.userId,
        },
      },
      create: {
        messageId: input.messageId,
        userId: input.userId,
      },
      update: {},
    });
    return true;
  }

  await prisma.postMessageSave.deleteMany({
    where: { messageId: input.messageId, userId: input.userId },
  });
  return false;
}

export async function listSavedPostMessages(
  workspaceId: string,
  userId: string
): Promise<SavedPostMessageRow[]> {
  await requireWorkspaceMember(userId, workspaceId);

  const saves = await prisma.postMessageSave.findMany({
    where: {
      userId,
      message: { post: { workspaceId } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      message: {
        select: {
          ...messageSelect,
          post: {
            select: {
              id: true,
              title: true,
              messages: {
                where: { parentMessageId: null },
                take: 1,
                select: { body: true, isAgentPrivate: true },
              },
            },
          },
        },
      },
    },
  });

  const savedIds = new Set(saves.map((save) => save.message.id));

  return saves
    .filter((save) =>
      canViewPostMessageForUser(
        {
          isAgentGenerated: save.message.isAgentGenerated,
          agentTriggeredByUserId: save.message.agentTriggeredByUserId,
          isAgentPrivate: save.message.isAgentPrivate,
          authorId: save.message.author.id,
        },
        userId
      )
    )
    .map((save) => {
    const message = save.message;
    const opener = message.post.messages[0];
    const openerBody = opener?.body ?? message.body;
    const openerPrivate = opener?.isAgentPrivate ?? message.isAgentPrivate;
    const postTitle =
      openerPrivate ||
      message.isAgentPrivate ||
      message.isAgentGenerated
        ? PRIVATE_AGENT_DISCUSSION_TITLE
        : postFeedTitle(message.post.title, openerBody);
    return {
      ...mapPostMessageRow(message, savedIds),
      postTitle,
    };
  });
}

export async function setPostPinned(input: {
  workspaceId: string;
  userId: string;
  postId: string;
  pinned: boolean;
}): Promise<boolean> {
  const membership = await requireWorkspaceMember(input.userId, input.workspaceId);
  if (!isLeadership(membership.role)) {
    throw new ServiceError(
      "Only leaders and sub-leaders can pin discussions",
      "FORBIDDEN"
    );
  }

  const post = await prisma.post.findFirst({
    where: { id: input.postId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!post) {
    throw new ServiceError("Discussion not found", "NOT_FOUND");
  }

  await prisma.post.update({
    where: { id: input.postId },
    data: { pinned: input.pinned },
  });
  return input.pinned;
}

export async function setPostStatus(input: {
  workspaceId: string;
  userId: string;
  postId: string;
  status: PostStatus;
}): Promise<PostStatus> {
  const membership = await requireWriteMember(input.userId, input.workspaceId);

  const post = await prisma.post.findFirst({
    where: { id: input.postId, workspaceId: input.workspaceId },
    select: { id: true, authorId: true, kind: true, status: true },
  });
  if (!post) {
    throw new ServiceError("Discussion not found", "NOT_FOUND");
  }

  const canManage =
    isLeadership(membership.role) || post.authorId === input.userId;
  if (!canManage) {
    throw new ServiceError(
      "Only the author or workspace leaders can close discussions",
      "FORBIDDEN"
    );
  }

  if (post.status === input.status) {
    return post.status;
  }

  await prisma.post.update({
    where: { id: input.postId },
    data: { status: input.status },
  });

  if (
    input.status === "RESOLVED" &&
    (post.kind === "QUESTION" || post.kind === "PROPOSAL")
  ) {
    schedulePostClosedMemoryCapture(input.postId, input.userId);
  }

  return input.status;
}

export async function setPostTaskLink(input: {
  workspaceId: string;
  userId: string;
  postId: string;
  taskId: string | null;
  taskShortId?: number;
}): Promise<{ taskId: string | null; taskShortId: number | null; taskTitle: string | null }> {
  const membership = await requireWriteMember(input.userId, input.workspaceId);

  const post = await prisma.post.findFirst({
    where: { id: input.postId, workspaceId: input.workspaceId },
    select: { id: true, authorId: true },
  });
  if (!post) {
    throw new ServiceError("Discussion not found", "NOT_FOUND");
  }

  const canManage =
    isLeadership(membership.role) || post.authorId === input.userId;
  if (!canManage) {
    throw new ServiceError(
      "Only the author or workspace leaders can link a task",
      "FORBIDDEN"
    );
  }

  let taskId: string | null = input.taskId;
  if (input.taskShortId !== undefined) {
    const task = await prisma.task.findFirst({
      where: { workspaceId: input.workspaceId, shortId: input.taskShortId },
      select: postTaskSelect,
    });
    if (!task) {
      throw new ServiceError(
        `Task #${input.taskShortId} not found in this workspace`,
        "NOT_FOUND"
      );
    }
    taskId = task.id;
  } else if (taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId: input.workspaceId },
      select: postTaskSelect,
    });
    if (!task) {
      throw new ServiceError("Task not found in this workspace", "NOT_FOUND");
    }
  }

  const updated = await prisma.post.update({
    where: { id: input.postId },
    data: { taskId },
    select: {
      taskId: true,
      task: { select: postTaskSelect },
    },
  });

  return {
    taskId: updated.taskId,
    taskShortId: updated.task?.shortId ?? null,
    taskTitle: updated.task?.title ?? null,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolvePostInWorkspace(
  workspaceId: string,
  userId: string,
  query: string
): Promise<{ id: string; title: string; openerMessageId: string }> {
  await requireWorkspaceMember(userId, workspaceId);
  const trimmed = query.trim();
  if (!trimmed) {
    throw new ServiceError("Discussion reference is required", "INVALID_INPUT");
  }

  if (UUID_RE.test(trimmed)) {
    const post = await prisma.post.findFirst({
      where: { id: trimmed, workspaceId },
      select: {
        id: true,
        title: true,
        messages: {
          where: { parentMessageId: null },
          take: 1,
          select: { id: true, body: true },
        },
      },
    });
    if (!post || post.messages.length === 0) {
      throw new ServiceError("Discussion not found", "NOT_FOUND");
    }
    return {
      id: post.id,
      title: postFeedTitle(post.title, post.messages[0].body),
      openerMessageId: post.messages[0].id,
    };
  }

  const posts = await prisma.post.findMany({
    where: { workspaceId },
    orderBy: { lastActivityAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      messages: {
        where: { parentMessageId: null },
        take: 1,
        select: { id: true, body: true },
      },
    },
  });

  const needle = trimmed.toLowerCase();
  const match = posts.find((post) => {
    const openerBody = post.messages[0]?.body ?? "";
    const title = postFeedTitle(post.title, openerBody).toLowerCase();
    return title.includes(needle) || openerBody.toLowerCase().includes(needle);
  });

  if (!match || match.messages.length === 0) {
    throw new ServiceError(
      `No discussion matched "${trimmed}". Try a more specific title.`,
      "NOT_FOUND"
    );
  }

  return {
    id: match.id,
    title: postFeedTitle(match.title, match.messages[0].body),
    openerMessageId: match.messages[0].id,
  };
}
