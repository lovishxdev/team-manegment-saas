import { listSidebarWorkspaces } from "@/lib/services/workspace";

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

const NAV_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "me",
  "my",
  "can",
  "you",
  "take",
  "go",
  "get",
  "show",
  "open",
  "find",
  "page",
  "of",
  "for",
  "in",
  "on",
  "at",
  "please",
  "i",
  "want",
  "need",
  "where",
  "is",
  "how",
  "do",
  "navigate",
  "workspace",
]);

export function tokenizeNavQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,.:;!?]+/)
    .map((token) => token.replace(/^[^\w]+|[^\w]+$/g, ""))
    .filter((token) => token.length >= 2 && !NAV_STOPWORDS.has(token));
}

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
      keywords: [
        "settings",
        "invite",
        "invites",
        "members",
        "team",
        "rename workspace",
      ],
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

/** Find a workspace whose name appears in the query (longest match wins). */
export async function findWorkspaceMentionInQuery(
  userId: string,
  query: string
): Promise<{ workspaceId: string; workspaceName: string } | null> {
  const memberships = await listSidebarWorkspaces(userId);
  const q = query.toLowerCase();
  let best: { workspaceId: string; workspaceName: string; len: number } | null =
    null;

  for (const membership of memberships) {
    const name = membership.workspace.name.toLowerCase();
    if (!q.includes(name)) continue;
    if (!best || name.length > best.len) {
      best = {
        workspaceId: membership.workspace.id,
        workspaceName: membership.workspace.name,
        len: name.length,
      };
    }
  }

  return best
    ? { workspaceId: best.workspaceId, workspaceName: best.workspaceName }
    : null;
}

function scoreNavEntry(
  entry: AppNavEntry,
  tokens: string[],
  fullQuery: string
): number {
  let score = 0;
  const label = entry.label.toLowerCase();
  const desc = entry.description.toLowerCase();
  const topic = entry.topic.toLowerCase();

  for (const token of tokens) {
    if (label.includes(token)) score += 3;
    if (topic.includes(token)) score += 2;
    if (desc.includes(token)) score += 1;
    if (entry.keywords.some((kw) => kw.includes(token) || token.includes(kw))) {
      score += 2;
    }
  }

  if (label.includes(fullQuery) || desc.includes(fullQuery)) score += 5;

  return score;
}

export function searchAppNavigation(
  catalog: AppNavEntry[],
  query?: string,
  options?: { workspaceResolved?: boolean }
): AppNavEntry[] {
  const q = query?.trim().toLowerCase();
  if (!q) return catalog;

  const tokens = tokenizeNavQuery(q);
  const mentionsWorkspace =
    /\bworkspace\b/.test(q) || Boolean(options?.workspaceResolved);
  const wantsSettings = tokens.some((token) =>
    ["settings", "setting", "invite", "invites", "members"].includes(token)
  );
  const wantsAccount =
    tokens.includes("account") ||
    tokens.includes("profile") ||
    (wantsSettings && !mentionsWorkspace);

  if (wantsSettings && mentionsWorkspace) {
    const workspaceSettings = catalog.filter(
      (entry) => entry.topic === "workspace_settings"
    );
    if (workspaceSettings.length > 0) return workspaceSettings;
  }

  if (wantsAccount) {
    const accountSettings = catalog.filter((entry) => entry.topic === "settings");
    if (accountSettings.length > 0) return accountSettings;
  }

  const scored = catalog
    .map((entry) => ({ entry, score: scoreNavEntry(entry, tokens, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.map(({ entry }) => entry);
  }

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
