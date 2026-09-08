"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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

/**
 * Mobile can't fit the two-column anchor (it would stack into a card far taller
 * than the viewport), so the mobile scroll story plays as one pinned panel that
 * fills, then flips: Discussion grows → Project memory forms → an agent reads.
 * No copy text — the card itself is the narrative.
 */
const MOBILE_STEPS: {
  view: "discussion" | "memory";
  chapter: number;
  cameo?: boolean;
}[] = [
  { view: "discussion", chapter: 0 },
  { view: "discussion", chapter: 2 },
  { view: "discussion", chapter: 3 },
  { view: "memory", chapter: 3 },
  { view: "memory", chapter: 4 },
  { view: "memory", chapter: 4, cameo: true },
];

type StoryMode = "static" | "mobile" | "desktop";

const WIDE_QUERY = "(min-width: 900px)";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function readStoryMode(): StoryMode {
  if (window.matchMedia(REDUCE_QUERY).matches) return "static";
  return window.matchMedia(WIDE_QUERY).matches ? "desktop" : "mobile";
}

function subscribeStoryMode(onChange: () => void) {
  const wide = window.matchMedia(WIDE_QUERY);
  const reduce = window.matchMedia(REDUCE_QUERY);
  wide.addEventListener("change", onChange);
  reduce.addEventListener("change", onChange);
  return () => {
    wide.removeEventListener("change", onChange);
    reduce.removeEventListener("change", onChange);
  };
}

function useStoryMode(): StoryMode {
  return useSyncExternalStore(subscribeStoryMode, readStoryMode, () => "desktop");
}

