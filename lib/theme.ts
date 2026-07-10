export const THEME_COOKIE = "euclis_theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function parseThemeCookie(
  value: string | undefined | null,
): ThemePreference {
  return isThemePreference(value) ? value : "system";
}

/**
 * Blocking inline script placed in the document <head>. It resolves the
 * effective theme (cookie -> light/dark, or system -> matchMedia) and sets
 * `document.documentElement.dataset.theme` before first paint, so there is no
 * flash — including for the `system` case which can't be known server-side.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var p=m?decodeURIComponent(m[1]):"system";if(p!=="light"&&p!=="dark"&&p!=="system")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;
