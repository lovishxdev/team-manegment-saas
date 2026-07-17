"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { ConnectorLogo } from "@/components/brand/connector-logo";
import { AddToCursor } from "@/components/settings/add-to-cursor";
import { McpConnectionList } from "@/components/settings/mcp-connection-list";
import { McpScopeForm } from "@/components/settings/mcp-scope-form";
import { McpWorkspaceForm } from "@/components/settings/mcp-workspace-form";
import { CopyField } from "@/components/ui/copy-field";
import { ui } from "@/components/ui/ui";
import type { AccountSettingsData } from "@/lib/settings/load-account-settings";

type ConnectorTab = "all" | "connected" | "not_connected";

type ConnectorId = "cursor" | "claude" | "claude-code" | "euclis" | "manual";

type ConnectorRow = {
  id: ConnectorId;
  name: string;
  description: string;
  type: string;
  popular?: boolean;
  connected: boolean;
};

function oauthFor(
  connections: AccountSettingsData["mcpOAuthConnections"],
  pattern: "cursor" | "claude" | "claude-code"
) {
  return connections.filter((row) => {
    const name = row.clientName.toLowerCase();
    if (pattern === "cursor") return name.includes("cursor");
    if (pattern === "claude-code") return name.includes("claude code");
    // Claude app: "claude" but not "claude code"
    return name.includes("claude") && !name.includes("claude code");
  });
}

function oauthMatches(
  connections: AccountSettingsData["mcpOAuthConnections"],
  pattern: "cursor" | "claude" | "claude-code"
) {
  return oauthFor(connections, pattern).length > 0;
}

function buildConnectors(data: AccountSettingsData): ConnectorRow[] {
  const hasOAuth = data.mcpOAuthConnections.length > 0;

  return [
    {
      id: "cursor",
      name: "Cursor",
      description: "Coding agents pull project context and post updates.",
      type: "Desktop",
      popular: true,
      connected: oauthMatches(data.mcpOAuthConnections, "cursor"),
    },
    {
      id: "claude",
      name: "Claude",
      description: "Chat with your Euclis workspaces from Claude.",
      type: "Web",
      popular: true,
      connected: oauthMatches(data.mcpOAuthConnections, "claude"),
    },
    {
      id: "claude-code",
      name: "Claude Code",
      description: "Ambient project memory for Claude Code sessions.",
      type: "CLI",
      connected: oauthMatches(data.mcpOAuthConnections, "claude-code"),
    },
    {
      id: "euclis",
      name: "Euclis",
      description: "Custom MCP connector for your account.",
      type: "Web",
      connected: hasOAuth,
    },
    {
      id: "manual",
      name: "Personal token",
      description: "Bearer token scope and workspace pin.",
      type: "API",
      connected: false,
    },
  ];
}

function ConnectButton({
  connected,
  onClick,
  label = "Connect",
}: {
  connected: boolean;
  onClick: () => void;
  label?: string;
}) {
  if (connected) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-emerald-600 transition hover:bg-paper-deep/60"
        title="Manage connection"
      >
        <Check className="h-4 w-4" strokeWidth={2} />
        <span className="text-xs font-medium">Manage</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`${ui.btnSecondary} h-8 px-3 py-0 text-xs`}
    >
      {label}
    </button>
  );
}

