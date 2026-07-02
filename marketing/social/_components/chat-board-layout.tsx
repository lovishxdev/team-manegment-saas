import type { ReactNode } from "react";

/** Fixed-width iPhone-style frame for WhatsApp / Claude chat demos. */
export function MobilePhoneFrame({
  children,
  shellClassName = "bg-[#141414]",
  innerClassName = "",
}: {
  children: ReactNode;
  shellClassName?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className="relative mx-auto shrink-0"
      style={{ width: 300, maxWidth: "calc(100vw - 2rem)" }}
    >
      <div
        className={`relative rounded-[2.35rem] border-2 border-[#141414] p-[5px] shadow-[0_28px_70px_-28px_rgba(20,20,30,0.45)] ${shellClassName}`}
      >
        <div className="absolute left-1/2 top-[8px] z-10 h-[20px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
        <div
          className={`flex h-[min(68vh,620px)] flex-col overflow-hidden rounded-[1.9rem] ${innerClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Phone + fixed-width kanban — centered; board does not grow with leftover space. */
export function ChatBoardSplitLayout({
  caption,
  phone,
  kanban,
}: {
  caption?: ReactNode;
  phone: ReactNode;
  kanban: ReactNode;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-[clamp(1rem,3vw,2.5rem)] pb-[clamp(1.25rem,3.5vh,2.5rem)] pt-[clamp(4rem,10vh,6.5rem)]">
      {caption}

      <div className="flex flex-1 items-center justify-center gap-[clamp(1.25rem,2.5vw,2rem)]">
        <div className="relative shrink-0">{phone}</div>
        {kanban}
      </div>
    </div>
  );
}

/** Kanban width cap — same size whether chat is phone-narrow or not. */
export const KANBAN_DEMO_CLASS =
  "h-[min(68vh,620px)] w-[min(680px,52vw)] max-w-[680px] shrink-0 flex-none";
