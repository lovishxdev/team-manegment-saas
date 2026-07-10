import type { LucideIcon } from "lucide-react";
import { MessageCircle, Palette, Plug, Shield, User } from "lucide-react";

export const ACCOUNT_SETTINGS_SECTIONS = [
  "profile",
  "appearance",
  "whatsapp",
  "integrations",
  "account",
] as const;

export type AccountSettingsSection = (typeof ACCOUNT_SETTINGS_SECTIONS)[number];

export type AccountSettingsNavGroup = "settings" | "connect";

export const ACCOUNT_SETTINGS_SECTION_META: Record<
  AccountSettingsSection,
  { title: string; subtitle?: string }
> = {
  profile: {
    title: "Profile",
    subtitle: "Username and how teammates see you on boards.",
  },
  appearance: {
    title: "Appearance",
    subtitle: "Choose how the Euclis app looks on this device.",
  },
  whatsapp: {
    title: "WhatsApp",
    subtitle: "Link your number and chat with the Euclis bot.",
  },
  integrations: {
    title: "Connectors",
    subtitle: "Connect Claude, Cursor, or any MCP client to Euclis.",
  },
  account: {
    title: "Account",
    subtitle: "Irreversible actions for your Euclis account.",
  },
};

export const ACCOUNT_SETTINGS_NAV: {
  id: AccountSettingsSection;
  label: string;
  icon: LucideIcon;
  group: AccountSettingsNavGroup;
  keywords: string[];
}[] = [
  {
    id: "profile",
    label: "Profile",
    icon: User,
    group: "settings",
    keywords: ["username", "email", "general"],
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    group: "settings",
    keywords: ["theme", "dark", "light", "mode", "color"],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    group: "settings",
    keywords: ["phone", "bot", "chat"],
  },
  {
    id: "account",
    label: "Account",
    icon: Shield,
    group: "settings",
    keywords: ["delete", "danger"],
  },
  {
    id: "integrations",
    label: "Connectors",
    icon: Plug,
    group: "connect",
    keywords: ["integrations", "mcp", "cursor", "claude"],
  },
];

export const ACCOUNT_SETTINGS_NAV_GROUPS: {
  id: AccountSettingsNavGroup;
  label: string;
}[] = [
  { id: "settings", label: "Settings" },
  { id: "connect", label: "Connect" },
];

export function parseAccountSettingsSection(
  segments?: string[]
): AccountSettingsSection {
  const slug = segments?.[0];
  if (
    slug === "profile" ||
    slug === "appearance" ||
    slug === "whatsapp" ||
    slug === "integrations" ||
    slug === "account"
  ) {
    return slug;
  }
  return "profile";
}

export function accountSettingsPath(section: AccountSettingsSection): string {
  return section === "profile" ? "/settings" : `/settings/${section}`;
}

export function isAccountSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

export function sectionFromPathname(pathname: string): AccountSettingsSection {
  if (pathname === "/settings") return "profile";
  const match = pathname.match(/^\/settings\/([^/]+)/);
  return parseAccountSettingsSection(match ? [match[1]] : undefined);
}

const SETTINGS_RETURN_KEY = "euclis:settings-return";

/** Call before navigating to account settings so close can return here. */
export function rememberSettingsReturnPath(pathname: string): void {
  if (typeof window === "undefined" || isAccountSettingsPath(pathname)) return;
  sessionStorage.setItem(SETTINGS_RETURN_KEY, pathname);
}

/** Destination after closing account settings (clears stored path). */
export function consumeSettingsReturnPath(): string {
  if (typeof window === "undefined") return "/dashboard";
  const path = sessionStorage.getItem(SETTINGS_RETURN_KEY);
  sessionStorage.removeItem(SETTINGS_RETURN_KEY);
  if (path && !isAccountSettingsPath(path)) return path;
  return "/dashboard";
}
