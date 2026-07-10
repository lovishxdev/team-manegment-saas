"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { ui } from "@/components/ui/ui";
import { ClaudeIcon } from "@/components/brand/claude-icon";
import { CursorIcon } from "@/components/brand/cursor-icon";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { WorkspaceMemoryStage } from "./workspace-memory-stage";

type Chapter = {
  eyebrow: string | null;
  title: ReactNode;
  body: ReactNode;
  hero?: boolean;
  /** Supporting chips shown on the right of the anchor. */
  right?: string[];
};

const CHAPTERS: Chapter[] = [
  {
    hero: true,
    eyebrow: null,
    title: (
      <>
        The project brain for your team{" "}
        <span className="italic font-medium">— and your AI agents.</span>
      </>
    ),
    body: "Euclis remembers every decision, blocker, and milestone — captured automatically from the places work already happens.",
  },
  {
    eyebrow: "The problem",
    title: "Context shouldn't live in scrollback.",
    body: "Decisions get buried in chat. New teammates — and new AI sessions — start from zero.",
    right: ["endless threads", "lost decisions", "re-explaining context"],
  },
  {
    eyebrow: "Capture",
    title: "Captured from every surface.",
    body: "WhatsApp, Claude, Cursor, the web. Euclis listens where you already work — you write nothing down twice.",
    right: ["WhatsApp", "Claude", "Cursor", "Web"],
  },
  {
    eyebrow: "Structure",
    title: "Turned into structured memory.",
    body: "Decisions, blockers, dependencies, milestones — linked, deduped, kept current. Even superseded calls stay answerable.",
    right: ["decisions", "blockers", "dependencies", "milestones"],
  },
  {
    eyebrow: "Shared",
    title: "One context for humans and agents.",
    body: "Your team and your coding agents pull the same brief. Call get_project_context — everyone's aligned.",
    right: ["get_project_context", "ambient brief", "no re-reading scrollback"],
  },
];

/** Fraction of total progress over which the hero->pinned transition completes. */
const PIN_FRACTION = 0.14;

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}

type SrcKey = "whatsapp" | "cursor" | "claudecode" | "web";

const SRC_META: Record<SrcKey, { label: string; icon: (cls: string) => ReactNode }> = {
  whatsapp: { label: "WhatsApp", icon: (c) => <WhatsAppIcon className={`${c} text-[#25D366]`} /> },
  cursor: { label: "Cursor", icon: (c) => <CursorIcon className={c} /> },
  claudecode: { label: "Claude Code", icon: (c) => <ClaudeIcon className={`${c} text-claude`} /> },
  web: { label: "Web", icon: (c) => <Globe className={`${c} text-sky-600`} /> },
};

/** Fixed positions + the canonical source each box represents in the story. */
const SRC_POSITIONS: { cls: string; canonical: SrcKey }[] = [
  { cls: "pos-1", canonical: "whatsapp" },
  { cls: "pos-2", canonical: "cursor" },
  { cls: "pos-3", canonical: "claudecode" },
  { cls: "pos-4", canonical: "web" },
];

const SRC_KEYS: SrcKey[] = ["whatsapp", "cursor", "claudecode", "web"];

