/**
 * Shared class recipes for the Euclis "Kinetic Intelligence" design language.
 * Dark tonal surfaces, 1px borders, mint focus states, sharp-technical radii.
 * Keep visual decisions here so every form/button stays consistent.
 */
export const ui = {
  input:
    "w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/15",
  select:
    "rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink-soft outline-none transition focus:border-accent/60",
  label:
    "mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-ink-faint",
  btnPrimary:
    "rounded-md bg-white px-4 py-2.5 font-mono text-xs font-medium tracking-wide text-black transition hover:bg-white/85 disabled:opacity-50",
  btnSecondary:
    "rounded-md border border-line-strong bg-transparent px-3.5 py-2 text-sm text-ink-soft transition hover:border-ink/50 hover:text-ink disabled:opacity-50",
  btnDanger:
    "rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-50",
  btnGhostDanger:
    "rounded-md border border-line-strong px-3.5 py-2 text-sm text-ink-soft transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-50",
  card: "rounded-lg border border-line bg-card",
  errorText: "text-sm text-red-300",
  mutedText: "text-sm text-ink-soft",
};

/** Deterministic avatar tints (low-opacity fills on dark surfaces). */
const AVATAR_COLORS = [
  "bg-orange-400/20 text-orange-300",
  "bg-amber-400/20 text-amber-300",
  "bg-lime-400/20 text-lime-300",
  "bg-teal-400/20 text-teal-300",
  "bg-sky-400/20 text-sky-300",
  "bg-violet-400/20 text-violet-300",
  "bg-rose-400/20 text-rose-300",
];

/* Low-opacity status tints for free-form task tags (board cards + modal). */
const TAG_COLORS = [
  "bg-blue-400/15 text-blue-300",
  "bg-orange-400/15 text-orange-300",
  "bg-emerald-400/15 text-emerald-300",
  "bg-violet-400/15 text-violet-300",
  "bg-pink-400/15 text-pink-300",
  "bg-teal-400/15 text-teal-300",
  "bg-amber-400/15 text-amber-300",
  "bg-indigo-400/15 text-indigo-300",
];

/** Deterministic tint recipe for a tag, stable across renders and users. */
export function tagColor(tag: string): string {
  let hash = 0;
  const key = tag.toLowerCase();
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function Avatar({
  seed,
  label,
  size = "h-6 w-6 text-[10px]",
}: {
  /** Stable id used to pick the color. */
  seed: string;
  /** Email or name; first letter becomes the initial. */
  label: string | null;
  size?: string;
}) {
  const initial = (label ?? "?").charAt(0).toUpperCase();
  return (
    <span
      title={label ?? undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${size} ${avatarColor(seed)}`}
    >
      {initial}
    </span>
  );
}
