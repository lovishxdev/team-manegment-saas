import {
  DEFAULT_CATEGORIES,
  LEGACY_SCOPE_SLUGS,
  slugifyCategoryName,
  validateCategoryName,
} from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/project";

export type WorkspaceCategoryRow = {
  id: string;
  name: string;
  slug: string;
};

/** Idempotent — safe to call on every workspace read. */
export async function ensureDefaultCategories(
  workspaceId: string
): Promise<void> {
  const existing = await prisma.workspaceCategory.findMany({
    where: { workspaceId },
    select: { slug: true },
  });
  const have = new Set(existing.map((c) => c.slug));
  const missing = DEFAULT_CATEGORIES.filter((d) => !have.has(d.slug));
  if (missing.length === 0) return;

  await prisma.workspaceCategory.createMany({
    data: missing.map((d) => ({
      workspaceId,
      name: d.name,
      slug: d.slug,
      sortOrder: d.sortOrder,
    })),
    skipDuplicates: true,
  });
}

export async function seedDefaultCategories(workspaceId: string): Promise<void> {
  await prisma.workspaceCategory.createMany({
    data: DEFAULT_CATEGORIES.map((d) => ({
      workspaceId,
      name: d.name,
      slug: d.slug,
      sortOrder: d.sortOrder,
    })),
  });
}

export async function listWorkspaceCategories(
  workspaceId: string
): Promise<WorkspaceCategoryRow[]> {
  await ensureDefaultCategories(workspaceId);
  return prisma.workspaceCategory.findMany({
    where: { workspaceId },
    select: { id: true, name: true, slug: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function findOrCreateCategoryByName(
  workspaceId: string,
  raw: string
): Promise<WorkspaceCategoryRow> {
  await ensureDefaultCategories(workspaceId);

  const trimmed = raw.trim();
  const legacySlug = LEGACY_SCOPE_SLUGS[trimmed.toUpperCase()];
  if (legacySlug) {
    const legacy = await prisma.workspaceCategory.findFirst({
      where: { workspaceId, slug: legacySlug },
      select: { id: true, name: true, slug: true },
    });
    if (legacy) return legacy;
  }

  let name: string;
  try {
    name = validateCategoryName(trimmed);
  } catch (err) {
    throw new ServiceError(
      err instanceof Error ? err.message : "Invalid category name",
      "INVALID_INPUT"
    );
  }
  const slug = slugifyCategoryName(name);
  if (!slug) {
    throw new ServiceError("Invalid category name", "INVALID_INPUT");
  }

  const existing = await prisma.workspaceCategory.findFirst({
    where: {
      workspaceId,
      OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }],
    },
    select: { id: true, name: true, slug: true },
  });
  if (existing) return existing;

  const maxOrder = await prisma.workspaceCategory.aggregate({
    where: { workspaceId },
    _max: { sortOrder: true },
  });

  return prisma.workspaceCategory.create({
    data: {
      workspaceId,
      name,
      slug,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    select: { id: true, name: true, slug: true },
  });
}

/** Create a category explicitly (fails if the name already exists). */
export async function createWorkspaceCategory(
  workspaceId: string,
  raw: string
): Promise<WorkspaceCategoryRow> {
  await ensureDefaultCategories(workspaceId);

  let name: string;
  try {
    name = validateCategoryName(raw);
  } catch (err) {
    throw new ServiceError(
      err instanceof Error ? err.message : "Invalid category name",
      "INVALID_INPUT"
    );
  }

  const slug = slugifyCategoryName(name);
  const existing = await prisma.workspaceCategory.findFirst({
    where: {
      workspaceId,
      OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }],
    },
    select: { id: true, name: true },
  });
  if (existing) {
    throw new ServiceError(
      `Category "${existing.name}" already exists`,
      "INVALID_INPUT"
    );
  }

  const maxOrder = await prisma.workspaceCategory.aggregate({
    where: { workspaceId },
    _max: { sortOrder: true },
  });

  return prisma.workspaceCategory.create({
    data: {
      workspaceId,
      name,
      slug,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    select: { id: true, name: true, slug: true },
  });
}

export async function resolveTaskCategoryId(
  workspaceId: string,
  input: { categoryId?: string; category?: string }
): Promise<string> {
  await ensureDefaultCategories(workspaceId);

  if (input.categoryId) {
    const cat = await prisma.workspaceCategory.findFirst({
      where: { id: input.categoryId, workspaceId },
      select: { id: true },
    });
    if (!cat) {
      throw new ServiceError("Category not found", "NOT_FOUND");
    }
    return cat.id;
  }

  if (input.category?.trim()) {
    return (await findOrCreateCategoryByName(workspaceId, input.category)).id;
  }

  const general = await prisma.workspaceCategory.findFirst({
    where: { workspaceId, slug: "general" },
    select: { id: true },
  });
  if (!general) {
    throw new ServiceError("Default category missing", "INVALID_INPUT");
  }
  return general.id;
}

export async function getGeneralCategoryId(
  workspaceId: string
): Promise<string> {
  return resolveTaskCategoryId(workspaceId, {});
}
