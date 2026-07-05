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

