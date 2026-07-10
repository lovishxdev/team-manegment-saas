import Image from "next/image";
import Link from "next/link";
import { ui } from "@/components/ui/ui";
import { DashboardPreview } from "./dashboard-preview";
import { LandingStyles } from "./landing-styles";
import { Reveal } from "./scroll-reveal";
import { RotatingWords } from "./rotating-words";
import { UseCaseMarquee } from "./use-case-marquee";
import { WhatsAppDemo } from "./whatsapp-demo";
import { FaqSection } from "@/components/seo/faq-section";
import { HOME_FAQ } from "@/lib/seo/faq";
import { HERO_BLUR_DATA_URL } from "./hero-blur";

const KANBAN = {
  todo: "#f43f5e", // rose-500
  doing: "#f97316", // orange-500
  done: "#8b5cf6", // violet-500
} as const;

const ROTATING = [
  { text: "Hackathon", tint: KANBAN.todo },
  { text: "Hostel group chat", tint: KANBAN.doing },
  { text: "Coffee-shop sprint", tint: KANBAN.done },
  { text: "Weekend event", tint: KANBAN.todo },
  { text: "3 AM grind", tint: KANBAN.doing },
  { text: "WhatsApp thread", tint: KANBAN.done },
];

/**
 * The marketing landing page body, rendered both at `/` (for signed-out
 * users) and at `/landing` (kept as an alias for direct linking).
 */
