"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Animated "WhatsApp magic" demo:
 *   1. User types a natural-language instruction (typing effect).
 *   2. Bot replies with a confirmation bubble.
 *   3. A task card materializes on the right pane.
 *   4. Loop after a beat.
 *
 * Everything is throttled with requestAnimationFrame timing so it stays
 * smooth on lower-end devices and pauses cleanly when the tab is hidden.
 */

type Scene = {
  user: string;
  reply: string;
  task: {
    chip: string;
    chipCls: string;
    title: string;
    assignee: { initial: string; cls: string };
    meta: string;
    priorityCls: string;
    priorityLabel: string;
  };
};

const SCENES: Scene[] = [
  {
    user: "add a task: design the hackathon landing page hero, assign aarav, high priority, due friday",
    reply:
      "Done. Added “Design the hackathon landing page hero” to In Progress, assigned Aarav, due Fri 18 Jun.",
    task: {
      chip: "design",
      chipCls: "bg-pink-100 text-pink-700",
      title: "Design the hackathon landing page hero",
      assignee: { initial: "A", cls: "bg-orange-100 text-orange-700" },
      meta: "due Fri 18 Jun · #48",
      priorityCls: "bg-rose-50 text-rose-700",
      priorityLabel: "HIGH",
    },
  },
  {
    user: "remind everyone the demo is at 6. add a task to record the walkthrough video tomorrow, assign me",
    reply:
      "Reminder sent to the group. Added “Record the walkthrough video” to To Do, assigned you, due tomorrow.",
    task: {
      chip: "general",
      chipCls: "bg-amber-100 text-amber-700",
      title: "Record the walkthrough video",
      assignee: { initial: "S", cls: "bg-teal-100 text-teal-700" },
      meta: "due tomorrow · #49",
      priorityCls: "bg-amber-50 text-amber-700",
      priorityLabel: "MEDIUM",
    },
  },
  {
    user: "📷 sent a photo, attach this to the booth setup task and mark it done",
    reply:
      "Got the photo. Attached to “Set up the booth banner” and moved it to Done. Nice work 👏",
    task: {
      chip: "ops",
      chipCls: "bg-violet-100 text-violet-700",
      title: "Set up the booth banner",
      assignee: { initial: "R", cls: "bg-violet-100 text-violet-700" },
      meta: "1 photo attached · #46",
      priorityCls: "bg-emerald-50 text-emerald-700",
      priorityLabel: "DONE",
    },
  },
];

type Phase = "typing" | "sent" | "replying" | "reply" | "settle";

const TYPE_INTERVAL_MS = 24;
const REPLY_INTERVAL_MS = 16;
const SETTLE_MS = 2200;

const PHONE_W_PX = 275;

