/**
 * Deterministic parsing for "tag the last photo …" style WhatsApp messages.
 * Runs before the Claude tool loop so tagging works even when the model
 * refuses to call update_asset_tags.
 */

export type AssetTagCommand = {
  mode: "add" | "remove" | "set";
  tags: string[];
  latest?: boolean;
  fileName?: string;
};

function parseTagList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

const ASSET_NOUN =
  "(?:photo|image|picture|file|upload|document|asset)s?";

export function parseAssetTagCommand(text: string): AssetTagCommand | null {
  const input = text.trim();
  if (!input) return null;

  const lower = input.toLowerCase();
  if (
    !/\b(tag|tags|label|labelled|labeled)\b/i.test(lower) &&
    !/\b(add|remove|delete)\s+tags?\b/i.test(lower)
  ) {
    return null;
  }

  if (
    !/\b(photo|image|picture|file|upload|document|asset|last|latest|recent|it|that)\b/i.test(
      lower
    )
  ) {
    return null;
  }

  let match = input.match(
    new RegExp(
      `^(?:please\\s+)?(?:remove|delete|drop)\\s+tags?\\s+(.+?)\\s+from\\s+(?:the\\s+)?(?:last|latest|recent)\\s+${ASSET_NOUN}$`,
      "i"
    )
  );
  if (match) {
    const tags = parseTagList(match[1]);
    return tags.length ? { mode: "remove", tags, latest: true } : null;
  }

  match = input.match(
    new RegExp(
      `^(?:please\\s+)?add\\s+tags?\\s+(.+?)\\s+to\\s+(?:the\\s+)?(?:last|latest|recent)\\s+${ASSET_NOUN}$`,
      "i"
    )
  );
  if (match) {
    const tags = parseTagList(match[1]);
    return tags.length ? { mode: "add", tags, latest: true } : null;
  }

  match = input.match(
    /^(?:please\s+)?(?:tag|label)\s+(?:it|that)(?:\s+(?:photo|image|file))?\s+(?:with|as)\s+(.+)$/i
  );
  if (match) {
    const tags = parseTagList(match[1]);
    return tags.length ? { mode: "add", tags, latest: true } : null;
  }

  match = input.match(
    new RegExp(
      `^(?:please\\s+)?(?:tag|label)\\s+(?:the\\s+)?(?:last|latest|recent)\\s+${ASSET_NOUN}\\s+(?:with|as)\\s+(.+)$`,
      "i"
    )
  );
  if (match) {
    const tags = parseTagList(match[1]);
    return tags.length ? { mode: "add", tags, latest: true } : null;
  }

  match = input.match(
    new RegExp(
      `^(?:please\\s+)?(?:tag|label)\\s+(?:the\\s+)?(?:last|latest|recent)\\s+${ASSET_NOUN}[:\\s]+(.+)$`,
      "i"
    )
  );
  if (match) {
    const tags = parseTagList(match[1]);
    return tags.length ? { mode: "add", tags, latest: true } : null;
  }

  match = input.match(
    /^(?:please\s+)?(?:tag|label)\s+(?:file\s+)?["']?([^"']+?)["']?\s+(?:with|as)\s+(.+)$/i
  );
  if (match) {
    const fileName = match[1].trim();
    if (!/^(?:last|latest|recent|it|that)$/i.test(fileName)) {
      const tags = parseTagList(match[2]);
      return tags.length ? { mode: "add", tags, fileName } : null;
    }
  }

  match = input.match(
    /^(?:please\s+)?(?:tag|label)\s+(?:this|that|the)\s+(.+)$/i
  );
  if (match && /(?:photo|image|file|upload|asset|picture)/i.test(input)) {
    const tail = match[1];
    const tagsPart = tail.replace(
      /^(?:last|latest|recent)\s+(?:photo|image|file|upload|asset|picture)\s*(?:with|as)?\s*/i,
      ""
    );
    const tags = parseTagList(tagsPart);
    if (tags.length) return { mode: "add", tags, latest: true };
  }

  return null;
}