export function ScrollStory() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [chapter, setChapter] = useState(0);
  // Which logo shows in each square during the hero peek-a-boo.
  const [heroIcons, setHeroIcons] = useState<SrcKey[]>(SRC_KEYS);

  // Swap a box's logo only when its peek cycle completes (i.e. it's hidden
  // behind the frame), so the logo never changes while it's visible.
  const swapHeroIcon = (index: number) => {
    setHeroIcons((prev) => {
      const current = prev[index];
      const choices = SRC_KEYS.filter((k) => k !== current);
      const next = [...prev];
      next[index] = choices[Math.floor(Math.random() * choices.length)];
      return next;
    });
  };

  // Decide whether to run the pinned experience (wide viewport, motion allowed).
  // Re-evaluated on resize so widening the window activates it.
  useEffect(() => {
    const evaluate = () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      setEnhanced(window.innerWidth >= 900 && !reduce);
    };
    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, []);

  // Scroll-driven progress — only while the pinned experience is active.
  useEffect(() => {
    if (!enhanced) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    let raf = 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const total = section.offsetHeight - window.innerHeight;
      const p =
        total > 0
          ? clamp(-section.getBoundingClientRect().top / total, 0, 1)
          : 0;
      const pin = clamp(p / PIN_FRACTION, 0, 1);
      stage.style.setProperty("--p", p.toFixed(4));
      stage.style.setProperty("--pin", pin.toFixed(4));
      const ch = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length));
      setChapter((prev) => (prev === ch ? prev : ch));
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        raf = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [enhanced]);

  // Stacked fallback (mobile / reduced-motion): a normal hero + stacked beats.
  if (!enhanced) {
    return (
      <section ref={sectionRef} className="lp-story-fallback">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-8 sm:pt-36">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-serif text-[2.6rem] leading-[1.03] tracking-tight text-ink sm:text-[3.4rem]">
              {CHAPTERS[0].title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
              {CHAPTERS[0].body}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className={`px-6 py-3.5 text-[15px] ${ui.btnPrimary}`}>
                Start free →
              </Link>
              <Link href="/pricing" className={`px-6 py-3.5 text-[15px] ${ui.btnSecondary}`}>
                See plans
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-2xl">
            <WorkspaceMemoryStage chapter={4} />
          </div>

          <div className="mx-auto mt-16 max-w-2xl space-y-12">
            {CHAPTERS.slice(1).map((c) => (
              <div key={c.eyebrow} className="lp-reveal">
                {c.eyebrow ? (
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                    {c.eyebrow}
                  </p>
                ) : null}
                <h2 className="mt-2 font-serif text-[1.8rem] leading-[1.1] tracking-tight text-ink sm:text-[2.2rem]">
                  {c.title}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Pinned scroll-story (desktop).
  return (
    <section
      ref={sectionRef}
      className="lp-story"
      style={{ height: `calc(100svh * ${CHAPTERS.length + 0.5})` }}
    >
      <div ref={stageRef} className="lp-story-sticky" data-enhanced>
        <div className="lp-story-bg" aria-hidden />

        <div className="lp-story-wrap">
          {/* LEFT copy column */}
          <div className="lp-story-copy">
            {CHAPTERS.map((c, i) => (
              <div
                key={i}
                className={`lp-story-panel ${i === chapter ? "is-active" : ""}`}
                aria-hidden={i !== chapter}
              >
                {c.eyebrow ? (
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                    {c.eyebrow}
                  </p>
                ) : null}
                <h2
                  className={`tracking-tight text-ink ${
                    c.hero
                      ? "font-serif text-[clamp(2.75rem,5vw,4.5rem)] leading-[1.02]"
                      : "mt-2 font-serif text-[clamp(2.2rem,3.6vw,3.2rem)] leading-[1.08] [text-wrap:balance]"
                  }`}
                >
                  {c.title}
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft xl:text-[16px]">
                  {c.body}
                </p>
                {c.hero ? (
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Link
                      href="/signup"
                      className={`lp-shimmer px-6 py-3.5 text-[15px] ${ui.btnPrimary}`}
                    >
                      Start free →
                    </Link>
                    <Link
                      href="/pricing"
                      className={`px-6 py-3.5 text-[15px] ${ui.btnSecondary}`}
                    >
                      See plans
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* ANCHOR — the story-telling UI element */}
          <div className="lp-story-anchor">
            <WorkspaceMemoryStage chapter={chapter} />

            {/* Capture beat: real sources fly in around the frame and stay.
                In the hero (chapter 0) they play peek-a-boo behind the frame. */}
            <div
              className={`lp-src-cloud ${
                chapter >= 2 ? "is-on" : chapter === 0 ? "is-hero" : ""
              }`}
              aria-hidden
            >
              {SRC_POSITIONS.map((p, i) => {
                const key = chapter === 0 ? heroIcons[i] : p.canonical;
                const meta = SRC_META[key];
                return (
                  <span
                    key={p.cls}
                    className={`lp-src-pill ${p.cls}`}
                    title={meta.label}
                    onAnimationIteration={
                      chapter === 0 ? () => swapHeroIcon(i) : undefined
                    }
                  >
                    {meta.icon("h-7 w-7")}
                  </span>
                );
              })}
            </div>

            {/* Shared beat: an agent pulls the same memory */}
            <div
              className={`lp-agent-cameo ${chapter === 4 ? "is-on" : ""}`}
              aria-hidden
            >
              <div className="lp-agent-cameo-head">
                <ClaudeIcon className="h-4 w-4 text-claude" />
                <span>Claude Code</span>
              </div>
              <code className="lp-agent-call">→ get_project_context()</code>
              <div className="lp-agent-res">
                <span className="lp-agent-check">✓</span>
                6 decisions · 1 open blocker loaded
              </div>
            </div>
          </div>
        </div>

        {/* progress dots */}
        <div className="lp-story-dots" aria-hidden>
          {CHAPTERS.map((_, i) => (
            <span key={i} className={i === chapter ? "is-active" : ""} />
          ))}
        </div>
      </div>
    </section>
  );
}
