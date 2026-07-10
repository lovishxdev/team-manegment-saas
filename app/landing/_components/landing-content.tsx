import Image from "next/image";
import Link from "next/link";
import { Moon } from "lucide-react";
import { ui } from "@/components/ui/ui";
import { DashboardPreview } from "./dashboard-preview";
import { DiscussionShowcase } from "./discussion-showcase";
import { DreamCycle } from "./dream-cycle";
import { LandingStyles } from "./landing-styles";
import { NavThemeSync } from "./nav-theme-sync";
import { Reveal } from "./scroll-reveal";
import { ScrollStory } from "./scroll-story";
import { FaqSection } from "@/components/seo/faq-section";
import { HOME_FAQ } from "@/lib/seo/faq";

/**
 * The marketing landing page body, rendered both at `/` (for signed-out
 * users) and at `/landing` (kept as an alias for direct linking).
 */
export function LandingContent() {
  return (
    <div className="relative">
      <LandingStyles />
      <NavThemeSync />

      {/* ============================================================
          NAV — floating pill, glassy (Zite-style)
          ============================================================ */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="lp-nav-pill pointer-events-auto mx-auto grid max-w-4xl grid-cols-[1fr_auto] items-center gap-3 rounded-xl px-3 py-2 sm:max-w-5xl sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-4 sm:py-2.5 lg:max-w-6xl lg:px-5 lg:py-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 justify-self-start"
          >
            <Image
              src="/euclis-logo-64.webp"
              alt="Euclis"
              width={32}
              height={32}
              priority
              className="shrink-0 rounded-md ring-1 ring-line/80 shadow-sm sm:h-8 sm:w-8"
            />
            <span className="lp-nav-brand truncate text-[15px] font-semibold tracking-tight text-ink sm:text-base">
              Euclis
            </span>
          </Link>

          <nav className="hidden items-center justify-center gap-0.5 sm:flex lg:gap-1">
            <Link href="#how-it-works" className="lp-nav-link">
              Product
            </Link>
            <Link href="#dreaming" className="lp-nav-link">
              Dreaming
            </Link>
            <Link href="/pricing" className="lp-nav-link">
              Pricing
            </Link>
            <Link href="#faq" className="lp-nav-link hidden lg:inline-flex">
              FAQ
            </Link>
          </nav>

          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <Link href="/login" className="lp-nav-link hidden sm:inline-flex">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="lp-nav-cta inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white transition hover:bg-ink/90 sm:px-4 sm:py-2.5"
            >
              Start free
              <span aria-hidden className="text-white/80">
                →
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================
          HERO — pinned scroll-story (anchor + swapping copy)
          ============================================================ */}
      <ScrollStory />

      {/* ============================================================
          DREAMING — memory that maintains itself
          ============================================================ */}
      <section id="dreaming" className="lp-dream-night relative overflow-hidden">
        {/* Night backdrop — moonlit glow + faint drifting stars. */}
        <div aria-hidden className="lp-dream-sky absolute inset-0 -z-20" />
        <div aria-hidden className="lp-dream-stars absolute inset-0 -z-20" />
        {/* Soft gradient fades so it eases in/out of the light sections. */}
        <div aria-hidden className="lp-dream-fade-top" />
        <div aria-hidden className="lp-dream-fade-bottom" />

        <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8 sm:py-36">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-indigo-100 ring-1 ring-white/15 backdrop-blur">
                <Moon className="h-3.5 w-3.5" />
              </span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-200/70">
                dreaming · while you&apos;re away
              </span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="mt-4 max-w-3xl font-serif text-[2.2rem] leading-[1.06] tracking-tight text-[#f5f4fb] sm:text-[3rem] lg:text-[3.6rem]">
              Your memory isn&apos;t just stored.{" "}
              <span className="font-medium italic text-white">It thinks.</span>
            </h2>
          </Reveal>

          <Reveal delay={140}>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-indigo-100/60 sm:text-[17px]">
              Capture only ever sees one moment. So on a schedule, Euclis takes a
              step back and tends the whole store — the way you&apos;d wish
              someone would. It merges duplicates, reconciles decisions that
              contradict, surfaces patterns no single note could see, and files
              away what&apos;s gone stale. Retrieval reads; dreaming maintains.
            </p>
          </Reveal>

          <Reveal delay={220}>
            <div className="mt-14">
              <DreamCycle />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          DISCUSSIONS — where teams and their agents collaborate
          ============================================================ */}
      <section
        className="relative overflow-hidden border-b border-line bg-paper"
        id="how-it-works"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
          <Reveal className="text-center">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
              Discussions
            </p>
            <h2 className="mx-auto mt-3 max-w-3xl font-serif text-[2rem] leading-[1.08] tracking-tight text-ink sm:text-[2.8rem]">
              Nobody starts from zero{" "}
              <span className="italic font-medium text-ink">— human or agent.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] text-ink-soft">
              Discussions branch into focused threads. Ask an agent to summarize
              one and it answers from the whole history plus project memory — so a
              new teammate, or a fresh AI session, is caught up in a minute.
            </p>
          </Reveal>

          <div className="mt-14">
            <Reveal delay={120}>
              <DiscussionShowcase />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================================================
          DASHBOARD PREVIEW — the kanban centerpiece
          ============================================================ */}
      <section className="relative overflow-hidden border-b border-line bg-paper-deep/45">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.7fr] lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-24">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                  The dashboard
                </p>
                <h2 className="mt-3 font-serif text-[2rem] leading-[1.06] tracking-tight text-ink sm:text-[2.8rem]">
                  The board that{" "}
                  <span className="italic font-medium text-ink">doesn&apos;t get out of date</span>
                  .
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
                  Because every update, whether someone dragged a card on the
                  web, fired a message on WhatsApp, or had Claude rebuild the
                  backlog, lands in the same Postgres row. Everyone sees the
                  change as it happens.
                </p>
                <ul className="mt-6 space-y-2.5 text-[14px] text-ink">
                  <Bullet>
                    <strong className="font-medium">Drag-and-drop kanban</strong>
                    : three columns, real cards, real keyboard shortcuts.
                  </Bullet>
                  <Bullet>
                    <strong className="font-medium">Live cursor sync</strong> on
                    a multiplayer whiteboard for thinking out loud.
                  </Bullet>
                  <Bullet>
                    <strong className="font-medium">Shared assets</strong>: any
                    file dropped on WhatsApp lands here, tagged.
                  </Bullet>
                  <Bullet>
                    <strong className="font-medium">Per-workspace short IDs</strong>{" "}
                    (<code className="font-mono text-[12px] text-ink-soft">#42</code>)
                    so &quot;close 42&quot; in chat just works.
                  </Bullet>
                </ul>
                <Link
                  href="/signup"
                  className={`mt-7 inline-flex ${ui.btnSecondary}`}
                >
                  Open a workspace →
                </Link>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <DashboardPreview />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================================================
          FAQ — extractable Q&A for SEO & GEO
          ============================================================ */}
      <FaqSection items={HOME_FAQ} />

      {/* ============================================================
          FINAL CTA
          ============================================================ */}
      <section className="relative overflow-hidden border-t border-line">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 12% 18%, rgba(255, 218, 130, 0.55) 0%, transparent 65%), radial-gradient(ellipse 60% 70% at 88% 28%, rgba(255, 185, 205, 0.55) 0%, transparent 65%), radial-gradient(ellipse 50% 70% at 50% 100%, rgba(195, 188, 255, 0.22) 0%, transparent 75%), #fafafa",
          }}
        />

        <div className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-8 sm:py-32">
          <Reveal>
            <h2 className="font-serif text-[2.4rem] leading-[1.04] tracking-tight text-ink sm:text-[3.6rem]">
              Start free. Be in sync by{" "}
              <span className="italic font-medium text-ink">the next coffee.</span>
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="mx-auto mt-5 max-w-xl text-[16px] text-ink-soft">
              Email is enough. No card. No phone number required. Works with
              WhatsApp, Claude, and the web. None of them are required to
              get started.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className={`lp-shimmer px-7 py-4 text-[15px] ${ui.btnPrimary}`}
              >
                Create your workspace →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-paper/85 px-5 py-4 text-[15px] font-medium text-ink shadow-sm backdrop-blur-md transition hover:bg-paper"
              >
                I already have one
              </Link>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-7 max-w-md font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-soft">
              60-second setup · invite your team by WhatsApp · drop the
              spreadsheet today
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <footer className="border-t border-line bg-paper-deep/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/euclis-logo-64.webp"
              alt="Euclis"
              width={28}
              height={28}
              loading="lazy"
              className="rounded-md ring-1 ring-line"
            />
            <div>
              <p className="text-[14px] font-semibold tracking-tight text-ink">
                Euclis
              </p>
              <p className="font-mono text-[10.5px] text-ink-faint">
                Order from chaos, since {new Date().getFullYear()}.
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-[13px] text-ink-soft">
            <Link href="#dreaming" className="hover:text-ink">
              Dreaming
            </Link>
            <Link href="/pricing" className="hover:text-ink">
              Pricing
            </Link>
            <Link href="#faq" className="hover:text-ink">
              FAQ
            </Link>
            <Link
              href="/guides/manage-tasks-from-whatsapp"
              className="hover:text-ink"
            >
              Guides
            </Link>
            <Link href="/compare/taskrio" className="hover:text-ink">
              vs TaskRio
            </Link>
            <Link href="/compare/trello" className="hover:text-ink">
              Compare
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="font-medium text-ink hover:underline"
            >
              Start free →
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ================================================================
   Small server-side helpers below
   ================================================================ */

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/35"
        aria-hidden
      />
      <span className="text-ink-soft">{children}</span>
    </li>
  );
}
