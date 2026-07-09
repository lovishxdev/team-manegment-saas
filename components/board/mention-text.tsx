import type { MentionMember } from "@/lib/mentions";
import { AGENT_MENTION_HANDLE, parseMentionText } from "@/lib/mentions";

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
          const isAgent = part.label === AGENT_MENTION_HANDLE;
          return (
            <span
              key={`m-${index}`}
              className={
                isAgent
                  ? "rounded bg-amber-100/90 px-1 py-0.5 font-semibold text-amber-950 ring-1 ring-amber-200/80"
                  : "rounded bg-paper-deep/90 px-1 py-0.5 font-semibold text-ink"
              }
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