function ConnectorDetail({
  id,
  data,
}: {
  id: ConnectorId;
  data: AccountSettingsData;
}) {
  if (id === "cursor") {
    const cursorConnections = oauthFor(data.mcpOAuthConnections, "cursor");
    return (
      <div className="space-y-3 border-t border-line bg-paper-deep/20 px-4 py-4 sm:px-5">
        <AddToCursor mcpUrl={data.mcpConnectorUrl} mcpToken={data.user.mcpToken} />
        {cursorConnections.length > 0 ? (
          <McpConnectionList connections={cursorConnections} />
        ) : null}
      </div>
    );
  }

  if (id === "claude") {
    const claudeConnections = oauthFor(data.mcpOAuthConnections, "claude");
    return (
      <div className="space-y-3 border-t border-line bg-paper-deep/20 px-4 py-4 sm:px-5">
        <p className="text-sm text-ink-soft">
          In Claude, open{" "}
          <span className="font-medium text-ink">Settings → Connectors</span>,
          choose <span className="font-medium text-ink">Add custom connector</span>
          , and paste the URL below. Sign in with your Euclis account when
          prompted.
        </p>
        <CopyField value={data.mcpConnectorUrl} secret={false} />
        {claudeConnections.length > 0 ? (
          <McpConnectionList connections={claudeConnections} />
        ) : null}
      </div>
    );
  }

  if (id === "claude-code") {
    const origin = data.mcpConnectorUrl.replace(/\/api\/mcp\/?$/, "");
    const mcpCommand = `claude mcp add --transport http euclis ${data.mcpConnectorUrl}`;
    const hooksCommand = `curl -fsSL "${origin}/api/agent-hooks?agent=claude-code" | bash -s -- ${data.user.mcpToken}`;
    const claudeCodeConnections = oauthFor(
      data.mcpOAuthConnections,
      "claude-code"
    );
    return (
      <div className="space-y-3 border-t border-line bg-paper-deep/20 px-4 py-4 sm:px-5">
        <p className="text-sm text-ink-soft">
          Add Euclis as an MCP server (sign in when Claude Code prompts):
        </p>
        <CopyField value={mcpCommand} secret={false} />
        {claudeCodeConnections.length > 0 ? (
          <McpConnectionList connections={claudeCodeConnections} />
        ) : null}
        <p className="text-xs text-ink-faint">
          <span className="font-medium text-ink">Ambient memory</span> — run
          this once in each repo. After every session, Euclis quietly captures
          decisions and blockers from the session itself and refreshes a live
          project brief imported by <code className="rounded bg-paper-deep px-1 py-0.5 font-mono text-[11px]">CLAUDE.md</code>.
          No tool calls, nothing to remember:
        </p>
        <CopyField value={hooksCommand} secret={false} />
      </div>
    );
  }

  if (id === "euclis") {
    return (
      <div className="space-y-3 border-t border-line bg-paper-deep/20 px-4 py-4 sm:px-5">
        <p className="text-sm text-ink-soft">
          Use this URL when adding Euclis as a custom MCP connector. OAuth sign-in
          is required — no token copying.
        </p>
        <CopyField value={data.mcpConnectorUrl} secret={false} />
        <McpConnectionList connections={data.mcpOAuthConnections} />
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t border-line bg-paper-deep/20 px-4 py-4 sm:px-5">
      <p className="text-sm text-ink-soft">
        If you connect with a bearer token instead of signing in, these settings
        define what that connection can do. Enforced server-side on every tool
        call.
      </p>
      <McpWorkspaceForm
        workspaces={data.workspaces}
        currentWorkspaceId={data.user.mcpWorkspaceId}
      />
      <McpScopeForm currentScope={data.user.mcpScope} />
    </div>
  );
}

export function IntegrationsConnectors({ data }: { data: AccountSettingsData }) {
  const [tab, setTab] = useState<ConnectorTab>("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<ConnectorId | null>(null);

  const connectors = useMemo(() => buildConnectors(data), [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return connectors.filter((row) => {
      if (tab === "connected" && !row.connected) return false;
      if (tab === "not_connected" && (row.connected || row.id === "manual"))
        return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.type.toLowerCase().includes(q)
      );
    });
  }, [connectors, query, tab]);

  const popular = connectors.filter((row) => row.popular);

  function toggleExpanded(id: ConnectorId) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-line bg-paper-deep/40 p-0.5">
          {(
            [
              ["all", "All"],
              ["connected", "Connected"],
              ["not_connected", "Not connected"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === value
                  ? "bg-ink text-white shadow-sm dark:text-on-accent"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="relative block sm:w-56">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.75}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search connectors"
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint outline-none transition focus:border-ink/30 focus:shadow-[0_0_0_3px_rgba(26,26,26,0.08)]"
          />
        </label>
      </div>

      {tab === "all" && !query && popular.length > 0 ? (
        <section className="shrink-0">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Popular
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {popular.map((row) => (
              <div
                key={row.id}
                onClick={() => toggleExpanded(row.id)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3.5 transition hover:bg-paper-deep/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ConnectorLogo id={row.id} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{row.name}</p>
                  </div>
                </div>
                <ConnectButton
                  connected={row.connected}
                  onClick={() => toggleExpanded(row.id)}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line">
        <div className="grid shrink-0 grid-cols-[minmax(0,1.4fr)_5rem_6.5rem] gap-3 border-b border-line bg-paper-deep/30 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint sm:grid-cols-[minmax(0,1.6fr)_6rem_7rem] sm:px-5">
          <span>Connector</span>
          <span>Type</span>
          <span className="text-right">Status</span>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-faint sm:px-5">
            No connectors match your filters.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((row) => {
              const expanded = expandedId === row.id;
              return (
                <li key={row.id} className="border-b border-line last:border-b-0">
                  <div
                    onClick={() => toggleExpanded(row.id)}
                    className="grid cursor-pointer grid-cols-[minmax(0,1.4fr)_5rem_6.5rem] items-center gap-3 px-4 py-3 transition hover:bg-paper-deep/20 sm:grid-cols-[minmax(0,1.6fr)_6rem_7rem] sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <ConnectorLogo id={row.id} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {row.name}
                        </p>
                        <p className="truncate text-xs text-ink-faint sm:hidden">
                          {row.description}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-ink-soft">{row.type}</span>
                    <div className="flex justify-end">
                      <ConnectButton
                        connected={row.connected}
                        onClick={() => toggleExpanded(row.id)}
                        label={row.id === "manual" ? "Configure" : "Connect"}
                      />
                    </div>
                  </div>
                  {expanded ? <ConnectorDetail id={row.id} data={data} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
