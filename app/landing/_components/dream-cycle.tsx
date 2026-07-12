"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Check,
  Combine,
  GitMerge,
  Lightbulb,
  Moon,
  Replace,
  Scale,
} from "lucide-react";

/**
 * Animated showcase of the memory "dream cycle" — the offline pass that tends
 * the store: merges near-duplicates, reconciles contradicting decisions via
 * supersession, surfaces cross-event insights, and prunes stale events.
 *
 * A single `phase` (0→5) drives every card's state; on the site it advances on
 * a timer once the section scrolls into view. Pass `phase` to drive it
 * externally (e.g. the Remotion reel).
 */

const STEPS = [
  {
    icon: Combine,
    label: "Consolidate",
    desc: "Near-duplicate decisions merge into one canonical record.",
  },
  {
    icon: Scale,
    label: "Reconcile",
    desc: "Contradicting decisions get linked — newest wins, history kept.",
  },
  {
    icon: Lightbulb,
    label: "Surface",
    desc: "Patterns across events become insights no single capture saw.",
  },
  {
    icon: Archive,
    label: "Prune",
    desc: "Stale, resolved events are archived out of active memory.",
  },
];

export function DreamCycle({
  phase: phaseProp,
}: {
  /** When set, drives the dream-cycle phase externally (0→5). Left undefined
   *  on the site, where scroll/intersection + a timer advance it. */
  phase?: number;
} = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [phaseState, setPhase] = useState(0);
  const phase = phaseProp ?? phaseState;

  useEffect(() => {
    if (phaseProp !== undefined) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setActive(e.isIntersecting),
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [phaseProp]);

  useEffect(() => {
    if (phaseProp !== undefined) return;
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(5);
      return;
    }
    const id = setInterval(() => setPhase((p) => (p + 1) % 6), 1700);
    return () => clearInterval(id);
  }, [active, phaseProp]);

  const merged = phase >= 1;
  const superseded = phase >= 2;
  const insight = phase >= 3;
  const archived = phase >= 4;
  const dreaming = phase >= 1 && phase <= 4;

  return (
    <div
      ref={ref}
      className="lp-dream grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start"
    >
      {/* LEFT: the four operations */}
      <div>
        <ul className="space-y-2">
          {STEPS.map((s, i) => {
            const isActive = phase === i + 1;
            const isDone = phase > i + 1;
            return (
              <li
                key={s.label}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-all duration-500 ${
                  isActive
                    ? "border-white/15 bg-white/[0.06] shadow-sm"
                    : "border-transparent"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-500 ${
                    isActive
                      ? "bg-white text-ink"
                      : isDone
                        ? "bg-emerald-400/10 text-emerald-200"
                        : "bg-white/[0.06] text-white/40"
                  }`}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <s.icon className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={`font-serif text-[19px] leading-tight tracking-tight ${
                      isActive ? "text-white" : "text-white/85"
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug text-white/50">
                    {s.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 flex items-start gap-2 text-[12.5px] leading-relaxed text-white/45">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-200" />
          Every change is code-validated — nothing is ever deleted, and open work
          is never touched.
        </p>
      </div>

      {/* RIGHT: the memory store, dreaming */}
      <div
        className={`lp-dream-panel ${dreaming ? "is-dreaming" : ""}`}
        data-phase={phase}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <span className="text-[13px] font-semibold tracking-tight text-white">
            Project memory
          </span>
          <span
            className={`lp-dream-status inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${
              dreaming
                ? "bg-indigo-400/15 text-indigo-200"
                : "bg-emerald-400/10 text-emerald-200"
            }`}
          >
            <Moon className={`h-3 w-3 ${dreaming ? "lp-dream-moon" : ""}`} />
            {dreaming ? "dreaming" : "up to date"}
          </span>
        </div>

        <div className="lp-dream-cards relative space-y-2 p-4">
          {/* Canonical decision — absorbs the duplicate */}
          <div className="lp-dc-card rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-violet-400/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-violet-200">
                Decision
              </span>
              {merged ? (
                <span className="lp-dc-in inline-flex items-center gap-1 rounded bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-emerald-200">
                  <GitMerge className="h-2.5 w-2.5" /> merged 2
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-white">
              Adopt Supabase Auth, drop custom JWT
            </p>
          </div>

          {/* Near-duplicate — collapses into the canonical card */}
          <div
            className={`lp-dc-collapse ${merged ? "is-gone" : ""}`}
            aria-hidden={merged}
          >
            <div className="lp-dc-card rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-3">
              <span className="rounded bg-violet-400/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-violet-200">
                Decision
              </span>
              <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/55">
                Go with Supabase for auth
              </p>
            </div>
          </div>

          {/* Contradiction — superseded */}
          <div
            className={`lp-dc-card rounded-lg border border-white/10 bg-white/[0.04] p-3 transition-all duration-500 ${
              superseded ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-violet-400/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-violet-200">
                Decision
              </span>
              {superseded ? (
                <span className="lp-dc-in inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-200">
                  <Replace className="h-2.5 w-2.5" /> superseded
                </span>
              ) : null}
            </div>
            <p
              className={`mt-1.5 text-[13px] font-medium leading-snug text-white ${
                superseded ? "line-through decoration-white/40" : ""
              }`}
            >
              Stay on custom JWT for now
            </p>
          </div>

          {/* Insight — surfaces */}
          <div
            className={`lp-dc-collapse ${insight ? "" : "is-gone"}`}
            aria-hidden={!insight}
          >
            <div className="lp-dc-insight rounded-lg border border-sky-400/30 bg-sky-500/10 p-3">
              <span className="inline-flex items-center gap-1 rounded bg-sky-400/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-sky-200">
                <Lightbulb className="h-2.5 w-2.5" /> Insight
              </span>
              <p className="mt-1.5 text-[13px] font-medium leading-snug text-white">
                Auth keeps getting relitigated — worth a short spec
              </p>
            </div>
          </div>

          {/* Stale milestone — archived */}
          <div
            className={`lp-dc-collapse ${archived ? "is-gone" : ""}`}
            aria-hidden={archived}
          >
            <div className="lp-dc-card rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-emerald-200">
                  Milestone
                </span>
                <span className="font-mono text-[9px] text-white/40">
                  resolved · 34d ago
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-medium leading-snug text-white">
                v1 closed beta shipped
              </p>
            </div>
          </div>

          {archived ? (
            <p className="lp-dc-in flex items-center gap-1.5 pt-0.5 font-mono text-[10px] text-white/45">
              <Archive className="h-3 w-3" /> 1 stale event archived (kept, not
              deleted)
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
