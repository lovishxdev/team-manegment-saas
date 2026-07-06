export type AppNavTopic =
  | "dashboard"
  | "settings"
  | "workspace_overview"
  | "workspace_memory"
  | "workspace_links"
  | "workspace_assets"
  | "workspace_whiteboard"
  | "workspace_settings"
  | "create_workspace"
  | "integrations";

export type AppNavEntry = {
  topic: AppNavTopic;
  label: string;
  description: string;
  path: string;
  keywords: string[];
};

export function workspacePath(
  workspaceId: string,
  tab?: "memory" | "links" | "assets" | "whiteboard" | "settings"
): string {
  if (!tab) return `/w/${workspaceId}`;
  return `/w/${workspaceId}/${tab}`;
}

export function buildAppNavCatalog(
  workspaceId: string | null,
  workspaceName: string | null
): AppNavEntry[] {
  const wsLabel = workspaceName ?? "your workspace";
  const wsId = workspaceId ?? "{workspaceId}";

  return [
    {
      topic: "dashboard",
      label: "Dashboard",
      description: "Home — all workspaces, search, and assigned tasks.",
      path: "/dashboard",
      keywords: ["home", "workspaces", "search", "greeting"],
    },
    {
      topic: "settings",
      label: "Account settings",
      description: "Profile, integrations (WhatsApp, Claude MCP), and account.",
      path: "/settings",
      keywords: ["profile", "account", "whatsapp", "mcp", "integrations"],
    },
    {
      topic: "create_workspace",
      label: "New workspace",
      description:
        "Create a workspace from the sidebar “New workspace” button (modal).",
      path: "/dashboard",
      keywords: ["create", "new workspace", "project", "team"],
    },
    {
      topic: "workspace_overview",
      label: `${wsLabel} — board`,
      description: "Kanban board (Overview tab) for tasks.",
      path: workspacePath(wsId),
      keywords: ["board", "kanban", "tasks", "overview"],
    },
    {
      topic: "workspace_memory",
      label: `${wsLabel} — memory`,
      description: "Recorded decisions, blockers, and project memory.",
      path: workspacePath(wsId, "memory"),
      keywords: ["memory", "decisions", "blockers"],
    },
    {
      topic: "workspace_links",
      label: `${wsLabel} — links`,
      description: "Saved bookmarks and URLs for the team.",
      path: workspacePath(wsId, "links"),
      keywords: ["links", "bookmarks", "urls"],
    },
    {
      topic: "workspace_assets",
      label: `${wsLabel} — assets`,
      description: "Uploaded files and images.",
      path: workspacePath(wsId, "assets"),
      keywords: ["assets", "files", "uploads", "images"],
    },
    {
      topic: "workspace_whiteboard",
      label: `${wsLabel} — whiteboard`,
      description: "Collaborative whiteboard.",
      path: workspacePath(wsId, "whiteboard"),
      keywords: ["whiteboard", "diagram", "drawing"],
    },
    {
      topic: "workspace_settings",
      label: `${wsLabel} — settings`,
      description: "Workspace members, invites, and rename.",
      path: workspacePath(wsId, "settings"),
      keywords: ["invite", "members", "team", "rename workspace"],
    },
    {
      topic: "integrations",
      label: "Integrations",
      description: "Link WhatsApp or connect Claude via MCP.",
      path: "/settings",
      keywords: ["whatsapp", "claude", "mcp", "connect"],
    },
  ];
}

export function parseWorkspaceIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/w\/([^/]+)/);
  return match?.[1] ?? null;
}

export function searchAppNavigation(
  catalog: AppNavEntry[],
  query?: string
): AppNavEntry[] {
  const q = query?.trim().toLowerCase();
  if (!q) return catalog;

  return catalog.filter(
    (entry) =>
      entry.label.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.topic.includes(q) ||
      entry.keywords.some((kw) => kw.includes(q) || q.includes(kw))
  );
}

export function formatAppNavigationResults(entries: AppNavEntry[]): string {
  if (entries.length === 0) {
    return "No matching pages. Try dashboard, settings, board, memory, links, assets, whiteboard, or invites.";
  }

  return entries
    .map(
      (entry) =>
        `• ${entry.label}\n  ${entry.description}\n  Path: ${entry.path}`
    )
    .join("\n\n");
}
