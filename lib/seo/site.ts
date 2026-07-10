import { getAppBaseUrl } from "@/lib/app-url";

export const SITE_NAME = "Euclis";

export const SITE_TAGLINE = "The project brain for your team — and your AI agents";

export const DEFAULT_DESCRIPTION =
  "Euclis is the shared project memory for teams and AI agents. Capture decisions and blockers from WhatsApp, Claude, Cursor, and the web — then keep them current with Dreaming. Free to start.";

export const HOME_TITLE =
  "Euclis | Project memory for teams and AI agents";

export const HOME_DESCRIPTION =
  "Context shouldn't live in scrollback. Euclis captures decisions, blockers, and milestones from WhatsApp, Claude, Cursor, and the web — one brief for humans and agents. Free to start, no credit card.";

export function siteUrl(path = ""): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
