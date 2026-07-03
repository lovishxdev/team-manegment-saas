/** Default categories seeded for every workspace. */
export const DEFAULT_CATEGORIES = [
  { name: "General", slug: "general", sortOrder: 0 },
  { name: "Frontend", slug: "frontend", sortOrder: 1 },
  { name: "Backend", slug: "backend", sortOrder: 2 },
  { name: "Design", slug: "design", sortOrder: 3 },
] as const;

/** Legacy enum values from WhatsApp/MCP prompts and old tasks. */
export const LEGACY_SCOPE_SLUGS: Record<string, string> = {
  GENERAL: "general",
  FRONTEND: "frontend",
  BACKEND: "backend",
  DESIGN: "design",
};

const MAX_CATEGORY_NAME_LENGTH = 32;

export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function validateCategoryName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) {
    throw new Error("Category name is required");
  }
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new Error(
      `Category name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer`
    );
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(name)) {
    throw new Error(
      "Category name can only contain letters, numbers, spaces, hyphens, and underscores"
    );
  }
  return name;
}

export function formatCategoryLabel(name: string): string {
  return name;
}