function HeroCtas({ size = "desktop" }: { size?: "desktop" | "mobile" }) {
  const pad = size === "mobile" ? "px-5 py-3" : "px-6 py-3.5";
  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${
        size === "mobile" ? "justify-center" : ""
      }`}
    >
      <Link href="/signup" className={`lp-shimmer text-[15px] ${pad} ${ui.btnPrimary}`}>
        Start free →
      </Link>
      <Link href="/pricing" className={`text-[15px] ${pad} ${ui.btnSecondary}`}>
        See plans
      </Link>
    </div>
  );
}

/**
 * Pre-hydration shell: paint desktop + mobile heroes and let CSS pick which is
 * visible. Avoids the desktop two-column layout flashing on phones (and the
 * inverse on desktop).
 */
function StoryBootShell() {
  return (
    <section className="relative min-h-[100svh]" aria-busy="true">
      <div className="lp-story-bg" aria-hidden />

      {/* Desktop (≥900px) */}
      <div className="max-[899px]:hidden motion-reduce:hidden">
        <div className="lp-story-sticky">
          <div className="lp-story-wrap">
            <div className="lp-story-copy">
              <div className="lp-story-panel is-active">
                <h2 className="font-serif text-[clamp(2.75rem,5vw,4.5rem)] leading-[1.02] tracking-tight text-ink">
                  {CHAPTERS[0].title}
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft xl:text-[16px]">
                  {CHAPTERS[0].body}
                </p>
                <div className="mt-8">
                  <HeroCtas />
                </div>
              </div>
            </div>
            <div className="lp-story-anchor">
              <WorkspaceMemoryStage chapter={0} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile (&lt;900px) */}
      <div className="min-[900px]:hidden motion-reduce:hidden">
        <div className="lp-story-m-sticky">
          <div className="lp-story-m-intro">
            <h1 className="font-serif text-[2.15rem] leading-[1.04] tracking-tight text-ink">
              {CHAPTERS[0].title}
            </h1>
            <div className="mt-5">
              <HeroCtas size="mobile" />
            </div>
          </div>
          <div className="lp-story-m-anchor">
            <WorkspaceMemoryStage
              chapter={0}
              view="discussion"
              variant="mobile"
            />
          </div>
        </div>
      </div>

      {/* Reduced motion */}
      <div className="mx-auto hidden max-w-6xl px-5 pb-16 pt-32 motion-reduce:block sm:px-8 sm:pt-36">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif text-[2.6rem] leading-[1.03] tracking-tight text-ink sm:text-[3.4rem]">
            {CHAPTERS[0].title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
            {CHAPTERS[0].body}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <HeroCtas size="mobile" />
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-2xl">
          <WorkspaceMemoryStage chapter={0} view="discussion" variant="mobile" />
        </div>
      </div>
    </section>
  );
}

export function ScrollStory() {
  // Stay on the CSS dual shell through SSR + hydration, then unlock the
  // interactive story once the real viewport mode is known.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mode = useStoryMode();
  const [chapter, setChapter] = useState(0);
  // Discrete step for the mobile panel-flip story (see MOBILE_STEPS).
  const [mStep, setMStep] = useState(0);
  // True only while the hero sits at the very top (before any untilt begins).
  // The peek-a-boo plays only here; once scrolling starts the frame untilts
  // and the squares must vanish so they never float over the moving frame.
  const [atTop, setAtTop] = useState(true);
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

  // Scroll-driven progress — only while a pinned experience is active.
  useEffect(() => {
    if (!ready || mode === "static") return;
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
      const ms = clamp(
        Math.floor(p * MOBILE_STEPS.length),
        0,
        MOBILE_STEPS.length - 1
      );
      setMStep((prev) => (prev === ms ? prev : ms));
      // "At top" = essentially unscrolled, before the untilt is perceptible.
      const top = p < 0.05;
      setAtTop((prev) => (prev === top ? prev : top));
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
  }, [ready, mode]);

  // Until the client knows the viewport, CSS picks the correct first paint.
  if (!ready) {
    return <StoryBootShell />;
  }

  // Stacked fallback (reduced-motion): a normal hero + stacked beats.
  if (mode === "static") {
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

  // Pinned panel-flip scroll-story (mobile / narrow viewports). No copy text —
  // just the anchor card telling the story as it fills and flips.
  if (mode === "mobile") {
    const step = MOBILE_STEPS[mStep];
    return (
      <section
        ref={sectionRef}
        className="lp-story-m"
        style={{ height: `calc(100svh * ${MOBILE_STEPS.length * 0.85})` }}
      >
        <div ref={stageRef} className="lp-story-m-sticky" data-enhanced>
          <div className="lp-story-bg" aria-hidden />

          <div className={`lp-story-m-intro ${mStep > 0 ? "is-gone" : ""}`}>
            <h1 className="font-serif text-[2.15rem] leading-[1.04] tracking-tight text-ink">
              {CHAPTERS[0].title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className={`lp-shimmer px-5 py-3 text-[15px] ${ui.btnPrimary}`}
              >
                Start free →
              </Link>
              <Link
                href="/pricing"
                className={`px-5 py-3 text-[15px] ${ui.btnSecondary}`}
              >
                See plans
              </Link>
            </div>
          </div>

          <div className="lp-story-m-anchor">
            <WorkspaceMemoryStage
              key={step.view}
              chapter={step.chapter}
              view={step.view}
              variant="mobile"
            />

            {/* Capture beat: sources tuck behind the card, then peek out from
                the top & bottom edges (more room than the sides) and stay. */}
            <div
              className={`lp-src-cloud lp-src-cloud--m ${
                mStep >= 1 ? "is-on" : ""
              }`}
              aria-hidden
            >
              {SRC_POSITIONS.map((p) => {
                const meta = SRC_META[p.canonical];
                return (
                  <span
                    key={p.cls}
                    className={`lp-src-pill ${p.cls}`}
                    title={meta.label}
                  >
                    {meta.icon("h-6 w-6")}
                  </span>
                );
              })}
            </div>

            {/* Shared beat: an agent pulls the same memory */}
            <div
              className={`lp-agent-cameo ${step.cameo ? "is-on" : ""}`}
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

          <div className="lp-story-progress" aria-hidden>
            <span
              className="lp-story-progress-fill"
              style={{
                height: `${(mStep / Math.max(1, MOBILE_STEPS.length - 1)) * 100}%`,
              }}
            />
            {MOBILE_STEPS.map((_, i) => (
              <i
                key={i}
                className={`${i === mStep ? "is-active" : ""} ${
                  i < mStep ? "is-complete" : ""
                }`}
              />
            ))}
          </div>

          <div
            className={`lp-story-scroll-hint ${atTop ? "is-visible" : ""}`}
            aria-hidden
          >
            <span>Scroll to explore</span>
            <i>↓</i>
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
                chapter >= 2
                  ? "is-on"
                  : chapter === 0
                    ? atTop
                      ? "is-hero"
                      : "is-hidden"
                    : ""
              }`}
              aria-hidden
            >
              {SRC_POSITIONS.map((p, i) => {
                const heroMode = chapter === 0 && atTop;
                const key = heroMode ? heroIcons[i] : p.canonical;
                const meta = SRC_META[key];
                return (
                  <span
                    key={p.cls}
                    className={`lp-src-pill ${p.cls}`}
                    title={meta.label}
                    onAnimationIteration={
                      heroMode ? () => swapHeroIcon(i) : undefined
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

        {/* Vertical rail mirrors the page's actual direction of travel. */}
        <div className="lp-story-progress" aria-hidden>
          <span
            className="lp-story-progress-fill"
            style={{
              height: `${(chapter / Math.max(1, CHAPTERS.length - 1)) * 100}%`,
            }}
          />
          {CHAPTERS.map((_, i) => (
            <i
              key={i}
              className={`${i === chapter ? "is-active" : ""} ${
                i < chapter ? "is-complete" : ""
              }`}
            />
          ))}
        </div>

        <div
          className={`lp-story-scroll-hint ${atTop ? "is-visible" : ""}`}
          aria-hidden
        >
          <span>Scroll to explore</span>
          <i>↓</i>
        </div>
      </div>
    </section>
  );
}
