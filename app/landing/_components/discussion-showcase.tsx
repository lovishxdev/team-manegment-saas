"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FileText, GitBranch, Globe, UserPlus } from "lucide-react";
import { ClaudeIcon } from "@/components/brand/claude-icon";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";

type Surface = "web" | "whatsapp" | "claude";

const SURFACE: Record<Surface, { label: string; icon: React.ReactNode }> = {
  web: { label: "Web", icon: <Globe className="h-3 w-3 text-sky-600" /> },
  whatsapp: {
    label: "WhatsApp",
    icon: <WhatsAppIcon className="h-3 w-3 text-[#25D366]" />,
  },
  claude: { label: "Claude", icon: <ClaudeIcon className="h-3 w-3 text-claude" /> },
};

function SurfaceChip({ kind }: { kind: Surface }) {
  const m = SURFACE[kind];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-[9.5px] font-medium text-ink-soft">
      {m.icon}
      {m.label}
    </span>
  );
}

const POINTS = [
  {
    icon: GitBranch,
    title: "Nested threads",
    desc: "Focused sub-discussions branch off — not one endless channel.",
  },
  {
    icon: FileText,
    title: "Ask for a summary",
    desc: "An agent distills any thread from its full history plus project memory.",
  },
  {
    icon: UserPlus,
    title: "Instant onboarding",
    desc: "New teammates — and fresh AI sessions — catch up in a minute, not a week.",
  },
];

/**
 * A discussion where a new teammate drops into a long, nested thread and asks
 * an agent to catch them up. One calm "reading → summary" beat plays on scroll
 * (space reserved so nothing jumps), showing nesting, agent summaries, and
 * onboarding in a single moment.
 */
export function DiscussionShowcase() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (reduce) {
            setAnswered(true);
            return;
          }
          timer = setTimeout(() => setAnswered(true), 1800);
        } else {
          clearTimeout(timer);
          setAnswered(false);
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref}>
      <div className="mx-auto max-w-2xl">
        <div className="lp-disc-card overflow-hidden rounded-2xl border border-line bg-shell shadow-[0_30px_80px_-40px_rgba(20,20,30,0.25)]">
          <div className="flex items-center justify-between border-b border-line bg-paper/70 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold tracking-tight text-ink">
                Q3 auth &amp; beta
              </span>
              <span className="rounded-full bg-paper-deep px-2 py-0.5 font-mono text-[9.5px] text-ink-soft">
                24 messages · 3 threads
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
              Discussion
            </span>
          </div>

          <ul className="space-y-4 px-5 py-5">
            {/* Human · web */}
            <li className="flex gap-3">
              <Image
                src="/avatars/lina.jpg"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">Lina</span>
                  <SurfaceChip kind="web" />
                </div>
                <p className="mt-1 rounded-lg rounded-tl-sm bg-card px-3 py-2 text-[13px] leading-snug text-ink shadow-sm">
                  Are we still doing custom JWT for launch? I&apos;m nervous about
                  the timeline.
                </p>

                {/* Nested sub-thread */}
                <div className="mt-2 border-l-2 border-line pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-ink">
                      Aarav
                    </span>
                    <SurfaceChip kind="whatsapp" />
                  </div>
                  <p className="mt-1 rounded-lg rounded-tl-sm bg-card px-3 py-1.5 text-[12.5px] leading-snug text-ink shadow-sm">
                    We said we&apos;d revisit after the SDK spike.
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-ink-faint">
                    <GitBranch className="h-3 w-3" /> + 16 earlier replies
                  </span>
                </div>
              </div>
            </li>

            {/* New member joins */}
            <li className="flex gap-3">
              <Image
                src="/avatars/sam.jpg"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">Sam</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[9.5px] font-medium text-emerald-700">
                    <UserPlus className="h-3 w-3" /> just joined
                  </span>
                </div>
                <p className="mt-1 rounded-lg rounded-tl-sm bg-card px-3 py-2 text-[13px] leading-snug text-ink shadow-sm">
                  New here — can someone catch me up on where auth actually
                  landed?
                </p>
              </div>
            </li>

            {/* Agent · claude summarizes */}
            <li className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-claude/10 ring-1 ring-claude/20">
                <ClaudeIcon className="h-5 w-5 text-claude" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">
                    Claude Code
                  </span>
                  <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-mono text-[9.5px] font-medium text-ink-soft">
                    agent
                  </span>
                </div>

                <div className="lp-disc-agent mt-1">
                  {/* reading the thread + memory */}
                  <div className={`lp-disc-reading ${answered ? "is-done" : ""}`}>
                    <span className="inline-flex items-center gap-2 rounded-md bg-paper-deep px-2.5 py-1.5 font-mono text-[11px] text-ink-soft">
                      <span className="lp-disc-spin" aria-hidden />
                      reading 24 messages + project memory
                      <span className="lp-disc-dots" aria-hidden>
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                  </div>

                  {/* the summary */}
                  <div className={`lp-disc-answer ${answered ? "is-on" : ""}`}>
                    <div className="rounded-lg rounded-tl-sm border border-line bg-card px-3 py-2.5 shadow-sm">
                      <p className="text-[12.5px] font-semibold text-ink">
                        Here&apos;s where auth stands
                      </p>
                      <ul className="mt-2 space-y-1.5 text-[12.5px] leading-snug text-ink-soft">
                        <li className="flex gap-2">
                          <span className="mt-px shrink-0 rounded bg-violet-50 px-1.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-violet-700">
                            decided
                          </span>
                          <span>
                            Adopted <span className="text-ink">Supabase Auth</span>,
                            dropped custom JWT (Jul 3).
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-px shrink-0 rounded bg-amber-50 px-1.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                            open
                          </span>
                          <span>
                            RLS publication blocker · owner{" "}
                            <span className="text-ink">Priya</span>.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-px shrink-0 rounded bg-sky-50 px-1.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-sky-700">
                            next
                          </span>
                          <span>Clear the blocker before the beta cutoff.</span>
                        </li>
                      </ul>
                      <p className="mt-2.5 border-t border-line pt-2 font-mono text-[10px] text-ink-faint">
                        summarized 24 messages across 3 threads · 6 decisions
                        from memory
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Capability points */}
      <div className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-3">
        {POINTS.map((p) => (
          <div
            key={p.title}
            className="flex flex-col items-center text-center"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-paper text-ink shadow-sm">
              <p.icon className="h-4 w-4" />
            </span>
            <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-ink">
              {p.title}
            </h3>
            <p className="mt-1 max-w-[15rem] text-[13px] leading-relaxed text-ink-soft">
              {p.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
