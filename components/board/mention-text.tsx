import type { MentionMember } from "@/lib/mentions";
import { parseMentionText } from "@/lib/mentions";

export function MentionText({
  body,
  members,
  className = "",
}: {
  body: string;
  members: MentionMember[];
  className?: string;
}) {
  const parts = parseMentionText(body, members);

  return (
    <p className={`whitespace-pre-wrap leading-relaxed ${className}`.trim()}>
      {parts.map((part, index) => {
        if (part.type === "mention") {
          return (
            <span
              key={`m-${index}`}
              className="rounded bg-paper-deep/90 px-1 py-0.5 font-semibold text-ink"
            >
              @{part.label}
            </span>
          );
        }
        return <span key={`t-${index}`}>{part.value}</span>;
      })}
    </p>
  );
}
