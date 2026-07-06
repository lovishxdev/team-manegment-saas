"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { ui } from "@/components/ui/ui";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  links?: { href: string; label: string }[];
};

export function AppChatFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi — I can look up tasks, memory, and help you find your way around Euclis. What do you need?",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, pending]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    setInput("");
    setPending(true);

    try {
      const response = await fetch("/api/app-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathname,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("request failed");
      }

      const data = (await response.json()) as {
        reply: string;
        links?: { href: string; label: string }[];
      };

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply,
          links: data.links,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Something went wrong — please try again.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void send();
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[48] bg-black/20 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-none"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <div className="fixed bottom-5 right-5 z-[49] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {open ? (
          <div
            className="flex h-[min(32rem,calc(100dvh-6rem))] w-[min(100vw-2.5rem,24rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_80px_rgba(26,26,26,0.2)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Euclis assistant"
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/euclis-logo.png"
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-md"
                />
                <div>
                  <p className="text-sm font-semibold text-ink">Euclis</p>
                  <p className="text-[11px] text-ink-faint">Ask or navigate</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-ink-faint transition hover:bg-paper-deep/80 hover:text-ink"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </header>

            <div
              ref={listRef}
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
            >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "bg-ink text-white"
                        : "border border-line/80 bg-paper text-ink"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.links && message.links.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center rounded-md border border-line-strong bg-paper px-2 py-1 text-xs font-medium text-ink-soft transition hover:text-ink"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {pending ? (
                <p className="text-xs text-ink-faint">Thinking…</p>
              ) : null}
            </div>

            <form
              onSubmit={onSubmit}
              className="border-t border-line p-3"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  rows={1}
                  placeholder="Ask about tasks or where to go…"
                  disabled={pending}
                  className={`${ui.input} max-h-28 min-h-[2.75rem] resize-none py-2.5 text-sm`}
                />
                <button
                  type="submit"
                  disabled={pending || !input.trim()}
                  className={`${ui.btnPrimary} inline-flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center p-0`}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_8px_28px_rgba(26,26,26,0.28)] transition hover:bg-ink/90 hover:shadow-[0_12px_32px_rgba(26,26,26,0.32)]"
          aria-label={open ? "Close assistant" : "Open assistant"}
          aria-expanded={open}
        >
          {open ? (
            <X className="h-5 w-5" strokeWidth={1.75} />
          ) : (
            <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>
      </div>
    </>
  );
}
