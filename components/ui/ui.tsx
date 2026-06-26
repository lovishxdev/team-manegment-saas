/**
 * Shared class recipes for the Euclis light dashboard design language.
 */
export const ui = {
  focusRing:
    "outline-none transition focus:border-ink/30 focus:ring-1 focus:ring-ink/10",
  focusWithin:
    "focus-within:border-ink/30 focus-within:ring-1 focus-within:ring-ink/10",
  input:
    "w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none transition focus:border-ink/30 focus:ring-1 focus:ring-ink/10",
  /** @deprecated Use `<Select />` from `@/components/ui/select` instead. */
  select:
    "rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink-soft outline-none transition focus:border-ink/30 focus:ring-1 focus:ring-ink/10",
  label:
    "mb-1.5 block text-xs font-medium text-ink-soft",
  /** Input + button row — wrap the field in `inputRowField` so `w-full` inputs don't overlap the button. */
  inputRow: "flex items-start gap-2",
  inputRowField: "min-w-0 flex-1",
  btnShrink:
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap min-w-[5.5rem]",
  btnPrimary:
    "inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60",
  btnSecondary:
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-line-strong bg-paper px-3.5 py-2 text-sm text-ink-soft transition-colors hover:border-ink/20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60",
  btnGhostDanger:
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-line-strong px-3.5 py-2 text-sm text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60",
  card: "rounded-2xl bg-paper shadow-sm",
  errorText: "text-sm text-red-600",
  mutedText: "text-sm text-ink-soft",
  /** Page title aligned with sidebar brand row */
  pageTitle:
    "m-0 text-[1.75rem] font-semibold leading-none tracking-tight text-ink sm:text-[2.125rem]",
  pageTitleRow: "flex shrink-0 items-start",
};

/** Deterministic avatar tints. */
const AVATAR_COLORS = [
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-lime-100 text-lime-700",
  "bg-teal-100 text-teal-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
];

const TAG_COLORS = [
  "bg-blue-50 text-blue-700",
  "bg-orange-50 text-orange-700",
  "bg-emerald-50 text-emerald-700",
  "bg-violet-50 text-violet-700",
  "bg-pink-50 text-pink-700",
  "bg-teal-50 text-teal-700",
  "bg-amber-50 text-amber-700",
  "bg-indigo-50 text-indigo-700",
];

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
  seed: string;
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
