import Image from "next/image";
import { Globe } from "lucide-react";
import type { ComponentType } from "react";
import { ClaudeIcon } from "@/components/brand/claude-icon";
import { CursorIcon } from "@/components/brand/cursor-icon";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";

/**
 * The hybrid anchor element for the scroll story: a live Euclis discussion on
 * the left where multiple surfaces and agents (Web, WhatsApp, Cursor, Claude
 * Code, Claude) contribute, and a "Project memory" panel on the right that
 * fills with structured records as those contributions are captured.
 *
 * Everything is driven by the `chapter` prop — items reveal as the story
 * advances; all motion is CSS.
 */

type SourceKey = "web" | "whatsapp" | "cursor" | "claudecode" | "claude";

const SOURCES: Record<
  SourceKey,
  { label: string; chip: string; avatar: string; Icon: ComponentType<{ className?: string }> }
> = {
  web: {
    label: "Web",
    chip: "bg-sky-50 text-sky-700",
    avatar: "bg-sky-100 text-sky-700",
    Icon: Globe,
  },
  whatsapp: {
    label: "WhatsApp",
    chip: "bg-[#DCF8C6] text-[#0f7a63]",
    avatar: "bg-[#25D366]/15 text-[#25D366]",
    Icon: WhatsAppIcon,
  },
  cursor: {
    label: "Cursor",
    chip: "bg-ink/[0.07] text-ink",
    avatar: "bg-paper-deep",
    Icon: CursorIcon,
  },
  claudecode: {
    label: "Claude Code",
    chip: "bg-[#f4e7d6] text-[#b0562f]",
    avatar: "bg-[#d97757]/12 text-claude",
    Icon: ClaudeIcon,
  },
  claude: {
    label: "Claude",
    chip: "bg-[#f4e7d6] text-[#b0562f]",
    avatar: "bg-[#d97757]/12 text-claude",
    Icon: ClaudeIcon,
  },
};

type FeedItem = {
  from: number;
  who: string;
  source: SourceKey;
  text: string;
  agent?: boolean;
  initial?: string;
  tint?: string;
  /** Portrait for human contributors. */
  img?: string;
  /** Chapter at which a "captured to memory" cue appears. */
  capturedAt?: number;
};

const FEED: FeedItem[] = [
  {
    from: 0,
    who: "Lina",
    source: "web",
    img: "/avatars/lina.jpg",
    text: "Let's go with Supabase Auth — custom JWT is a rabbit hole.",
    capturedAt: 2,
  },
  {
    from: 0,
    who: "Aarav",
    source: "whatsapp",
    img: "/avatars/aarav.jpg",
    text: "Agreed. But realtime won't work until we set the RLS publication on deploy.",
    capturedAt: 2,
  },
  {
    from: 2,
    who: "Cursor agent",
    source: "cursor",
    agent: true,
    text: "Recorded a decision from this coding session: adopt Supabase Auth.",
    capturedAt: 2,
  },
  {
    from: 3,
    who: "Claude Code",
    source: "claudecode",
    agent: true,
    text: "Flagging a blocker — RLS publication is required before the beta ships.",
    capturedAt: 3,
  },
  {
    from: 4,
    who: "@euclis",
    source: "claude",
    agent: true,
    text: "Pulled project context: 6 decisions, 1 open blocker. Everyone's in sync.",
  },
];

type EventKind = "DECISION" | "BLOCKER" | "DEPENDENCY" | "MILESTONE" | "INSIGHT";

const KIND_STYLE: Record<EventKind, string> = {
  DECISION: "bg-violet-50 text-violet-700",
  BLOCKER: "bg-rose-50 text-rose-700",
  DEPENDENCY: "bg-amber-50 text-amber-700",
  MILESTONE: "bg-emerald-50 text-emerald-700",
  INSIGHT: "bg-sky-50 text-sky-700",
};

type MemoryEvent = {
  from: number;
  kind: EventKind;
  title: string;
  meta: string;
  superseded?: boolean;
};

const MEMORY: MemoryEvent[] = [
  { from: 2, kind: "DECISION", title: "Adopt Supabase Auth, drop custom JWT", meta: "@lina · Web" },
  { from: 2, kind: "BLOCKER", title: "Set RLS publication on deploy", meta: "Claude Code" },
  { from: 3, kind: "DEPENDENCY", title: "Beta launch waits on billing sign-off", meta: "#42 · Web" },
  { from: 3, kind: "MILESTONE", title: "Closed beta live for 12 teams", meta: "@aarav · WhatsApp" },
  { from: 4, kind: "INSIGHT", title: "Auth keeps getting relitigated — worth a spec", meta: "dream cycle" },
];

