/**
 * Shared class recipes for the Euclis light dashboard design language.
 */

/** Border, hover lift, and focus ring — used by inputs, selects, and focus-within rows. */
const fieldSurface =
  "rounded-lg border border-line bg-paper outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 " +
  "hover:-translate-y-px hover:border-ink/30 hover:bg-white hover:shadow-[0_4px_14px_rgba(26,26,26,0.1),0_0_0_1px_rgba(26,26,26,0.05)] " +
  "focus:-translate-y-px focus:border-ink/40 focus:bg-white focus:shadow-[0_4px_16px_rgba(26,26,26,0.1),0_0_0_4px_rgba(26,26,26,0.12)] " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:bg-paper disabled:hover:shadow-none";

export const ui = {
  focusRing: `${fieldSurface} focus:ring-0`,
  focusWithin:
    `${fieldSurface} focus-within:-translate-y-px focus-within:border-ink/40 focus-within:bg-white focus-within:shadow-[0_4px_16px_rgba(26,26,26,0.1),0_0_0_4px_rgba(26,26,26,0.12)] focus-within:ring-0`,
  input:
    `w-full px-3.5 py-3 text-[15px] leading-snug text-ink placeholder:text-ink-faint ${fieldSurface} focus:ring-0`,
  /** Prominent single-line fields (task title, workspace name). */
  inputLg:
    `w-full px-4 py-3.5 text-base font-medium leading-snug text-ink placeholder:text-ink-faint placeholder:font-normal ${fieldSurface} focus:ring-0`,
  /** @deprecated Use `<Select />` from `@/components/ui/select` instead. */
  select:
    `px-3.5 py-3 text-[15px] text-ink-soft ${fieldSurface} focus:ring-0`,
  label:
    "mb-2 block text-sm font-medium text-ink",
  fieldHint: "mt-1.5 text-sm text-ink-soft",
  /** Input + button row — wrap the field in `inputRowField` so `w-full` inputs don't overlap the button. */
  inputRow: "flex items-start gap-2",
  inputRowField: "min-w-0 flex-1",
  btnShrink:
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap min-w-[5.5rem]",
  btnPrimary:
    "inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-[background-color,box-shadow,transform] duration-150 hover:bg-ink/90 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm disabled:active:scale-100",
  btnSecondary:
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-line-strong bg-paper px-3.5 py-2 text-sm text-ink-soft shadow-sm transition-[border-color,color,box-shadow,transform] duration-150 hover:border-ink/20 hover:bg-white hover:text-ink hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm disabled:active:scale-100",
  btnDanger:
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60",
  btnGhostDanger:
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-line-strong px-3.5 py-2 text-sm text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60",
  card: "rounded-2xl bg-paper shadow-sm",
  /** Solid paper section on the shell canvas (settings, forms). */
  contentPanel: "content-panel",
  /** @deprecated Use class `dashboard-panel` from globals.css */
  dashboardPanel: "dashboard-panel",
  /** Frosted glass surface (sidebar, mobile header). */
  shellGlass: "shell-glass",
  /** Sidebar nav row */
  navItem:
    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] transition-[color,background-color,box-shadow] duration-150 text-ink-soft hover:bg-white/60 hover:text-ink",
  navItemActive:
    "bg-white font-medium text-ink shadow-[0_1px_3px_rgba(26,26,26,0.06),0_0_0_1px_rgba(26,26,26,0.04)]",
  /** Workspace sub-nav row (indented) */
  navSubItem:
    "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[14px] transition-[color,background-color,box-shadow] duration-150 text-ink-soft hover:bg-white/60 hover:text-ink",
  navSubItemActive:
    "bg-white font-medium text-ink shadow-[0_1px_3px_rgba(26,26,26,0.06),0_0_0_1px_rgba(26,26,26,0.04)]",
  /** Underline workspace tabs */
  tabItem:
    "relative shrink-0 cursor-pointer px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink",
  tabItemActive:
    "text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-ink",
  pageSubtitle: "mt-1.5 text-sm text-ink-soft",
  sectionTitle: "text-sm font-semibold text-ink",
  /** Settings / form pages — bridges workspace shell title and field labels. */
  settingsSectionTitle:
    "text-base font-semibold tracking-tight text-ink sm:text-[1.0625rem]",
  breadcrumbNav:
    "flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-ink-faint",
  breadcrumbLink: "transition hover:text-ink-soft",
  breadcrumbCurrent: "truncate text-ink-soft",
  /** Workspace name in tab chrome and matching drill-in pages. */
  workspaceTitle:
    "text-[2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.25rem]",
  errorText: "text-sm text-red-600",
  successText: "text-sm text-emerald-700",
  linkText: "text-ink underline-offset-2 hover:underline",
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