export function WhatsAppDemo() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [reply, setReply] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [taskVisible, setTaskVisible] = useState(false);
  const timers = useRef<number[]>([]);

  const scene = useMemo(() => SCENES[sceneIdx], [sceneIdx]);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setTyped("");
    setReply("");
    setTaskVisible(false);
    setPhase("typing");

    let cancelled = false;

    const run = async () => {
      // 1. Type the user message
      for (let i = 1; i <= scene.user.length; i++) {
        if (cancelled) return;
        await wait(TYPE_INTERVAL_MS);
        setTyped(scene.user.slice(0, i));
      }
      if (cancelled) return;

      await wait(360);
      setPhase("sent");

      await wait(520);
      setPhase("replying"); // shows "typing…" indicator

      await wait(1100);
      // 2. Show task card materialize ~halfway through the reply
      setTaskVisible(true);

      // 3. Stream the reply text
      for (let i = 1; i <= scene.reply.length; i++) {
        if (cancelled) return;
        await wait(REPLY_INTERVAL_MS);
        setReply(scene.reply.slice(0, i));
      }
      setPhase("reply");
      if (cancelled) return;

      await wait(SETTLE_MS);
      setPhase("settle");
      setSceneIdx((idx) => (idx + 1) % SCENES.length);
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
    }
  }, [sceneIdx, scene]);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[auto_1fr] lg:gap-10">
      {/* ---------- Phone / WhatsApp chat ---------- */}
      {/* Fixed phone width at every breakpoint — never stretches with the grid */}
      <div
        className="relative mx-auto shrink-0 lg:mx-0"
        style={{ width: `${PHONE_W_PX}px`, maxWidth: "calc(100% - 1.25rem)" }}
      >
        {/* iPhone-style frame — slim bezels */}
        <div className="relative w-full rounded-[2rem] border-[1.5px] border-[#141414] bg-[#141414] p-[5px] shadow-[0_28px_70px_-28px_rgba(20,20,30,0.5)]">
          {/* Dynamic Island */}
          <div className="absolute left-1/2 top-[7px] z-10 h-[20px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
          <div className="flex h-[468px] flex-col overflow-hidden rounded-[1.55rem] bg-[#ECE5DD]">
            {/* WhatsApp header */}
            <div className="lp-wa-gradient flex shrink-0 items-center gap-2.5 px-3.5 pb-2.5 pt-8">
              <Image
                src="/euclis-logo-64.webp"
                alt="Euclis"
                width={32}
                height={32}
                loading="lazy"
                className="h-8 w-8 shrink-0 rounded-full bg-white object-cover ring-1 ring-white/30"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold leading-tight text-white">
                  Euclis
                </p>
                <p className="flex items-center gap-1 text-[9.5px] text-emerald-50/85">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-200" />
                  <span className="truncate">online · &lt; 2s</span>
                </p>
              </div>
              <svg
                viewBox="0 0 20 20"
                className="h-3.5 w-3.5 shrink-0 text-white/80"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden
              >
                <path d="M15 4l-1.4 1.4M15 4v3M15 4h-3M5 16l1.4-1.4M5 16v-3M5 16h3" />
              </svg>
            </div>

            {/* Chat area — fixed flex slice; messages pinned to bottom */}
            <div
              className="relative min-h-0 flex-1 shrink-0 overflow-hidden px-2.5"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M20 4l2 12 12 2-12 2-2 12-2-12-12-2 12-2z' fill='%23000' opacity='0.025'/></svg>\")",
              }}
            >
              <div className="absolute inset-x-2.5 bottom-0 top-0 flex flex-col justify-end gap-1.5 pb-3">
                {/* Date separator */}
                <div className="mx-auto mb-0.5 shrink-0 rounded-md bg-white/85 px-2 py-0.5 text-[9px] font-medium text-ink-soft shadow-sm">
                  TODAY
                </div>

                {/* User bubble — min height so empty/typing states don't collapse the frame */}
                <div className="ml-auto min-h-[2.75rem] max-w-[88%] shrink-0 rounded-2xl rounded-tr-[5px] bg-[#DCF8C6] px-2.5 py-1.5 text-[12px] leading-snug text-ink shadow-sm">
                  <span className="block min-h-[1.125rem]">
                    {typed}
                    {phase === "typing" && <span className="lp-caret" />}
                  </span>
                  <div className="mt-0.5 flex min-h-[0.875rem] items-center justify-end gap-1 text-[9px] text-ink-soft">
                    <Now />
                    <DoubleCheck delivered={phase !== "typing"} read={phase !== "typing" && phase !== "sent"} />
                  </div>
                </div>

                {/* "typing…" indicator — reserved slot height */}
                <div
                  className={`mr-auto shrink-0 transition-opacity duration-200 ${
                    phase === "replying" && !reply
                      ? "opacity-100"
                      : "pointer-events-none min-h-0 opacity-0"
                  }`}
                  aria-hidden={phase !== "replying" || !!reply}
                >
                  <div className="lp-bubble flex max-w-[55%] items-center gap-1 rounded-2xl rounded-tl-[5px] bg-white px-2.5 py-2 shadow-sm">
                    <Dot delay={0} />
                    <Dot delay={150} />
                    <Dot delay={300} />
                  </div>
                </div>

                {/* Bot reply bubble — min height while reply streams in */}
                <div
                  className={`mr-auto max-w-[90%] shrink-0 transition-opacity duration-200 ${
                    (phase === "replying" || phase === "reply" || phase === "settle") && reply
                      ? "opacity-100"
                      : "pointer-events-none min-h-0 opacity-0"
                  }`}
                  aria-hidden={!reply}
                >
                  <div className="lp-bubble min-h-[2.75rem] rounded-2xl rounded-tl-[5px] bg-white px-2.5 py-1.5 text-[12px] leading-snug text-ink shadow-sm">
                    <span className="block min-h-[1.125rem]">
                      {reply}
                      {phase === "replying" && reply.length < scene.reply.length && (
                        <span className="lp-caret" />
                      )}
                    </span>
                    <div className="mt-0.5 min-h-[0.875rem] text-right text-[9px] text-ink-soft">
                      <Now />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp input strip */}
            <div className="flex shrink-0 items-center gap-1.5 border-t border-black/5 bg-[#F0F0F0] px-2.5 py-1.5">
              <div className="flex flex-1 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] text-ink-faint shadow-sm">
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="10" cy="10" r="7" />
                  <path d="M7.5 8.5h.01M12.5 8.5h.01M7 12.5c1 .8 4 .8 6 0" strokeLinecap="round" />
                </svg>
                <span className="truncate">Message Euclis…</span>
              </div>
              <button
                type="button"
                aria-label="send"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#128C7E] text-white shadow-sm"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                  <path d="M2.4 9.3l14.2-5.9c.7-.3 1.4.4 1.1 1.1l-5.9 14.2c-.3.7-1.3.7-1.6 0L8 12l-5.6-1.1c-.8-.2-.8-1.3 0-1.6z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Floating "what just happened" badge */}
        <div className="lp-float-slow pointer-events-none absolute -right-2 top-20 z-20 hidden max-w-[11rem] rounded-xl border border-line bg-paper/95 px-2.5 py-1.5 text-[10px] shadow-lg backdrop-blur-md sm:block">
          <div className="flex items-center gap-2">
            <span className="lp-pulse" />
            <span className="font-medium text-ink">Understood your message</span>
          </div>
          <p className="mt-0.5 font-mono text-[9.5px] text-ink-faint">
            new task · design · high priority
          </p>
        </div>
      </div>

      {/* ---------- Right pane: live task card ---------- */}
      <div className="relative">
        <div className="rounded-2xl border border-line bg-paper/85 p-4 shadow-sm backdrop-blur-md sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="lp-pulse" />
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Live · workspace board
            </span>
          </div>

          <div className="-mx-1 overflow-x-auto pb-1 lg:mx-0 lg:overflow-visible">
            <div className="flex w-max gap-2 lg:grid lg:w-full lg:grid-cols-3 lg:gap-2.5">
            <Column label="To Do" dot="bg-rose-500" tint="bg-rose-50/70" className="w-[9.25rem] shrink-0 lg:w-auto">
              <Skeleton />
              <TaskSlot show={sceneIdx === 1 && taskVisible}>
                <TaskMini task={scene.task} />
              </TaskSlot>
            </Column>
            <Column label="In Progress" dot="bg-orange-500" tint="bg-orange-50/70" className="w-[9.25rem] shrink-0 lg:w-auto">
              <Skeleton dim />
              <TaskSlot show={sceneIdx === 0 && taskVisible}>
                <TaskMini task={scene.task} />
              </TaskSlot>
            </Column>
            <Column label="Done" dot="bg-violet-500" tint="bg-violet-50/70" className="w-[9.25rem] shrink-0 lg:w-auto">
              <Skeleton />
              <TaskSlot show={sceneIdx === 2 && taskVisible}>
                <TaskMini task={scene.task} />
              </TaskSlot>
            </Column>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-dashed border-line-strong/60 bg-card-high/60 px-3 py-2.5 text-[11px] leading-snug text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:py-2 sm:text-[11.5px]">
            <span className="min-w-0">
              {phase === "typing" || phase === "sent"
                ? "Listening for your next message…"
                : phase === "replying"
                  ? "Updating the board…"
                  : "✓ Board updated for everyone, instantly."}
            </span>
            <span className="font-mono text-[10px] text-ink-faint">
              {sceneIdx + 1} / {SCENES.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Locale-dependent clock display that renders an empty placeholder on SSR
 * and fills in the formatted time after the client mounts. Avoids the
 * hydration mismatch you'd get from rendering `toLocaleTimeString` on both
 * the server and the client (different locales / am-PM casing).
 */
function Now() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    setLabel(fmt());
    const id = window.setInterval(() => setLabel(fmt()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Reserve roughly the right width during SSR so layout doesn't jump on
  // hydrate. `suppressHydrationWarning` ensures the initial empty render
  // doesn't trip React when the client immediately fills it in.
  return (
    <span suppressHydrationWarning style={{ minWidth: "2.6em", display: "inline-block" }}>
      {label}
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-ink-faint"
      style={{
        animation: "lp-blink 1.05s ease-in-out infinite",
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

function DoubleCheck({ delivered, read }: { delivered: boolean; read: boolean }) {
  if (!delivered) return null;
  return (
    <svg viewBox="0 0 18 12" className="h-3 w-4" fill="none" aria-hidden>
      <path
        d="M1 6.5l3.2 3.2L11 3"
        stroke={read ? "#34B7F1" : "#9CA3AF"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 6.5l3.2 3.2L16 3"
        stroke={read ? "#34B7F1" : "#9CA3AF"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Column({
  label,
  dot,
  tint,
  className = "",
  children,
}: {
  label: string;
  dot: string;
  tint: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex h-full min-w-0 flex-col rounded-lg p-2 ${tint} ${className}`}>
      <div className="mb-2 flex min-w-0 items-center gap-1.5 px-1">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <span className="truncate font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink">
          {label}
        </span>
      </div>
      <div className="flex min-h-[9rem] flex-1 flex-col gap-1.5">{children}</div>
    </div>
  );
}

/** Fixed-height slot so task cards pop in without shifting the board layout. */
function TaskSlot({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[5.25rem]">
      <div
        className={`transition-opacity duration-300 ${
          show ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!show}
      >
        {children}
      </div>
    </div>
  );
}

function Skeleton({ dim = false }: { dim?: boolean }) {
  return (
    <div className={`rounded-md border border-line/80 bg-white/85 p-2 ${dim ? "opacity-70" : ""}`}>
      <div className="h-2 w-12 rounded-sm bg-paper-deep" />
      <div className="mt-2 h-2.5 w-full rounded-sm bg-paper-deep/80" />
      <div className="mt-1.5 h-2.5 w-3/4 rounded-sm bg-paper-deep/60" />
    </div>
  );
}

function TaskMini({ task }: { task: Scene["task"] }) {
  return (
    <div className="lp-card-pop rounded-md border border-line bg-card p-2 shadow-sm">
      <div className="flex min-w-0 items-start gap-1">
        <span
          className={`max-w-[58%] truncate rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-wide ${task.chipCls}`}
        >
          {task.chip}
        </span>
        <span
          className={`ml-auto shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide ${task.priorityCls}`}
        >
          {task.priorityLabel}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-snug text-ink">
        {task.title}
      </p>
      <div className="mt-1.5 flex items-start justify-between gap-1.5">
        <span
          className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8.5px] font-semibold ${task.assignee.cls}`}
        >
          {task.assignee.initial}
        </span>
        <span className="min-w-0 flex-1 text-right font-mono text-[8px] leading-tight text-ink-faint">
          {task.meta}
        </span>
      </div>
    </div>
  );
}
