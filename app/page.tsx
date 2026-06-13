import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { ui } from "@/components/ui";

function PreviewCard({
  chip,
  chipCls,
  title,
  meta,
  avatar,
}: {
  chip: string;
  chipCls: string;
  title: string;
  meta: string;
  avatar: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-card p-3.5">
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide ${chipCls}`}
      >
        {chip}
      </span>
      <p className="mt-2 text-sm font-medium text-ink">{title}</p>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-ink-faint">
        <span>{meta}</span>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-400/20 text-[9px] font-semibold text-orange-300">
          {avatar}
        </span>
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Soft editorial glow behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[640px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,200,150,0.08),transparent_70%)] blur-3xl"
      />

      {/* ---------- Nav ---------- */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Image
          src="/euclis-logo.png"
          alt="Euclis"
          width={32}
          height={32}
          className="rounded-md ring-1 ring-line"
        />
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-2 text-sm text-ink-soft transition hover:text-ink"
          >
            Sign in
          </Link>
          <Link href="/signup" className={ui.btnPrimary}>
            Get started
          </Link>
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative mx-auto max-w-4xl px-6 py-20 text-center sm:py-28 md:py-32">
        <h1 className="mx-auto max-w-4xl font-serif text-5xl font-normal leading-[1.06] tracking-tight text-ink sm:text-6xl lg:text-7xl">
          Project management without the{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span className="relative top-2 inline-block -rotate-3 font-script text-[1.18em] font-semibold leading-none text-accent-bright md:top-4 md:-rotate-6 md:text-[1.28em]">
              dashboard
            </span>
          </span>
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-ink-soft md:mt-10 md:text-lg">
          A shared task board your team can reach from anywhere the
          conversation happens — the web dashboard, a WhatsApp message, or a
          chat with Claude.{" "}
          <span className="font-medium text-ink">Same board. Same truth.</span>
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 md:mt-12">
          <Link href="/signup" className={`px-6 py-3 ${ui.btnPrimary}`}>
            Start free
          </Link>
          <Link href="/login" className={`px-6 py-3 ${ui.btnSecondary}`}>
            Sign in
          </Link>
        </div>
      </section>

      {/* ---------- Board preview ---------- */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="mx-auto max-w-4xl rounded-xl border border-line bg-paper-deep p-3">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-paper p-4 sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-paper-deep p-3 text-left">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full bg-ink-faint" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]">
                  To Do
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                <PreviewCard
                  chip="design"
                  chipCls="bg-pink-400/15 text-pink-300"
                  title="Landing page hero"
                  meta="due 18 Jun"
                  avatar="A"
                />
                <PreviewCard
                  chip="backend"
                  chipCls="bg-violet-400/15 text-violet-300"
                  title="Webhook retries"
                  meta="#42"
                  avatar="R"
                />
              </div>
            </div>
            <div className="rounded-lg border border-line bg-paper-deep p-3 text-left">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]">
                  In Progress
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                <PreviewCard
                  chip="frontend"
                  chipCls="bg-sky-400/15 text-sky-300"
                  title="Realtime board sync"
                  meta="due 14 Jun"
                  avatar="L"
                />
              </div>
            </div>
            <div className="rounded-lg border border-line bg-paper-deep p-3 text-left">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]">
                  Done
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                <PreviewCard
                  chip="general"
                  chipCls="bg-white/[0.06] text-ink-soft"
                  title="Team onboarding"
                  meta="#7"
                  avatar="S"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- The three doors ---------- */}
      <section className="relative border-t border-line bg-paper-deep/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-center font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            Interfaces
          </p>
          <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight">
            Three ways in. One source of truth.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-ink-soft">
            Everyone works where they already are — the board stays in perfect
            order, like geometry says it should.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                title: "The dashboard",
                body: "A fast kanban board with drag-and-drop, live updates, shared assets, and a multiplayer whiteboard for thinking out loud.",
                badge: "Web",
              },
              {
                title: "The WhatsApp assistant",
                body: '"Add a task to fix the login bug, high priority, due Friday." Done. Send a photo and it lands in your assets, attached to the right task.',
                badge: "WhatsApp",
              },
              {
                title: "The Claude connector",
                body: "Plug Euclis into Claude as a connector and manage your board mid-conversation — create, update, and review tasks without switching tabs.",
                badge: "Claude",
              },
            ].map((f) => (
              <div
                key={f.badge}
                className="rounded-lg border border-line bg-card p-6 transition hover:border-accent/30"
              >
                <span className="rounded bg-accent-soft px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent">
                  {f.badge}
                </span>
                <h3 className="mt-4 text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image
              src="/euclis-logo.png"
              alt="Euclis"
              width={22}
              height={22}
              className="rounded ring-1 ring-line"
            />
            <span className="text-sm font-semibold">Euclis</span>
          </div>
          <p className="font-mono text-[11px] text-ink-faint">
            Order from chaos, since {new Date().getFullYear()}.
          </p>
          <Link
            href="/signup"
            className="text-sm font-medium text-accent hover:underline"
          >
            Start free →
          </Link>
        </div>
      </footer>
    </div>
  );
}
