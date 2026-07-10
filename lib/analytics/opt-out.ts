/**
 * Server-side allowlist for excluding specific users from analytics.
 *
 * Resolved once per session from env (no DB call, no per-event checks). The
 * result is handed to the client identify component, which calls PostHog's
 * `opt_out_capturing()` — so excluded users add zero runtime overhead.
 *
 *   POSTHOG_OPT_OUT_USER_IDS=uuid1,uuid2
 *   POSTHOG_OPT_OUT_EMAILS=me@team.com,ops@team.com
 */
function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAnalyticsOptOut(
  userId: string,
  email: string | null
): boolean {
  const ids = parseList(process.env.POSTHOG_OPT_OUT_USER_IDS);
  if (ids.includes(userId.toLowerCase())) return true;

  if (email) {
    const emails = parseList(process.env.POSTHOG_OPT_OUT_EMAILS);
    if (emails.includes(email.toLowerCase())) return true;
  }

  return false;
}
