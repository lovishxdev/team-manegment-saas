"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatBoardSplitLayout,
  KANBAN_DEMO_CLASS,
  MobilePhoneFrame,
} from "@/marketing/social/_components/chat-board-layout";
import {
  KanbanPanel,
  type KanbanTask,
} from "@/marketing/social/_components/kanban-panel";
import { RecordCanvas } from "@/marketing/social/_components/record-canvas";

type Scene = {
  user: string;
  reply: string;
  caption?: string;
  footer?: string;
  column: "todo" | "doing" | "done";
  task: KanbanTask;
};

const SCENES: Scene[] = [
  {
    user: "add task: fix login API, assign me, due tonight",
    reply:
      "Done. Added “Fix login API” to To Do, assigned you, due tonight · #12",
    caption: "Teams start in WhatsApp",
    column: "todo",
    task: {
      id: "12",
      chip: "backend",
      chipCls: "bg-orange-100 text-orange-700",
      title: "Fix login API",
      assignee: { initial: "L", cls: "bg-blue-100 text-blue-700" },
      meta: "due tonight · #12",
      priorityCls: "bg-amber-50 text-amber-700",
      priorityLabel: "MEDIUM",
    },
  },
  {
    user: "add task: record demo video for reddit post tomorrow",
    reply:
      "Added “Record demo video for Reddit post” to To Do, assigned you, due tomorrow · #13",
    caption: "Same board · Real-time sync",
    column: "todo",
    task: {
      id: "13",
      chip: "marketing",
      chipCls: "bg-pink-100 text-pink-700",
      title: "Record demo video for Reddit post",
      assignee: { initial: "L", cls: "bg-blue-100 text-blue-700" },
      meta: "due tomorrow · #13",
      priorityCls: "bg-amber-50 text-amber-700",
      priorityLabel: "MEDIUM",
    },
  },
  {
    user: "move #12 to done",
    reply: "Moved “Fix login API” (#12) to Done. Nice work.",
    caption: "Web · WhatsApp · Claude · one truth",
    footer: "euclis.dev · Completely free · no credit card",
    column: "done",
    task: {
      id: "12-done",
      chip: "backend",
      chipCls: "bg-orange-100 text-orange-700",
      title: "Fix login API",
      assignee: { initial: "L", cls: "bg-blue-100 text-blue-700" },
      meta: "completed · #12",
      priorityCls: "bg-emerald-50 text-emerald-700",
      priorityLabel: "DONE",
    },
  },
];

type Phase = "hook" | "typing" | "sent" | "replying" | "reply" | "settle";

const TYPE_MS = 28;
const REPLY_MS = 14;
const HOOK_MS = 2400;
const SETTLE_MS = 2800;

export function WhatsAppRecordingDemo() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("hook");
  const [typed, setTyped] = useState("");
  const [reply, setReply] = useState("");
  const [taskVisible, setTaskVisible] = useState(false);
  const [accumulatedTasks, setAccumulatedTasks] = useState<{
    todo: KanbanTask[];
    doing: KanbanTask[];
    done: KanbanTask[];
  }>({ todo: [], doing: [], done: [] });
  const timers = useRef<number[]>([]);

  const scene = useMemo(() => SCENES[sceneIdx], [sceneIdx]);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setTyped("");
    setReply("");
    setTaskVisible(false);
    setPhase("hook");

    let cancelled = false;

    const run = async () => {
      await wait(HOOK_MS);
      if (cancelled) return;
      setPhase("typing");

      for (let i = 1; i <= scene.user.length; i++) {
        if (cancelled) return;
        await wait(TYPE_MS);
        setTyped(scene.user.slice(0, i));
      }
      if (cancelled) return;

      await wait(400);
      setPhase("sent");

      await wait(600);
      setPhase("replying");

      await wait(900);
      setTaskVisible(true);

      if (sceneIdx === 2) {
        setAccumulatedTasks((prev) => ({
          todo: prev.todo,
          doing: prev.doing.filter((t) => t.id !== "12"),
          done: [...prev.done, scene.task],
        }));
      } else {
        setAccumulatedTasks((prev) => ({
          ...prev,
          [scene.column]: [...prev[scene.column], scene.task],
        }));
      }

      await wait(300);

      for (let i = 1; i <= scene.reply.length; i++) {
        if (cancelled) return;
        await wait(REPLY_MS);
        setReply(scene.reply.slice(0, i));
      }
      setPhase("reply");
      if (cancelled) return;

      await wait(SETTLE_MS);
      setPhase("settle");
      setSceneIdx((idx) => {
        const next = (idx + 1) % SCENES.length;
        if (next === 0) {
          setAccumulatedTasks({ todo: [], doing: [], done: [] });
        }
        return next;
      });
    };

    void run();

    return () => {
      cancelled = true;
      timers.current.forEach((t) => window.clearTimeout(t));
    };

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms);
        timers.current.push(id);
      });
    };
  }, [sceneIdx, scene, scene.column]);

  const boardTasks = accumulatedTasks;

  const showCaption = phase === "hook" || phase === "settle" ? scene.caption : undefined;
  const showFooter = phase === "settle" ? scene.footer : undefined;

  return (
    <RecordCanvas caption={showCaption} footer={showFooter}>
      <ChatBoardSplitLayout
        phone={
          <PhoneChat typed={typed} reply={reply} phase={phase} scene={scene} />
        }
        kanban={
          <KanbanPanel
            className={KANBAN_DEMO_CLASS}
            tasksByColumn={boardTasks}
            statusText={
              phase === "typing" || phase === "sent"
                ? "Listening…"
                : phase === "replying"
                  ? "Updating board…"
                  : "✓ Synced for everyone"
            }
            pulse={phase === "replying" || phase === "reply"}
          />
        }
      />
    </RecordCanvas>
  );
}

