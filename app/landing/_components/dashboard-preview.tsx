"use client";

import {
  ArrowRight,
  Eraser,
  Hand,
  MousePointer2,
  Pencil,
  Square,
  Type,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Animated mock of the Euclis dashboard — cycles between the kanban board
 * and a multiplayer Excalidraw-style whiteboard with live collaborator cursors.
 */

type View = "board" | "whiteboard";

type Card = {
  id: string;
  chip: string;
  chipCls: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  priorityCls: string;
  title: string;
  assignee: { initial: string; cls: string };
  due?: string;
  attachments?: number;
};

const TODO: Card[] = [
  {
    id: "t1",
    chip: "design",
    chipCls: "bg-pink-50 text-pink-700",
    priority: "HIGH",
    priorityCls: "bg-rose-50 text-rose-700",
    title: "Polish the empty-state illustration",
    assignee: { initial: "A", cls: "bg-orange-100 text-orange-700" },
    due: "Tue 17 Jun",
  },
  {
    id: "t2",
    chip: "backend",
    chipCls: "bg-violet-50 text-violet-700",
    priority: "MEDIUM",
    priorityCls: "bg-amber-50 text-amber-700",
    title: "Webhook retries — exponential backoff",
    assignee: { initial: "R", cls: "bg-violet-100 text-violet-700" },
    due: "#52",
  },
];

const IN_PROGRESS: Card[] = [
  {
    id: "p1",
    chip: "frontend",
    chipCls: "bg-sky-50 text-sky-700",
    priority: "MEDIUM",
    priorityCls: "bg-amber-50 text-amber-700",
    title: "Realtime board sync — debounce + reconcile",
    assignee: { initial: "L", cls: "bg-sky-100 text-sky-700" },
    due: "Fri 14 Jun",
    attachments: 2,
  },
  {
    id: "p2",
    chip: "design",
    chipCls: "bg-pink-50 text-pink-700",
    priority: "HIGH",
    priorityCls: "bg-rose-50 text-rose-700",
    title: "Landing page hero · v3",
    assignee: { initial: "S", cls: "bg-teal-100 text-teal-700" },
    due: "today",
  },
];

const DONE: Card[] = [
  {
    id: "d1",
    chip: "general",
    chipCls: "bg-paper-deep text-ink-soft",
    priority: "LOW",
    priorityCls: "bg-emerald-50 text-emerald-700",
    title: "Team onboarding & invite links",
    assignee: { initial: "M", cls: "bg-amber-100 text-amber-700" },
    due: "#7",
  },
];

const VIEW_MS = 9000;

export function DashboardPreview() {
  const [view, setView] = useState<View>("board");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(
      () => setView((v) => (v === "board" ? "whiteboard" : "board")),
      VIEW_MS
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-shell shadow-[0_40px_120px_-40px_rgba(20,20,30,0.18)]">
      {/* Faux window chrome — grid keeps traffic-light dots circular on narrow screens */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 border-b border-line bg-paper-deep/50 px-3 py-2.5 sm:grid-cols-[auto_1fr_auto] sm:gap-2 sm:px-4">
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="size-2.5 shrink-0 rounded-full bg-rose-300/80" />
          <span className="size-2.5 shrink-0 rounded-full bg-amber-300/80" />
          <span className="size-2.5 shrink-0 rounded-full bg-emerald-300/80" />
        </div>
        <div className="col-span-2 flex min-w-0 items-center gap-2 rounded-md bg-white/80 px-2.5 py-1 text-[10px] text-ink-soft shadow-sm sm:col-span-1 sm:mx-auto sm:px-3 sm:text-[10.5px]">
          <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3 shrink-0" stroke="currentColor" strokeWidth="1.4">
            <rect x="2" y="3" width="10" height="8" rx="2" />
            <path d="M5 3V2.2A1.2 1.2 0 0 1 6.2 1h1.6A1.2 1.2 0 0 1 9 2.2V3" />
          </svg>
          <span className="truncate font-mono">
            euclis.app / w / weekend-hack-2026
            {view === "whiteboard" ? " / whiteboard" : ""}
          </span>
        </div>
        <div className="hidden w-12 shrink-0 sm:block" aria-hidden />
      </div>

      <div className="relative md:grid md:grid-cols-[200px_1fr]">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="absolute inset-0 z-10 bg-ink/25 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`absolute inset-y-0 left-0 z-20 w-[min(11.5rem,78vw)] border-r border-line bg-shell px-3 py-4 shadow-lg transition-transform duration-200 md:static md:z-auto md:w-auto md:translate-x-0 md:shadow-none ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="flex items-center gap-2 px-1 pb-4">
            <Image
              src="/euclis-logo.png"
              alt="Euclis"
              width={28}
              height={28}
              className="shrink-0 rounded-md shadow-sm ring-1 ring-line/80"
            />
            <span className="text-[13px] font-semibold tracking-tight">Euclis</span>
            <button
              type="button"
              aria-label="Close sidebar"
              className="ml-auto rounded-md p-1 text-ink-faint md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav className="flex flex-col gap-0.5 text-[11.5px]">
            <SidebarItem icon="grid" label="Dashboard" />
            <SidebarItem icon="briefcase" label="Workspaces" active={view === "board"} />
            <SidebarItem icon="pen" label="Whiteboard" active={view === "whiteboard"} />
            <SidebarItem icon="cog" label="Settings" />
          </nav>
          <p className="mt-5 px-2 pb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Workspaces
          </p>
          <div className="flex flex-col gap-0.5 text-[11.5px]">
            <SidebarWorkspace name="weekend-hack-2026" tasks={5} active />
            <SidebarWorkspace name="hostel fest crew" tasks={12} />
            <SidebarWorkspace name="side-project · v2" tasks={3} />
          </div>
        </aside>

        <div className="min-w-0 bg-shell px-3 py-4 sm:px-5 sm:py-5">
          <WorkspaceHeader
            view={view}
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          <div className="lp-preview-stage max-h-[min(70vh,440px)] overflow-y-auto sm:max-h-none sm:overflow-visible">
            <div className="relative sm:min-h-[288px]">
              <div
                className={`lp-preview-pane sm:absolute sm:inset-0 ${
                  view === "board" ? "" : "hidden sm:block is-hidden"
                }`}
                aria-hidden={view !== "board"}
              >
                <BoardView />
              </div>
              <div
                className={`lp-preview-pane sm:absolute sm:inset-0 ${
                  view === "whiteboard" ? "" : "hidden sm:block is-hidden"
                }`}
                aria-hidden={view !== "whiteboard"}
              >
                <WhiteboardView />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceHeader({
  view,
  onOpenSidebar,
}: {
  view: View;
  onOpenSidebar: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <button
          type="button"
          aria-label="Open sidebar"
          className="mt-0.5 shrink-0 rounded-md border border-line bg-paper p-1.5 text-ink-soft shadow-sm md:hidden"
          onClick={onOpenSidebar}
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" strokeLinecap="round" />
          </svg>
        </button>
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink sm:text-[17px]">
            weekend-hack-2026
          </h3>
          <p className="mt-0.5 text-[10.5px] text-ink-soft">
            {view === "board"
              ? "5 open · 4 members"
              : "4 on canvas · excalidraw"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
        <div className="flex rounded-lg bg-paper-deep p-0.5 text-[10px] font-medium">
          <ViewTab active={view === "board"} label="Board" />
          <ViewTab active={view === "whiteboard"} label="Whiteboard" />
        </div>
        <AvatarStack />
        <button className="hidden rounded-md border border-line bg-paper px-2 py-1 text-[10px] font-medium text-ink-soft min-[400px]:inline-block">
          + Invite
        </button>
      </div>
    </div>
  );
}

function ViewTab({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-md px-2.5 py-1 transition ${
        active ? "bg-paper text-ink shadow-sm" : "text-ink-soft"
      }`}
    >
      {label}
    </span>
  );
}

function BoardView() {
  return (
    <div className="-mx-0.5 overflow-x-auto pb-1 sm:overflow-visible">
      <div className="flex w-max gap-2 sm:grid sm:w-full sm:grid-cols-3 sm:gap-3">
        <KanbanColumn label="To Do" dot="bg-rose-500" tint="bg-rose-100/70" className="w-[9.5rem] shrink-0 sm:w-auto">
          {TODO.map((c) => (
            <KCard key={c.id} card={c} />
          ))}
        </KanbanColumn>
        <KanbanColumn label="In Progress" dot="bg-orange-500" tint="bg-orange-100/70" className="w-[9.5rem] shrink-0 sm:w-auto">
          {IN_PROGRESS.map((c) => (
            <KCard key={c.id} card={c} highlight={c.id === "p2"} />
          ))}
        </KanbanColumn>
        <KanbanColumn label="Done" dot="bg-violet-500" tint="bg-violet-100/70" className="w-[9.5rem] shrink-0 sm:w-auto">
          {DONE.map((c) => (
            <KCard key={c.id} card={c} />
          ))}
        </KanbanColumn>
      </div>
    </div>
  );
}

function WhiteboardView() {
  return (
    <div className="flex h-full min-h-[268px] overflow-hidden rounded-xl border border-line bg-white shadow-sm sm:min-h-[288px]">
      {/* Excalidraw-style tool rail */}
      <div className="flex w-9 shrink-0 flex-col items-center gap-1 border-r border-line bg-paper py-2">
        <ToolBtn icon="hand" />
        <ToolBtn icon="select" />
        <ToolBtn icon="pen" active />
        <ToolBtn icon="rectangle" />
        <ToolBtn icon="arrow" />
        <div className="mt-auto flex flex-col items-center gap-1">
          <ToolBtn icon="text" />
          <ToolBtn icon="eraser" />
        </div>
      </div>

      {/* Canvas */}
      <div className="lp-wb-grid relative min-w-0 flex-1">
        <svg
          viewBox="0 0 420 240"
          className="absolute inset-0 h-full w-full"
          fill="none"
          aria-hidden
        >
          {/* Rough sketch — landing flow */}
          <rect
            x="36"
            y="44"
            width="108"
            height="64"
            rx="4"
            stroke="#1a1a1a"
            strokeWidth="1.8"
            fill="#fff5f5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="48" y="68" fill="#1a1a1a" fontSize="11" fontFamily="var(--font-serif), serif">
            Landing hero
          </text>
          <text x="48" y="84" fill="#6b7280" fontSize="9" fontFamily="var(--font-sans), sans-serif">
            v3 wireframe
          </text>

          <rect
            x="200"
            y="36"
            width="118"
            height="72"
            rx="4"
            stroke="#1a1a1a"
            strokeWidth="1.8"
            fill="#f0fdf4"
            strokeLinecap="round"
          />
          <text x="214" y="62" fill="#1a1a1a" fontSize="11" fontFamily="var(--font-serif), serif">
            WhatsApp bot
          </text>
          <text x="214" y="78" fill="#6b7280" fontSize="9">
            NL → task
          </text>

          <path
            d="M144 76 C 168 76, 178 72, 200 72"
            stroke="#1a1a1a"
            strokeWidth="1.6"
            strokeLinecap="round"
            markerEnd="url(#lp-wb-arrow)"
          />

          <rect
            x="56"
            y="148"
            width="92"
            height="52"
            rx="4"
            stroke="#1a1a1a"
            strokeWidth="1.8"
            fill="#fff7ed"
            strokeLinecap="round"
          />
          <text x="68" y="172" fill="#1a1a1a" fontSize="10" fontFamily="var(--font-serif), serif">
            Kanban sync
          </text>

          <path
            d="M248 108 C 248 128, 220 140, 148 148"
            stroke="#1a1a1a"
            strokeWidth="1.6"
            strokeLinecap="round"
            markerEnd="url(#lp-wb-arrow)"
          />

          {/* Animated stroke — user sketching architecture */}
          <path
            className="lp-wb-stroke-draw"
            d="M300 148 C 320 132, 348 138, 368 158 C 378 168, 372 188, 352 196"
            stroke="#6366f1"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />

          <ellipse
            cx="320"
            cy="178"
            rx="28"
            ry="20"
            stroke="#1a1a1a"
            strokeWidth="1.6"
            fill="#f5f3ff"
            strokeLinecap="round"
          />
          <text x="302" y="182" fill="#1a1a1a" fontSize="9">
            Postgres
          </text>

          <defs>
            <marker
              id="lp-wb-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#1a1a1a" />
            </marker>
          </defs>
        </svg>

        {/* Live collaborator cursors — anchored near each sketch region */}
        <CollabCursor name="Aarav" color="#ea580c" className="lp-wb-cursor-a" />
        <CollabCursor name="Lina" color="#0284c7" className="lp-wb-cursor-b" />
        <CollabCursor name="Sam" color="#0d9488" className="lp-wb-cursor-c" />
        <CollabCursor name="Riya" color="#7c3aed" className="lp-wb-cursor-d" />
      </div>
    </div>
  );
}

const WB_TOOL_ICONS = {
  hand: Hand,
  select: MousePointer2,
  pen: Pencil,
  rectangle: Square,
  arrow: ArrowRight,
  text: Type,
  eraser: Eraser,
} as const;

function ToolBtn({
  icon,
  active = false,
}: {
  icon: keyof typeof WB_TOOL_ICONS;
  active?: boolean;
}) {
  const Icon = WB_TOOL_ICONS[icon];
  return (
    <div
      className={`grid h-6 w-6 place-items-center rounded-md ${
        active ? "bg-violet-100 ring-1 ring-violet-200" : "hover:bg-paper-deep"
      }`}
    >
      <Icon className="h-3.5 w-3.5 text-ink" strokeWidth={1.75} aria-hidden />
    </div>
  );
}

function CollabCursor({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className: string;
}) {
  return (
    <div className={`absolute z-10 ${className}`}>
      <svg width="18" height="20" viewBox="0 0 18 20" fill="none" aria-hidden>
        <path
          d="M1 1L1 14.5L5.2 10.8L8.5 18.5L11 17.2L7.8 9.5L14 9.5L1 1Z"
          fill={color}
          stroke="#fff"
          strokeWidth="1.2"
        />
      </svg>
      <span
        className="ml-3 -mt-1 inline-block rounded px-1.5 py-0.5 text-[8.5px] font-semibold text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </div>
  );
}

function SidebarItem({
  label,
  icon,
  active = false,
}: {
  label: string;
  icon: "grid" | "briefcase" | "cog" | "pen";
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
        active ? "bg-paper text-ink shadow-sm" : "text-ink-soft"
      }`}
    >
      <SidebarIcon name={icon} />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function SidebarIcon({ name }: { name: "grid" | "briefcase" | "cog" | "pen" }) {
  const cls = "h-3.5 w-3.5";
  if (name === "grid")
    return (
      <svg viewBox="0 0 18 18" fill="none" className={cls} stroke="currentColor" strokeWidth="1.4">
        <rect x="2" y="2" width="5.5" height="5.5" rx="1.2" />
        <rect x="10.5" y="2" width="5.5" height="5.5" rx="1.2" />
        <rect x="2" y="10.5" width="5.5" height="5.5" rx="1.2" />
        <rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1.2" />
      </svg>
    );
  if (name === "briefcase")
    return (
      <svg viewBox="0 0 18 18" fill="none" className={cls} stroke="currentColor" strokeWidth="1.4">
        <rect x="2.5" y="5" width="13" height="10" rx="1.5" />
        <path d="M6.5 5V3.8A1.3 1.3 0 0 1 7.8 2.5h2.4a1.3 1.3 0 0 1 1.3 1.3V5M2.5 9h13" />
      </svg>
    );
  if (name === "pen")
    return (
      <svg viewBox="0 0 18 18" fill="none" className={cls} stroke="currentColor" strokeWidth="1.4">
        <path d="M11.5 3.5l3 3L6.5 14.5 2.5 15.5l1-4L11.5 3.5z" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 18 18" fill="none" className={cls} stroke="currentColor" strokeWidth="1.4">
      <circle cx="9" cy="9" r="2.2" />
      <path d="M9 2.2v1.8M9 14v1.8M2.2 9h1.8M14 9h1.8M4.1 4.1l1.3 1.3M12.6 12.6l1.3 1.3M13.9 4.1l-1.3 1.3M5.4 12.6l-1.3 1.3" />
    </svg>
  );
}

function SidebarWorkspace({
  name,
  tasks,
  active = false,
}: {
  name: string;
  tasks: number;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
        active ? "bg-paper text-ink shadow-sm" : "text-ink-soft"
      }`}
    >
      <span className="grid h-4 w-4 place-items-center rounded-sm bg-paper-deep text-[9px] font-semibold text-ink">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="flex-1 truncate font-medium">{name}</span>
      <span className="rounded bg-paper-deep px-1 py-px font-mono text-[8.5px] font-semibold text-ink-soft">
        {tasks}
      </span>
    </div>
  );
}

function AvatarStack() {
  const a = [
    { i: "A", cls: "bg-orange-100 text-orange-700" },
    { i: "L", cls: "bg-sky-100 text-sky-700" },
    { i: "R", cls: "bg-violet-100 text-violet-700" },
    { i: "S", cls: "bg-teal-100 text-teal-700" },
  ];
  return (
    <div className="flex -space-x-1.5">
      {a.map((x) => (
        <span
          key={x.i}
          className={`grid h-5 w-5 place-items-center rounded-full text-[9.5px] font-semibold ring-2 ring-shell ${x.cls}`}
        >
          {x.i}
        </span>
      ))}
    </div>
  );
}

function KanbanColumn({
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
    <section className={`rounded-xl p-2 sm:p-2.5 ${tint} ${className}`}>
      <header className="mb-2 flex items-center gap-1.5 px-1">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <h4 className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink">
          {label}
        </h4>
      </header>
      <div className="flex flex-col gap-1.5 sm:gap-2">{children}</div>
    </section>
  );
}

function KCard({ card, highlight = false }: { card: Card; highlight?: boolean }) {
  return (
    <article
      className={`rounded-lg border border-line bg-card p-2 shadow-sm transition ${
        highlight ? "ring-1 ring-orange-400/40" : ""
      }`}
    >
      <div className="flex min-w-0 items-start gap-1">
        <span
          className={`max-w-[58%] truncate rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-wide ${card.chipCls}`}
        >
          {card.chip}
        </span>
        <span
          className={`ml-auto shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide ${card.priorityCls}`}
        >
          {card.priority}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-snug text-ink">
        {card.title}
      </p>
      <div className="mt-1.5 flex items-start justify-between gap-1.5">
        <span
          className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8.5px] font-semibold ${card.assignee.cls}`}
        >
          {card.assignee.initial}
        </span>
        <span className="min-w-0 flex-1 text-right font-mono text-[8px] leading-tight text-ink-faint">
          {card.attachments && (
            <span className="inline-flex items-center justify-end gap-0.5">
              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 shrink-0" stroke="currentColor" strokeWidth="1.2">
                <path d="M8 3.5 4.3 7.2a1.2 1.2 0 0 0 1.7 1.7L9.7 5.2a2.4 2.4 0 1 0-3.4-3.4L2.5 5.6a3.6 3.6 0 0 0 5.1 5.1l2.6-2.6" />
              </svg>
              {card.attachments}
            </span>
          )}
          {card.attachments && card.due && <span className="mx-0.5">·</span>}
          {card.due && <span>{card.due}</span>}
        </span>
      </div>
    </article>
  );
}
