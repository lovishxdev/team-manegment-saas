"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ChatBoardSplitLayout,
  KANBAN_DEMO_CLASS,
  MobilePhoneFrame,
} from "@/marketing/social/_components/chat-board-layout";
import {
  DemoSceneCaption,
  DemoSceneCaptionSlot,
} from "@/marketing/social/_components/demo-scene-caption";
import {
  KanbanPanel,
  type KanbanTask,
} from "@/marketing/social/_components/kanban-panel";

const USER = "add task: fix login API, assign me, due tonight";
const REPLY =
  "Done. Added “Fix login API” to To Do, assigned you, due tonight · #12";

const TASK: KanbanTask = {
  id: "12",
  chip: "backend",
  chipCls: "bg-orange-100 text-orange-700",
  title: "Fix login API",
  assignee: { initial: "L", cls: "bg-blue-100 text-blue-700" },
  meta: "due tonight · #12",
  priorityCls: "bg-amber-50 text-amber-700",
  priorityLabel: "MEDIUM",
};

type Phase = "typing" | "sent" | "replying" | "reply";

/** Single-play WhatsApp → kanban sync for the full demo reel. */
export function WhatsAppFullScene() {
  const [typed, setTyped] = useState("");
  const [reply, setReply] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [showTask, setShowTask] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setTyped("");
    setReply("");
    setPhase("typing");
    setShowTask(false);

    let cancelled = false;

    const run = async () => {
      for (let i = 1; i <= USER.length; i++) {
        if (cancelled) return;
        await wait(22);
        setTyped(USER.slice(0, i));
      }
      await wait(320);
      setPhase("sent");
      await wait(480);
      setPhase("replying");
      await wait(720);
      setShowTask(true);
      await wait(280);

      for (let i = 1; i <= REPLY.length; i++) {
        if (cancelled) return;
        await wait(11);
        setReply(REPLY.slice(0, i));
      }
      setPhase("reply");
    };

    void run();
    return () => {
      cancelled = true;
      timers.current.forEach((t) => window.clearTimeout(t));
    };

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        timers.current.push(window.setTimeout(resolve, ms));
      });
    }
  }, []);

  return (
    <ChatBoardSplitLayout
      caption={
        <DemoSceneCaptionSlot>
          <DemoSceneCaption>
            Manage tasks from WhatsApp
          </DemoSceneCaption>
        </DemoSceneCaptionSlot>
      }
      phone={
        <MobilePhoneFrame innerClassName="bg-[#ECE5DD]">
          <div className="mkt-wa-header flex shrink-0 items-center gap-2.5 px-3.5 pb-2.5 pt-8">
            <Image
              src="/euclis-logo.png"
              alt="Euclis"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full bg-white object-cover ring-1 ring-white/25"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-white">Euclis</p>
              <p className="text-[9.5px] text-white/75">online</p>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col justify-end gap-1.5 px-2.5 pb-3">
            <div className="mx-auto mb-0.5 rounded-md bg-white/90 px-2 py-0.5 text-[9px] font-medium text-[#6b7280]">
              TODAY · private chat
            </div>
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-[#DCF8C6] px-2.5 py-1.5 text-[12px] leading-snug text-[#1a1a1a] shadow-sm">
              {typed}
              {phase === "typing" ? <span className="mkt-caret" /> : null}
            </div>
            {phase === "replying" && !reply ? (
              <div className="mr-auto flex gap-1 rounded-2xl rounded-tl-md bg-white px-2.5 py-2 shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9ca3af]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9ca3af]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9ca3af]" />
              </div>
            ) : null}
            {reply ? (
              <div className="mr-auto max-w-[92%] rounded-2xl rounded-tl-md bg-white px-2.5 py-1.5 text-[12px] leading-snug text-[#1a1a1a] shadow-sm">
                {reply}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 border-t border-black/5 bg-[#F0F0F0] px-2.5 py-1.5">
            <div className="flex flex-1 items-center rounded-full bg-white px-2.5 py-1.5 text-[11px] text-[#9ca3af]">
              Message Euclis…
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#128C7E] text-white">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M2.4 9.3l14.2-5.9c.7-.3 1.4.4 1.1 1.1l-5.9 14.2c-.3.7-1.3.7-1.6 0L8 12l-5.6-1.1c-.8-.2-.8-1.3 0-1.6z" />
              </svg>
            </div>
          </div>
        </MobilePhoneFrame>
      }
      kanban={
        <KanbanPanel
          className={KANBAN_DEMO_CLASS}
          tasksByColumn={{
            todo: showTask ? [TASK] : [],
            doing: [],
            done: [],
          }}
          statusText={showTask ? "✓ Synced for everyone" : "Listening…"}
          pulse={phase === "replying"}
        />
      }
    />
  );
}
