/** How to show internal shortId alongside the title in WhatsApp copy. */
export type TaskIdDisplay = "never" | "suffix";

/**
 * User-facing task reference — title first; #N only as optional suffix.
 */
export function formatTaskRef(
  title: string,
  shortId?: number | null,
  opts?: { id?: TaskIdDisplay; bold?: boolean }
): string {
  const t = title.trim();
  const bold = opts?.bold !== false;
  const labeled = bold ? `*${t}*` : t;
  const idMode = opts?.id ?? "never";
  if (idMode === "suffix" && shortId != null && shortId > 0) {
    return `${labeled} (#${shortId})`;
  }
  return labeled;
}

/** Board / list line: *Title* · metadata (no #N). */
export function formatTaskListLine(
  title: string,
  meta: string[]
): string {
  const parts = meta.filter(Boolean);
  return parts.length
    ? `${formatTaskRef(title)} · ${parts.join(" · ")}`
    : formatTaskRef(title);
}

/** Humanize legacy tool strings that still lead with #N. */
export function stripLeadingTaskId(text: string): string {
  return text
    .replace(/^Created\s+#\d+\s+/i, "")
    .replace(/^Updated\s+#\d+\s+/i, "")
    .replace(/^Ready to delete\s+#\d+\s+/i, "Ready to delete ")
    .replace(/^Deleted\s+#\d+\s+/i, "Deleted ")
    .replace(/^Posted update on\s+#\d+\s+/i, "Posted on ")
    .replace(/^Posted on\s+#\d+\s+/i, "Posted on ")
    .replace(/Attached\s+"([^"]+)"\s+to\s+#\d+\s+/i, 'Attached "$1" to ')
    .replace(/Delete\s+\*#\d+\*\s+/i, "Delete ")
    .replace(/Update\s+\*#\d+\*\s+/i, "Update ");
}