export function LandingContent() {
  return (
    <div className="relative">
      <LandingStyles />

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
            <span className="truncate text-[15px] font-semibold tracking-tight text-ink sm:text-base">
              Euclis
            </span>
          </Link>

          <nav className="hidden items-center justify-center gap-0.5 sm:flex lg:gap-1">
            <Link href="#how-it-works" className="lp-nav-link">
              Product
            </Link>
            <Link href="#whatsapp" className="lp-nav-link">
              WhatsApp
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white transition hover:bg-ink/90 sm:px-4 sm:py-2.5"
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
          HERO — Netflix-style full-bleed photo (light, warm aesthetic)
          ============================================================ */}
      <section className="lp-hero lp-grain">
        <div className="lp-hero-photo">
          <Image
            src="/landingimg1.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            quality={80}
            placeholder="blur"
            blurDataURL={HERO_BLUR_DATA_URL}
            className="object-cover object-center"
          />
        </div>
        <div className="lp-hero-wash" />

        <div className="relative z-[1] mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-between px-5 pb-12 pt-32 sm:px-8 sm:pb-16 sm:pt-36">
          <div className="mx-auto mt-10 max-w-5xl text-center sm:mt-14">
            <h1 className="font-serif text-[2.6rem] leading-[1.02] tracking-tight text-ink sm:text-[3.6rem] md:text-[4.4rem] lg:text-[5.2rem]">
              Your team&apos;s plan stays in sync
              <br />
              <span className="inline-flex flex-wrap items-baseline justify-center gap-x-[0.28em]">
                even when you&apos;re in a
                <RotatingWords words={ROTATING} />
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-ink sm:mt-9 sm:text-[17px]">
              Euclis is a shared task board your team can reach from anywhere
              the conversation already happens. Drag-and-drop on the web,{" "}
              <span className="rounded bg-[#DCF8C6] px-1.5 py-0.5 font-medium text-ink">
                fire off a WhatsApp message
              </span>
              , or hand the wheel to Claude.{" "}
              <span className="font-medium">Same board. Same truth.</span>
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className={`lp-shimmer px-6 py-3.5 text-[15px] ${ui.btnPrimary}`}
              >
                Start free →
              </Link>
              <Link
                href="#whatsapp"
                className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-paper/85 px-6 py-3.5 text-[15px] font-medium text-ink shadow-sm backdrop-blur-md transition hover:bg-paper"
              >
                WhatsApp demo →
              </Link>
            </div>

            {/* Trust line */}
            <p className="mt-7 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
              works with whatsapp · claude · web · realtime sync · zero install
            </p>
          </div>

          {/* Scroll cue */}
          <div className="mt-10 flex justify-center">
            <div className="lp-scroll-cue flex flex-col items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              <span>scroll</span>
              <svg viewBox="0 0 12 16" fill="none" className="h-4 w-3" stroke="currentColor" strokeWidth="1.4">
                <path d="M6 1v12M2 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          USE-CASE MARQUEE — bridges hero into the rest of the page
          ============================================================ */}
      <section className="relative border-y border-line bg-paper/65 py-6 backdrop-blur-sm">
        <UseCaseMarquee />
      </section>

      {/* ============================================================
          WHATSAPP — native gateway, no new app
          ============================================================ */}
      <section
        id="whatsapp"
        className="relative overflow-hidden border-b border-line"
      >
        {/* Phone background photo — covers entire section, subtle wash on top */}
        <div aria-hidden className="absolute inset-0 -z-20">
          <Image
            src="/landing-phone.webp"
            alt=""
            fill
            sizes="100vw"
            quality={75}
            loading="lazy"
            className="object-cover object-center opacity-[0.32]"
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(239,239,239,0.96) 0%, rgba(255,255,255,0.86) 18%, rgba(255,255,255,0.78) 60%, rgba(239,239,239,0.96) 100%)",
          }}
        />

        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="lp-wa-gradient grid h-7 w-7 place-items-center rounded-md text-white shadow-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.1-1.3c1.5.8 3.1 1.3 4.9 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.3-.4.1-1 .1-1.7-.1-.4-.1-.9-.3-1.5-.5-2.7-1.2-4.4-3.8-4.6-4-.1-.2-1-1.3-1-2.5s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5l-.3.4-.4.5c-.1.1-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.3.1.5.1.7-.1l.8-1c.2-.3.4-.2.7-.1.3.1 1.8.9 2.1 1l.5.2c.1.2.1.7-.1 1.3z" />
                </svg>
              </span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                whatsapp first · zero install
              </span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="mt-4 max-w-3xl font-serif text-[2.2rem] leading-[1.06] tracking-tight text-ink sm:text-[3rem] lg:text-[3.6rem]">
              Run your team from{" "}
              <span className="font-medium text-ink">the app you already live in.</span>
            </h2>
          </Reveal>

          <Reveal delay={140}>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
              No new app. No new login. Just text the Euclis bot like you&apos;d
              text a teammate. It parses the intent with{" "}
              <span className="font-medium text-ink">Claude Haiku</span>,
              updates the board, and replies with what it did. Send a photo and
              it lands in your assets, attached to the right task.
            </p>
          </Reveal>

          {/* Feature pills */}
          <Reveal delay={200}>
            <ul className="mt-7 flex flex-wrap gap-2">
              {[
                "natural-language tasks",
                "photos auto-attach",
                "follow-up references (\"make that one high priority\")",
                "no app to install",
              ].map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-line bg-paper/80 px-3 py-1.5 text-[12.5px] text-ink shadow-sm backdrop-blur-sm"
                >
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={260}>
            <div className="mt-14">
              <WhatsAppDemo />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          THE TRIAD — three doors, one source of truth
          ============================================================ */}
      <section
        className="relative overflow-hidden border-b border-line"
        id="how-it-works"
      >
        <div
          aria-hidden
          className="lp-mesh absolute inset-0 -z-10 opacity-50"
        />
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
          <Reveal className="text-center">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
              The triad
            </p>
            <h2 className="mx-auto mt-3 max-w-3xl font-serif text-[2rem] leading-[1.08] tracking-tight text-ink sm:text-[2.8rem]">
              Three doors. One room.{" "}
              <span className="italic font-medium text-ink">No more "where is it?"</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] text-ink-soft">
              Everyone on your team uses the door that fits them. The board
              behind those doors is always the same one.
            </p>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
            <Reveal delay={0}>
              <DoorCard
                badge="WEB"
                title="The dashboard"
                desc="Fast kanban with drag-and-drop, live updates, shared assets, and a multiplayer whiteboard. Built for the laptop crowd."
                visual={<MiniWeb />}
              />
            </Reveal>
            <Reveal delay={120}>
              <DoorCard
                badge="WHATSAPP"
                title="The assistant"
                desc='"Add a task to fix the login bug, high priority, due Friday." Done. Send a photo and it lands in your assets, attached to the right task.'
                visual={<MiniWhatsApp />}
                accent
              />
            </Reveal>
            <Reveal delay={240}>
              <DoorCard
                badge="CLAUDE"
                title="The connector"
                desc="Plug Euclis into Claude as an MCP connector and manage your board mid-conversation: create, update, and review tasks without switching tabs."
                visual={<MiniClaude />}
              />
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
            <Link href="#whatsapp" className="hover:text-ink">
              WhatsApp
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

