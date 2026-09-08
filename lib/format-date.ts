/** Fixed English short months — Node ICU can emit "Sept" while browsers emit "Sep". */
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Day + short month, e.g. "22 Sep". Deterministic across SSR and client
 * (avoids en-GB ICU Sept/Sep hydration mismatches).
 */
export function formatDayMonth(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** Day + short month + year, e.g. "22 Sep 2026". */
export function formatDayMonthYear(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
