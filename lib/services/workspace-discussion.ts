import { prisma } from "@/lib/prisma";
import { getActorMembership, ServiceError } from "@/lib/services/project";
import { resolveAllMentionUserIds, mentionLabelsForUsers } from "@/lib/mentions";
import { displayUser } from "@/lib/username";

export const MAX_WORKSPACE_MESSAGE_BODY = 8000;
export const DEFAULT_WORKSPACE_MESSAGES_LIMIT = 50;
export const MAX_WORKSPACE_MESSAGES_LIMIT = 100;

const authorSelect = {
  id: true,
  email: true,
  username: true,
} as const;

export type WorkspaceMessageRow = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; email: string | null; username: string };
  mentionedLabels: string[];
  saved: boolean;
};

function mapWorkspaceMessageRow(
  message: {
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; email: string | null; username: string };
    mentions: { user: { id: string; email: string | null; username: string } }[];
  },
  savedIds: Set<string>
): WorkspaceMessageRow {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    author: message.author,
    mentionedLabels: message.mentions.map((m) => displayUser(m.user)),
    saved: savedIds.has(message.id),
  };
}

async function savedMessageIdsForWorkspace(
  userId: string,
  workspaceId: string
): Promise<Set<string>> {
  const rows = await prisma.workspaceMessageSave.findMany({
    where: { userId, message: { workspaceId } },
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

export async function listWorkspaceMessages(
  workspaceId: string,
  userId: string,
  options?: { limit?: number; before?: Date }
): Promise<WorkspaceMessageRow[]> {
  await requireWorkspaceMember(userId, workspaceId);
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_WORKSPACE_MESSAGES_LIMIT),
    MAX_WORKSPACE_MESSAGES_LIMIT
  );

  const savedIds = await savedMessageIdsForWorkspace(userId, workspaceId);

  const messages = await prisma.workspaceMessage.findMany({
    where: {
      workspaceId,
      ...(options?.before ? { createdAt: { lt: options.before } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
      mentions: {
        select: {
          user: { select: authorSelect },
        },
      },
    },
  });

  return messages.map((message) => mapWorkspaceMessageRow(message, savedIds));
}

export async function createWorkspaceMessage(input: {
  workspaceId: string;
  userId: string;
  body: string;
  mentionRefs?: string[];
}): Promise<WorkspaceMessageRow> {
  const body = input.body.trim();
  if (!body) {
    throw new ServiceError("Message can't be empty", "INVALID_INPUT");
  }
  if (body.length > MAX_WORKSPACE_MESSAGE_BODY) {
    throw new ServiceError(
      `Message is too long (max ${MAX_WORKSPACE_MESSAGE_BODY} characters)`,
      "INVALID_INPUT"
    );
  }

  await requireWorkspaceMember(input.userId, input.workspaceId);

  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId: input.workspaceId },
    include: { user: { select: authorSelect } },
  });
  const mentionedUserIds = resolveAllMentionUserIds(
    memberships,
    body,
    input.mentionRefs
  ).filter((id) => id !== input.userId);

  const message = await prisma.workspaceMessage.create({
    data: {
      workspaceId: input.workspaceId,
      authorId: input.userId,
      body,
      ...(mentionedUserIds.length > 0
        ? {
            mentions: {
              create: mentionedUserIds.map((userId) => ({ userId })),
            },
          }
        : {}),
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
      mentions: {
        select: {
          user: { select: authorSelect },
        },
      },
    },
  });

  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    author: message.author,
    mentionedLabels: mentionLabelsForUsers(memberships, mentionedUserIds),
    saved: false,
  };
}

export async function deleteWorkspaceMessage(input: {
  workspaceId: string;
  userId: string;
  messageId: string;
}): Promise<void> {
  const message = await prisma.workspaceMessage.findUnique({
    where: { id: input.messageId },
    select: { id: true, workspaceId: true, authorId: true },
  });
  if (!message || message.workspaceId !== input.workspaceId) {
    throw new ServiceError("Message not found", "NOT_FOUND");
  }

  await requireWorkspaceMember(input.userId, input.workspaceId);
  if (message.authorId !== input.userId) {
    throw new ServiceError("You can only delete your own messages", "FORBIDDEN");
  }

  await prisma.workspaceMessage.delete({ where: { id: input.messageId } });
}

export async function setWorkspaceMessageSaved(input: {
  workspaceId: string;
  userId: string;
  messageId: string;
  saved: boolean;
}): Promise<boolean> {
  const message = await prisma.workspaceMessage.findUnique({
    where: { id: input.messageId },
    select: { id: true, workspaceId: true },
  });
  if (!message || message.workspaceId !== input.workspaceId) {
    throw new ServiceError("Message not found", "NOT_FOUND");
  }

  await requireWorkspaceMember(input.userId, input.workspaceId);

  if (input.saved) {
    await prisma.workspaceMessageSave.upsert({
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

  await prisma.workspaceMessageSave.deleteMany({
    where: { messageId: input.messageId, userId: input.userId },
  });
  return false;
}
