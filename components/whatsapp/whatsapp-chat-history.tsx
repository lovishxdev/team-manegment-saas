import type { WhatsAppChatRow } from "@/lib/services/conversation";

function formatTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WhatsAppChatHistory({
  messages,
  className = "",
}: {
  messages: WhatsAppChatRow[];
  className?: string;
}) {
  if (messages.length === 0) {
    return (
      <p
        className={`rounded-lg border border-dashed border-line-strong bg-paper-deep/40 px-4 py-6 text-center text-sm text-ink-soft ${className}`}
      >
        No WhatsApp messages yet. Send{" "}
        <span className="font-medium text-ink">hi</span> to the bot to start.
      </p>
    );
  }

  return (
    <div
      className={`space-y-2 overflow-y-auto rounded-xl border border-line bg-[#ECE5DD]/60 p-3 ${className || "max-h-80"}`}
      aria-label="Recent WhatsApp messages"
    >
      {messages.map((msg, i) => {
        const isUser = msg.role === "user";
        return (
          <div
            key={`${msg.createdAt.toISOString()}-${i}`}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm ${
                isUser
                  ? "rounded-tr-sm bg-[#DCF8C6] text-ink"
                  : "rounded-tl-sm bg-white text-ink"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <p
                className={`mt-1 text-[10px] ${
                  isUser ? "text-ink-soft/80 text-right" : "text-ink-faint"
                }`}
              >
                {formatTime(msg.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
