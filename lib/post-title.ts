export const PRIVATE_AGENT_DISCUSSION_TITLE = "Private agent conversation";

const FEED_TITLE_MAX = 60;
const THREAD_TITLE_MAX = 200;

function normalizeBody(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

function truncateTitle(text: string, max: number): string {
  if (text.length <= max) return text;

  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.4 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

/** Auto-generate a short title for the feed when none is provided. */
export function derivePostTitle(
  body: string,
  explicitTitle?: string | null,
  maxLength = FEED_TITLE_MAX
): string | null {
  const trimmed = explicitTitle?.trim();
  if (trimmed) return trimmed;

  const normalized = normalizeBody(body);
  if (!normalized) return null;

  return truncateTitle(normalized, maxLength);
}

/** Feed card title — truncated for scanning. */
export function postFeedTitle(
  title: string | null | undefined,
  openerBody: string
): string {
  const explicit = title?.trim();
  if (explicit) return truncateTitle(explicit, FEED_TITLE_MAX);
  return derivePostTitle(openerBody) || "Discussion";
}

/**
 * Thread page headline — full opener when auto-titled; fixes legacy rows that
 * stored a truncated title in the database.
 */
export function postThreadTitle(
  title: string | null | undefined,
  openerBody: string
): string {
  const explicit = title?.trim();
  const normalized = normalizeBody(openerBody);

  if (explicit) {
    if (explicit.endsWith("…") && normalized.length > explicit.length - 1) {
      const stem = explicit.slice(0, -1).trim();
      if (normalized.startsWith(stem)) {
        return normalized.length <= THREAD_TITLE_MAX
          ? normalized
          : truncateTitle(normalized, THREAD_TITLE_MAX);
      }
    }
    return explicit;
  }

  if (!normalized) return "Discussion";
  return normalized.length <= THREAD_TITLE_MAX
    ? normalized
    : truncateTitle(normalized, THREAD_TITLE_MAX);
}

/** @deprecated Use postFeedTitle or postThreadTitle */
export function postDisplayTitle(
  title: string | null | undefined,
  openerBody: string
): string {
  return postFeedTitle(title, openerBody);
}

/** Feed preview — first line or truncated body. */
export function postBodyPreview(body: string, max = 160): string {
  const normalized = normalizeBody(body);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}…`;
}
