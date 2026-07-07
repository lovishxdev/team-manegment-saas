export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: InlineNode[] };

export type BlockNode =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "ul"; items: InlineNode[][] }
  | { type: "ol"; items: InlineNode[][] }
  | { type: "heading"; level: 1 | 2 | 3; children: InlineNode[] };

function parseInlineSegment(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let index = 0;

  while (index < text.length) {
    const rest = text.slice(index);

    const patterns: {
      re: RegExp;
      build: (match: RegExpMatchArray) => InlineNode;
    }[] = [
      {
        re: /^\[([^\]]+)\]\(([^)]+)\)/,
        build: (m) => ({
          type: "link",
          href: m[2],
          children: parseInlineSegment(m[1]),
        }),
      },
      {
        re: /^\*\*([^*]+)\*\*/,
        build: (m) => ({
          type: "bold",
          children: parseInlineSegment(m[1]),
        }),
      },
      {
        re: /^__([^_]+)__/,
        build: (m) => ({
          type: "bold",
          children: parseInlineSegment(m[1]),
        }),
      },
      {
        re: /^\*([^*]+)\*/,
        build: (m) => ({
          type: "italic",
          children: parseInlineSegment(m[1]),
        }),
      },
      {
        re: /^_([^_]+)_/,
        build: (m) => ({
          type: "italic",
          children: parseInlineSegment(m[1]),
        }),
      },
      {
        re: /^`([^`]+)`/,
        build: (m) => ({ type: "code", value: m[1] }),
      },
    ];

    let matched = false;
    for (const { re, build } of patterns) {
      const match = rest.match(re);
      if (match) {
        nodes.push(build(match));
        index += match[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const nextSpecial = rest.search(/[\[*_`]/);
      const end = nextSpecial === -1 ? rest.length : nextSpecial;
      if (end > 0) {
        nodes.push({ type: "text", value: rest.slice(0, end) });
        index += end;
      } else {
        nodes.push({ type: "text", value: rest[0] });
        index += 1;
      }
    }
  }

  return nodes;
}

function parseHeading(line: string): BlockNode | null {
  const match = line.match(/^(#{1,3})\s+(.+)$/);
  if (!match) return null;
  return {
    type: "heading",
    level: match[1].length as 1 | 2 | 3,
    children: parseInlineSegment(match[2]),
  };
}

function parseBullet(line: string): InlineNode[] | null {
  const match = line.match(/^[-*+]\s+(.+)$/);
  if (!match) return null;
  return parseInlineSegment(match[1]);
}

function parseOrdered(line: string): InlineNode[] | null {
  const match = line.match(/^\d+\.\s+(.+)$/);
  if (!match) return null;
  return parseInlineSegment(match[1]);
}

/** Parse a markdown string into block nodes (safe subset for chat + descriptions). */
export function parseMarkdown(source: string): BlockNode[] {
  const normalized = source.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const blocks: BlockNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      blocks.push(heading);
      index += 1;
      continue;
    }

    const bullet = parseBullet(line);
    if (bullet) {
      const items: InlineNode[][] = [bullet];
      index += 1;
      while (index < lines.length) {
        const next = parseBullet(lines[index]);
        if (!next) break;
        items.push(next);
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const ordered = parseOrdered(line);
    if (ordered) {
      const items: InlineNode[][] = [ordered];
      index += 1;
      while (index < lines.length) {
        const next = parseOrdered(lines[index]);
        if (!next) break;
        items.push(next);
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index];
      if (
        !next.trim() ||
        parseHeading(next) ||
        parseBullet(next) ||
        parseOrdered(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      children: parseInlineSegment(paragraphLines.join("\n")),
    });
  }

  return blocks;
}

/**
 * Strip markdown syntax for previews, search scoring, and plain-text channels
 * (e.g. WhatsApp). Plain text passes through unchanged.
 */
export function markdownToPlainText(source: string): string {
  const normalized = source.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  return normalized
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
