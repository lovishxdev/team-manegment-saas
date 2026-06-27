function originFromHostOrUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Sync app origin for webhooks and background jobs (no request headers).
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL — explicit (local dev, ngrok, or custom domain)
 * 2. VERCEL_PROJECT_PRODUCTION_URL — production custom domain on Vercel
 * 3. VERCEL_URL — deployment-specific URL (last resort)
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return originFromHostOrUrl(explicit);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return originFromHostOrUrl(production);

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return originFromHostOrUrl(deployment);

  return "http://localhost:3000";
}

export function workspaceUrl(workspaceId: string): string {
  return `${getAppBaseUrl()}/w/${workspaceId}`;
}

export function taskUrl(workspaceId: string, shortId: number): string {
  return `${workspaceUrl(workspaceId)}?task=${shortId}`;
}
