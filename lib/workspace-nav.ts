import type { WorkspaceTab } from "@/components/layout/app-shell-shared";

export const WORKSPACE_TAB_LINKS: {
  id: WorkspaceTab;
  label: string;
  path: string;
}[] = [
  { id: "board", label: "Overview", path: "" },
  { id: "memory", label: "Memory", path: "/memory" },
  { id: "links", label: "Links", path: "/links" },
  { id: "assets", label: "Assets", path: "/assets" },
  { id: "whiteboard", label: "Whiteboard", path: "/whiteboard" },
  { id: "settings", label: "Settings", path: "/settings" },
];

export function workspaceTabFromPathname(pathname: string): WorkspaceTab {
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
    /^\/w\/([^/]+)(?:\/(memory|links|assets|whiteboard|settings))?/
  );
  if (!match) return null;
  return {
    workspaceId: match[1],
    tab: (match[2] as WorkspaceTab | undefined) ?? "board",
  };
}
