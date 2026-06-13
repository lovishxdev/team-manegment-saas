/** Shared layout tokens/types safe for client + server (no Prisma imports). */

export type WorkspaceTab = "board" | "members" | "assets" | "whiteboard";

/** Top padding shared by sidebar brand and main content so rows align. */
export const SHELL_TOP = "pt-10";

/** Matches the 39px logo — breadcrumb row uses the same height for vertical alignment. */
export const SHELL_BRAND_ROW = "flex h-[39px] items-center";
