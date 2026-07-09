import { prisma } from "@/lib/prisma";
import { getActorMembership, ServiceError } from "@/lib/services/project";

export const MAX_DISCUSSION_TAGS_PER_WORKSPACE = 24;
export const MAX_DISCUSSION_TAG_NAME_LENGTH = 24;
export const MAX_TAGS_PER_POST = 6;

export type WorkspaceDiscussionTagRow = {
  id: string;
  name: string;
  slug: string;
};

export function slugifyDiscussionTagName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function validateDiscussionTagName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) {
    throw new ServiceError("Tag name is required", "INVALID_INPUT");
  }
  if (name.length > MAX_DISCUSSION_TAG_NAME_LENGTH) {
    throw new ServiceError(
      `Tag name must be ${MAX_DISCUSSION_TAG_NAME_LENGTH} characters or fewer`,
      "INVALID_INPUT"
    );
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(name)) {
    throw new ServiceError(
      "Tag name can only contain letters, numbers, spaces, hyphens, and underscores",
      "INVALID_INPUT"
    );
  }
  const slug = slugifyDiscussionTagName(name);
  if (!slug) {
    throw new ServiceError("Tag name is invalid", "INVALID_INPUT");
  }
  return name;
}

export function normalizePostTagSlugs(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const slug = slugifyDiscussionTagName(raw);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= MAX_TAGS_PER_POST) break;
  }
  return out;
}

async function requireMember(userId: string, workspaceId: string) {
  const membership = await getActorMembership(userId, workspaceId);
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }
  return membership;
}

export async function listWorkspaceDiscussionTags(
  workspaceId: string,
  userId: string
): Promise<WorkspaceDiscussionTagRow[]> {
  await requireMember(userId, workspaceId);
  return prisma.workspaceDiscussionTag.findMany({
    where: { workspaceId },
    select: { id: true, name: true, slug: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createWorkspaceDiscussionTag(
  workspaceId: string,
  userId: string,
  rawName: string
): Promise<WorkspaceDiscussionTagRow> {
  await requireMember(userId, workspaceId);
  const name = validateDiscussionTagName(rawName);
  const slug = slugifyDiscussionTagName(name);

  const existing = await prisma.workspaceDiscussionTag.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } },
    select: { id: true, name: true, slug: true },
  });
  if (existing) return existing;

  const count = await prisma.workspaceDiscussionTag.count({
    where: { workspaceId },
  });
  if (count >= MAX_DISCUSSION_TAGS_PER_WORKSPACE) {
    throw new ServiceError(
      `This workspace already has the maximum of ${MAX_DISCUSSION_TAGS_PER_WORKSPACE} discussion tags`,
      "INVALID_INPUT"
    );
  }

  return prisma.workspaceDiscussionTag.create({
    data: {
      workspaceId,
      name,
      slug,
      sortOrder: count,
    },
    select: { id: true, name: true, slug: true },
  });
}

export async function resolvePostTagsForWorkspace(
  workspaceId: string,
  userId: string,
  tagSlugs: string[] | undefined
): Promise<string[]> {
  const normalized = normalizePostTagSlugs(tagSlugs);
  if (normalized.length === 0) return [];

  await requireMember(userId, workspaceId);
  const known = await prisma.workspaceDiscussionTag.findMany({
    where: { workspaceId, slug: { in: normalized } },
    select: { slug: true },
  });
  const knownSlugs = new Set(known.map((tag) => tag.slug));
  const missing = normalized.filter((slug) => !knownSlugs.has(slug));
  if (missing.length > 0) {
    throw new ServiceError(
      `Unknown discussion tag${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
      "INVALID_INPUT"
    );
  }
  return normalized;
}
