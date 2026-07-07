/** Shared layout tokens/types safe for client + server (no Prisma imports). */

export type WorkspaceTab =
  | "board"
  | "discussion"
  | "memory"
  | "links"
  | "assets"
  | "whiteboard"
  | "settings";

/** Fixed height for sidebar / collapsed top bar — keeps logo position stable. */
export const SHELL_HEADER_H = "h-[62px]";

/** Sidebar widths — must match sidebar-frame. */
export const SHELL_SIDEBAR_W = "w-60 lg:w-64";

/** Top padding on main content when sidebar is expanded (beside the header row). */
export const SHELL_TOP = "pt-6 sm:pt-8";

/** Horizontal inset — sidebar nav body (expanded only; collapsed uses centered icons). */
export const SHELL_SIDEBAR_X = "px-2.5 lg:px-3";

/** Horizontal inset — main column content. */
export const SHELL_MAIN_X = "px-5 sm:px-8 lg:px-10";

/** Max width for primary app content columns. */
export const SHELL_CONTENT_MAX = "mx-auto w-full max-w-6xl";

/** Matches the 36px logo — breadcrumb row uses the same height for vertical alignment. */
export const SHELL_BRAND_ROW = "flex h-9 shrink-0 items-center";
