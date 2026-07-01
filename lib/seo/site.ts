import { getAppBaseUrl } from "@/lib/app-url";

export const SITE_NAME = "Euclis";

export const SITE_TAGLINE = "Where your team's work flows together";

export const DEFAULT_DESCRIPTION =
  "Free team task board for small groups. Manage kanban tasks from the web, WhatsApp, or Claude MCP — one board, real-time sync. No credit card. Built for hackathons, side projects, and study groups.";

export const HOME_TITLE =
  "Euclis | Free team task board — web, WhatsApp & Claude";

export const HOME_DESCRIPTION =
  "A free shared task board your team can reach from the web dashboard, WhatsApp, or Claude MCP. Real-time kanban sync for hackathons, side projects, hostel groups, and study teams. No credit card required.";

export function siteUrl(path = ""): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
