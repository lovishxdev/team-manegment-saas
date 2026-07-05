/** Shared layout tokens/types safe for client + server (no Prisma imports). */

export type WorkspaceTab =
  | "board"
  | "memory"
  | "links"
  | "assets"
  | "whiteboard"
  | "settings";

/** Top padding shared by sidebar brand and main content so rows align. */
export const SHELL_TOP = "pt-10";

/** Horizontal inset — sidebar brand + nav. */
export const SHELL_SIDEBAR_X = "px-4 lg:px-5";

/** Horizontal inset — main column content. */
export const SHELL_MAIN_X = "px-6 sm:px-8";

/** Matches the 39px logo — breadcrumb row uses the same height for vertical alignment. */
export const SHELL_BRAND_ROW = "flex h-[39px] shrink-0 items-center";
