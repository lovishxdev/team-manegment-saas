import type { ReactNode } from "react";
import {
  parseMarkdown,
  type BlockNode,
  type InlineNode,
} from "@/lib/markdown/parse";

export type MarkdownVariant = "default" | "chat-assistant" | "chat-user";

const VARIANT_CLASSES: Record<
  MarkdownVariant,
  {
    root: string;
    p: string;
    ul: string;
    ol: string;
    li: string;
    h1: string;
    h2: string;
    h3: string;
    strong: string;
    em: string;
    code: string;
    link: string;
  }
> = {
  default: {
    root: "space-y-2 text-sm leading-relaxed text-ink",
    p: "",
    ul: "list-disc space-y-1 pl-5",
    ol: "list-decimal space-y-1 pl-5",
    li: "",
    h1: "text-lg font-semibold text-ink",
    h2: "text-base font-semibold text-ink",
    h3: "text-sm font-semibold text-ink",
    strong: "font-semibold text-ink",
    em: "italic",
    code: "rounded bg-paper-deep/80 px-1 py-0.5 font-mono text-[0.85em] text-ink",
    link: "font-medium text-ink underline underline-offset-2",
  },
  "chat-assistant": {
    root: "space-y-2 text-sm leading-relaxed text-ink",
    p: "",
    ul: "list-disc space-y-1 pl-5",
    ol: "list-decimal space-y-1 pl-5",
    li: "",
    h1: "text-base font-semibold text-ink",
    h2: "text-sm font-semibold text-ink",
    h3: "text-sm font-semibold text-ink",
    strong: "font-semibold text-ink",
    em: "italic",
    code: "rounded bg-paper-deep/80 px-1 py-0.5 font-mono text-[0.85em] text-ink",
    link: "font-medium text-ink underline underline-offset-2",
  },
  "chat-user": {
    root: "space-y-2 text-sm leading-relaxed text-white",
    p: "",
    ul: "list-disc space-y-1 pl-5",
    ol: "list-decimal space-y-1 pl-5",
    li: "",
    h1: "text-base font-semibold text-white",
    h2: "text-sm font-semibold text-white",
    h3: "text-sm font-semibold text-white",
    strong: "font-semibold text-white",
    em: "italic text-white/90",
    code: "rounded bg-white/15 px-1 py-0.5 font-mono text-[0.85em] text-white",
    link: "font-medium text-white underline underline-offset-2",
  },
};

function renderInline(
  nodes: InlineNode[],
  variant: MarkdownVariant,
  keyPrefix: string
): ReactNode[] {
  const classes = VARIANT_CLASSES[variant];

  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (node.type) {
      case "text":
        return node.value;
      case "bold":
        return (
          <strong key={key} className={classes.strong}>
            {renderInline(node.children, variant, key)}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className={classes.em}>
            {renderInline(node.children, variant, key)}
          </em>
        );
      case "code":
        return (
          <code key={key} className={classes.code}>
            {node.value}
          </code>
        );
      case "link": {
        const href = node.href.trim();
        const safe =
          href.startsWith("/") ||
          href.startsWith("https://") ||
          href.startsWith("http://");
        if (!safe) {
          return renderInline(node.children, variant, key);
        }
        return (
          <a
            key={key}
            href={href}
            className={classes.link}
            target={href.startsWith("/") ? undefined : "_blank"}
            rel={href.startsWith("/") ? undefined : "noopener noreferrer"}
          >
            {renderInline(node.children, variant, key)}
          </a>
        );
      }
      default:
        return null;
    }
  });
}

function renderBlock(
  block: BlockNode,
  variant: MarkdownVariant,
  index: number
): ReactNode {
  const classes = VARIANT_CLASSES[variant];
  const key = `block-${index}`;

  switch (block.type) {
    case "paragraph":
      return (
        <p key={key} className={classes.p}>
          {renderInline(block.children, variant, key)}
        </p>
      );
    case "ul":
      return (
        <ul key={key} className={classes.ul}>
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-li-${itemIndex}`} className={classes.li}>
              {renderInline(item, variant, `${key}-li-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className={classes.ol}>
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-li-${itemIndex}`} className={classes.li}>
              {renderInline(item, variant, `${key}-li-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
    case "heading": {
      const headingClass =
        block.level === 1
          ? classes.h1
          : block.level === 2
            ? classes.h2
            : classes.h3;
      const Tag = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
      return (
        <Tag key={key} className={headingClass}>
          {renderInline(block.children, variant, key)}
        </Tag>
      );
    }
    default:
      return null;
  }
}

export function MarkdownContent({
  source,
  variant = "default",
  className = "",
}: {
  source: string;
  variant?: MarkdownVariant;
  className?: string;
}) {
  const blocks = parseMarkdown(source);
  if (blocks.length === 0) return null;

  const classes = VARIANT_CLASSES[variant];

  return (
    <div className={`${classes.root} ${className}`.trim()}>
      {blocks.map((block, index) => renderBlock(block, variant, index))}
    </div>
  );
}
