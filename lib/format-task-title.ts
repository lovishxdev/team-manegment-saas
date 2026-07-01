/** Capitalize the first letter of each word in a task title. */
export function formatTaskTitle(title: string): string {
  return title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const MAX_TASK_TITLE_CHARS = 120;

/**
 * Keeps board titles readable: overflow from a long title moves into description.
 */
export function normalizeTaskTitleAndDescription(
  title: string,
  description?: string | null
): { title: string; description: string | null } {
  const trimmedTitle = title.trim();
  const trimmedDesc = description?.trim() || null;

  if (trimmedTitle.length <= MAX_TASK_TITLE_CHARS) {
    return { title: trimmedTitle, description: trimmedDesc };
  }

  const cut = trimmedTitle.lastIndexOf(" ", MAX_TASK_TITLE_CHARS);
  const splitAt = cut > 40 ? cut : MAX_TASK_TITLE_CHARS;
  const shortTitle = trimmedTitle.slice(0, splitAt).trim();
  const overflow = trimmedTitle.slice(splitAt).trim();
  const mergedDesc = [overflow, trimmedDesc].filter(Boolean).join("\n\n");

  return {
    title: shortTitle || trimmedTitle.slice(0, MAX_TASK_TITLE_CHARS),
    description: mergedDesc || null,
  };
}
