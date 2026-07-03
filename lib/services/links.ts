import { prisma } from "@/lib/prisma";
import {
  getActorMembership,
  ServiceError,
  touchLastActiveWorkspace,
} from "@/lib/services/project";

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ServiceError("URL is required", "INVALID_INPUT");
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new ServiceError("Enter a valid URL", "INVALID_INPUT");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ServiceError("Only http and https links are allowed", "INVALID_INPUT");
  }

  return parsed.toString();
}

/** Web links tab: bookmarks + workspace + caller role. */
export async function getLinksView(workspaceId: string, userId: string) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }

  const [workspace, links] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true },
    }),
    prisma.workspaceLink.findMany({
      where: { workspaceId },
      include: {
        createdBy: { select: { id: true, email: true, username: true } },
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    }),
    touchLastActiveWorkspace(userId, workspaceId),
  ]);

  return { workspace, links, selfRole: membership.role };
}

export async function createWorkspaceLink(input: {
  workspaceId: string;
  userId: string;
  title: string;
  url: string;
  description?: string | null;
  pinned?: boolean;
}) {
  const { workspaceId, userId } = input;
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }

  const title = input.title.trim();
  if (!title) {
    throw new ServiceError("Title is required", "INVALID_INPUT");
  }
  if (title.length > 120) {
    throw new ServiceError("Title must be 120 characters or fewer", "INVALID_INPUT");
  }

  const url = normalizeUrl(input.url);
  const description = input.description?.trim() || null;
  if (description && description.length > 500) {
    throw new ServiceError(
      "Description must be 500 characters or fewer",
      "INVALID_INPUT"
    );
  }

  const link = await prisma.workspaceLink.create({
    data: {
      workspaceId,
      title,
      url,
      description,
      pinned: input.pinned ?? false,
      createdById: userId,
    },
  });
  await touchLastActiveWorkspace(userId, workspaceId);
  return link;
}

/** List workspace bookmarks (MCP, WhatsApp, etc.). */
export async function listWorkspaceLinks(workspaceId: string, userId: string) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }

  const links = await prisma.workspaceLink.findMany({
    where: { workspaceId },
    include: {
      createdBy: { select: { id: true, email: true, username: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  await touchLastActiveWorkspace(userId, workspaceId);
  return links;
}

export async function deleteWorkspaceLink(input: {
  workspaceId: string;
  linkId: string;
  userId: string;
}) {
  const { workspaceId, linkId, userId } = input;
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }

  const link = await prisma.workspaceLink.findFirst({
    where: { id: linkId, workspaceId },
  });
  if (!link) {
    throw new ServiceError("Link not found in this workspace", "NOT_FOUND");
  }

  const isLeadership =
    membership.role === "LEADER" || membership.role === "SUB_LEADER";
  if (!isLeadership && link.createdById !== userId) {
    throw new ServiceError(
      "Only leaders, sub-leaders, or the person who added the link can delete it",
      "FORBIDDEN"
    );
  }

  await prisma.workspaceLink.delete({ where: { id: linkId } });
}

export async function toggleWorkspaceLinkPin(input: {
  workspaceId: string;
  linkId: string;
  userId: string;
}) {
  const { workspaceId, linkId, userId } = input;
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }

  const link = await prisma.workspaceLink.findFirst({
    where: { id: linkId, workspaceId },
  });
  if (!link) {
    throw new ServiceError("Link not found in this workspace", "NOT_FOUND");
  }

  return prisma.workspaceLink.update({
    where: { id: linkId },
    data: { pinned: !link.pinned },
  });
}

/** Resolve a bookmark by id, title, or URL fragment. */
export async function resolveWorkspaceLink(
  workspaceId: string,
  userId: string,
  identifier: string
) {
  const links = await listWorkspaceLinks(workspaceId, userId);
  const trimmed = identifier.trim();

  const byId = links.find((l) => l.id === trimmed);
  if (byId) return byId;

  const needle = trimmed.toLowerCase();
  const exactTitle = links.filter((l) => l.title.toLowerCase() === needle);
  if (exactTitle.length === 1) return exactTitle[0];

  const matches = links.filter(
    (l) =>
      l.title.toLowerCase().includes(needle) ||
      l.url.toLowerCase().includes(needle)
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new ServiceError(
      `Multiple links match "${identifier}": ${matches.map((l) => l.title).join(", ")}. Be more specific.`,
      "INVALID_INPUT"
    );
  }

  throw new ServiceError(
    `No link matching "${identifier}" in this workspace`,
    "NOT_FOUND"
  );
}

export async function updateWorkspaceLink(input: {
  workspaceId: string;
  userId: string;
  linkId: string;
  title?: string;
  url?: string;
  description?: string | null;
  pinned?: boolean;
}) {
  const { workspaceId, linkId, userId } = input;
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }

  const link = await prisma.workspaceLink.findFirst({
    where: { id: linkId, workspaceId },
  });
  if (!link) {
    throw new ServiceError("Link not found in this workspace", "NOT_FOUND");
  }

  const isLeadership =
    membership.role === "LEADER" || membership.role === "SUB_LEADER";
  if (!isLeadership && link.createdById !== userId) {
    throw new ServiceError(
      "Only leaders, sub-leaders, or the person who added the link can edit it",
      "FORBIDDEN"
    );
  }

  const data: {
    title?: string;
    url?: string;
    description?: string | null;
    pinned?: boolean;
  } = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      throw new ServiceError("Title is required", "INVALID_INPUT");
    }
    if (title.length > 120) {
      throw new ServiceError(
        "Title must be 120 characters or fewer",
        "INVALID_INPUT"
      );
    }
    data.title = title;
  }

  if (input.url !== undefined) {
    data.url = normalizeUrl(input.url);
  }

  if (input.description !== undefined) {
    const description = input.description?.trim() || null;
    if (description && description.length > 500) {
      throw new ServiceError(
        "Description must be 500 characters or fewer",
        "INVALID_INPUT"
      );
    }
    data.description = description;
  }

  if (input.pinned !== undefined) {
    data.pinned = input.pinned;
  }

  if (Object.keys(data).length === 0) {
    throw new ServiceError("Nothing to update", "INVALID_INPUT");
  }

  const updated = await prisma.workspaceLink.update({
    where: { id: linkId },
    data,
  });
  await touchLastActiveWorkspace(userId, workspaceId);
  return updated;
}

export async function setWorkspaceLinkPin(input: {
  workspaceId: string;
  linkId: string;
  userId: string;
  pinned: boolean;
}) {
  const { workspaceId, linkId, userId, pinned } = input;
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }

  const link = await prisma.workspaceLink.findFirst({
    where: { id: linkId, workspaceId },
  });
  if (!link) {
    throw new ServiceError("Link not found in this workspace", "NOT_FOUND");
  }

  const isLeadership =
    membership.role === "LEADER" || membership.role === "SUB_LEADER";
  if (!isLeadership && link.createdById !== userId) {
    throw new ServiceError(
      "Only leaders, sub-leaders, or the person who added the link can pin it",
      "FORBIDDEN"
    );
  }

  const updated = await prisma.workspaceLink.update({
    where: { id: linkId },
    data: { pinned },
  });
  await touchLastActiveWorkspace(userId, workspaceId);
  return updated;
}