function SourceChip({ source }: { source: SourceKey }) {
  const s = SOURCES[source];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${s.chip}`}
    >
      <s.Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}

export function WorkspaceMemoryStage({ chapter }: { chapter: number }) {
  const feed = FEED.filter((f) => chapter >= f.from);
  const records = MEMORY.filter((e) => chapter >= e.from);
  const agentReading = chapter >= 4;

  return (
    <div
      className="lp-wms overflow-hidden rounded-2xl border border-line bg-shell shadow-[0_40px_120px_-40px_rgba(20,20,30,0.28)]"
      data-chapter={chapter}
    >
      {/* window chrome */}
      <div className="flex items-center gap-2.5 border-b border-line bg-paper-deep/50 px-4 py-3 sm:px-5">
        <span className="size-3 rounded-full bg-rose-300/80" />
        <span className="size-3 rounded-full bg-amber-300/80" />
        <span className="size-3 rounded-full bg-emerald-300/80" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr]">
        {/* LEFT: multi-source discussion */}
        <div className="min-w-0 border-b border-line bg-shell px-6 py-6 sm:border-b-0 sm:border-r">
          <div className="mb-5 flex items-center justify-between">
            <div className="min-w-0">
              <h4 className="text-[19px] font-semibold tracking-tight text-ink">
                Discussion
              </h4>
              <p className="mt-1 text-[13px] text-ink-soft">Q3 auth &amp; beta</p>
            </div>
            <span className="rounded-full bg-paper-deep px-3 py-1 font-mono text-[11px] font-semibold text-ink-soft">
              5 surfaces
            </span>
          </div>

          <ul className="space-y-3.5">
            {feed.map((f) => {
              const s = SOURCES[f.source];
              return (
                <li
                  key={f.who}
                  className={`lp-wms-in flex gap-3 rounded-lg p-2.5 ${
                    f.agent
                      ? "bg-gradient-to-br from-amber-50/60 to-transparent"
                      : ""
                  }`}
                >
                  {f.agent ? (
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${s.avatar}`}
                    >
                      <s.Icon className="h-[22px] w-[22px]" />
                    </span>
                  ) : f.img ? (
                    <Image
                      src={f.img}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-line/70"
                    />
                  ) : (
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-semibold ${f.tint}`}
                    >
                      {f.initial}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-ink">
                        {f.who}
                      </span>
                      <SourceChip source={f.source} />
                    </div>
                    <p className="mt-1 text-[15px] leading-snug text-ink-soft">
                      {f.text}
                    </p>
                  </div>
                </li>
              );
            })}

            {chapter < 2 ? (
              <li className="flex items-center gap-3 p-2.5">
                <Image
                  src="/avatars/maya.jpg"
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-line/70"
                />
                <span className="lp-typing" aria-label="Maya is typing">
                  <i />
                  <i />
                  <i />
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        {/* RIGHT: project memory */}
        <div className="min-w-0 bg-paper/60 px-6 py-6">
          <div className="mb-5 flex flex-nowrap items-center justify-between gap-2">
            <h4 className="truncate text-[19px] font-semibold tracking-tight text-ink">
              Project memory
            </h4>
            {agentReading ? (
              <span className="lp-wms-agent inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                reading
              </span>
            ) : records.length ? (
              <span className="shrink-0 rounded-full bg-paper-deep px-3 py-1 font-mono text-[11px] font-semibold text-ink-soft">
                {records.length}
              </span>
            ) : null}
          </div>

          {records.length === 0 ? (
            <div className="lp-mem-empty flex h-[268px] flex-col items-center justify-center rounded-lg border border-dashed border-line px-4 text-center">
              <span className="lp-mem-radar" aria-hidden />
              <p className="relative text-[15px] font-medium text-ink-soft">
                Listening for decisions…
              </p>
              <p className="relative mt-1.5 text-[13px] leading-snug text-ink-faint">
                Still buried in the thread
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {records.map((e) => (
                <li
                  key={e.title}
                  className={`lp-wms-in rounded-lg border border-line bg-card p-3 shadow-sm ${
                    e.superseded ? "opacity-55" : ""
                  }`}
                >
                  <span
                    className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${KIND_STYLE[e.kind]}`}
                  >
                    {e.kind}
                  </span>
                  <p
                    className={`mt-1.5 text-[15px] font-medium leading-snug text-ink ${
                      e.superseded ? "line-through decoration-ink-faint/50" : ""
                    }`}
                  >
                    {e.title}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-ink-faint">
                    {e.meta}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