function DoorCard({
  badge,
  title,
  desc,
  visual,
  accent = false,
}: {
  badge: string;
  title: string;
  desc: string;
  visual: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <article
      className={`lp-tile flex h-full flex-col rounded-2xl border border-line bg-paper p-6 shadow-sm ${
        accent ? "ring-1 ring-[#25D366]/25" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${
            accent
              ? "bg-[#DCF8C6]/90 text-[#128C7E]"
              : "bg-paper-deep text-ink-soft"
          }`}
        >
          {badge}
        </span>
      </div>
      <h3 className="mt-4 text-[20px] font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{desc}</p>
      <div className="mt-6 flex-1">{visual}</div>
    </article>
  );
}

function MiniWeb() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-shell">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-2">
        <div className="rounded bg-rose-100/70 p-1.5">
          <div className="h-1.5 w-6 rounded bg-rose-300/70" />
          <div className="mt-1.5 h-2.5 rounded bg-white" />
          <div className="mt-1 h-2.5 rounded bg-white/85" />
        </div>
        <div className="rounded bg-orange-100/70 p-1.5">
          <div className="h-1.5 w-6 rounded bg-orange-300/70" />
          <div className="mt-1.5 h-2.5 rounded bg-white" />
        </div>
        <div className="rounded bg-violet-100/70 p-1.5">
          <div className="h-1.5 w-6 rounded bg-violet-300/70" />
          <div className="mt-1.5 h-2.5 rounded bg-white" />
        </div>
      </div>
    </div>
  );
}

function MiniWhatsApp() {
  return (
    <div className="overflow-hidden rounded-lg bg-[#ECE5DD] p-2">
      <div className="lp-wa-gradient rounded-t-md px-2 py-1.5 text-[9.5px] font-semibold text-white">
        Euclis · online
      </div>
      <div className="mt-1.5 space-y-1.5 px-1 pb-1">
        <div className="ml-auto max-w-[78%] rounded-md rounded-tr-sm bg-[#DCF8C6] px-2 py-1 text-[10px] leading-snug text-ink shadow-sm">
          add task: fix login bug, high, due fri
        </div>
        <div className="mr-auto max-w-[82%] rounded-md rounded-tl-sm bg-white px-2 py-1 text-[10px] leading-snug text-ink shadow-sm">
          Done. Added to To Do · assigned you · due Fri.
        </div>
      </div>
    </div>
  );
}

function MiniClaude() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper">
      <div className="flex items-center gap-1.5 border-b border-line bg-card-high px-2 py-1.5 text-[9.5px] font-medium text-ink">
        <span className="grid h-3.5 w-3.5 place-items-center rounded bg-[#cc9c6a] text-[7px] font-bold text-white">
          C
        </span>
        Claude · MCP connector
      </div>
      <div className="space-y-1.5 px-2 py-2">
        <div className="rounded-md bg-paper-deep px-2 py-1.5 font-mono text-[9.5px] text-ink-soft">
          → tools/list <span className="text-ink-soft">✓ 3 tools</span>
        </div>
        <div className="rounded-md border border-line bg-card px-2 py-1.5 text-[10px] text-ink">
          create_task · update_task · get_board_state
        </div>
      </div>
    </div>
  );
}

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
