import type { WorkspaceTab } from "@/components/layout/app-shell-shared";

export const WORKSPACE_TAB_LINKS: {
  id: WorkspaceTab;
  label: string;
  path: string;
}[] = [
  { id: "board", label: "Overview", path: "" },
  { id: "discussion", label: "Discussion", path: "/discussion" },
  { id: "memory", label: "Memory", path: "/memory" },
  { id: "links", label: "Links", path: "/links" },
  { id: "assets", label: "Assets", path: "/assets" },
  { id: "whiteboard", label: "Whiteboard", path: "/whiteboard" },
  { id: "settings", label: "Settings", path: "/settings" },
];

export function workspaceTabFromPathname(pathname: string): WorkspaceTab {
  if (pathname.includes("/discussion")) return "discussion";
  if (pathname.endsWith("/memory")) return "memory";
  if (pathname.endsWith("/links")) return "links";
  if (pathname.endsWith("/assets")) return "assets";
  if (pathname.endsWith("/settings")) return "settings";
  if (pathname.endsWith("/whiteboard")) return "whiteboard";
  return "board";
}

export function parseWorkspaceRoute(pathname: string): {
  workspaceId: string;
  tab: WorkspaceTab;
} | null {
  const match = pathname.match(
    /^\/w\/([^/]+)(?:\/(discussion(?:\/[^/]+)?|memory|links|assets|whiteboard|settings))?/
  );
  if (!match) return null;
  const segment = match[2];
  const tab: WorkspaceTab = segment?.startsWith("discussion")
    ? "discussion"
    : ((segment as WorkspaceTab | undefined) ?? "board");
  return {
    workspaceId: match[1],
    tab,
  };
}
