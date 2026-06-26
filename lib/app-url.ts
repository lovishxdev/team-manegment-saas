/**
 * Sync app origin for webhooks and background jobs (no request headers).
 * Prefer NEXT_PUBLIC_APP_URL; fall back to VERCEL_URL in production.
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export function workspaceUrl(workspaceId: string): string {
  return `${getAppBaseUrl()}/w/${workspaceId}`;
}

export function taskUrl(workspaceId: string, shortId: number): string {
  return `${workspaceUrl(workspaceId)}?task=${shortId}`;
}