function PhoneChat({
  typed,
  reply,
  phase,
  scene,
}: {
  typed: string;
  reply: string;
  phase: Phase;
  scene: Scene;
}) {
  return (
    <div className="relative">
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

        <div
          className="relative min-h-0 flex-1 overflow-hidden px-2.5"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M20 4l2 12 12 2-12 2-2 12-2-12-12-2 12-2z' fill='%23000' opacity='0.025'/></svg>\")",
          }}
        >
          <div className="absolute inset-x-2.5 bottom-0 top-0 flex flex-col justify-end gap-1.5 pb-3">
            <div className="mx-auto mb-0.5 rounded-md bg-white/90 px-2 py-0.5 text-[9px] font-medium text-[#6b7280] shadow-sm">
              TODAY · private chat
            </div>

            {phase !== "hook" ? (
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-[#DCF8C6] px-2.5 py-1.5 text-[12px] leading-snug text-[#1a1a1a] shadow-sm">
                <span>
                  {typed}
                  {phase === "typing" ? <span className="mkt-caret" /> : null}
                </span>
              </div>
            ) : null}

            {phase === "replying" && !reply ? (
              <div className="mr-auto max-w-[55%]">
                <div className="mkt-bubble flex items-center gap-1 rounded-2xl rounded-tl-md bg-white px-2.5 py-2 shadow-sm">
                  <TypingDot delay={0} />
                  <TypingDot delay={150} />
                  <TypingDot delay={300} />
                </div>
              </div>
            ) : null}

            {reply ? (
              <div className="mr-auto max-w-[92%]">
                <div className="mkt-bubble rounded-2xl rounded-tl-md bg-white px-2.5 py-1.5 text-[12px] leading-snug text-[#1a1a1a] shadow-sm">
                  <span>
                    {reply}
                    {phase === "replying" && reply.length < scene.reply.length ? (
                      <span className="mkt-caret" />
                    ) : null}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 border-t border-black/5 bg-[#F0F0F0] px-2.5 py-1.5">
          <div className="flex flex-1 items-center rounded-full bg-white px-2.5 py-1.5 text-[11px] text-[#9ca3af] shadow-sm">
            Message Euclis…
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#128C7E] text-white">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M2.4 9.3l14.2-5.9c.7-.3 1.4.4 1.1 1.1l-5.9 14.2c-.3.7-1.3.7-1.6 0L8 12l-5.6-1.1c-.8-.2-.8-1.3 0-1.6z" />
            </svg>
          </div>
        </div>
      </MobilePhoneFrame>

      <div className="pointer-events-none absolute -right-3 top-[14%] rounded-lg border border-[#e5e7eb] bg-white/95 px-2.5 py-1.5 text-[10px] shadow-lg">
        <p className="font-semibold text-[#1a1a1a]">Not a group bot</p>
        <p className="text-[#6b7280]">1:1 DM → board</p>
      </div>
    </div>
  );
}

function TypingDot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full bg-[#9ca3af]"
      style={{
        animation: "mkt-blink 1.05s ease-in-out infinite",
        animationDelay: `${delay}ms`,
      }}
    />
  );
}
