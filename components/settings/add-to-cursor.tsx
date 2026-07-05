"use client";

import { CopyField } from "@/components/ui/copy-field";
import { ui } from "@/components/ui/ui";

/**
 * One-click Cursor MCP install via the official deeplink:
 * cursor://anysphere.cursor-deeplink/mcp/install?name=…&config=<base64 JSON>
 * Cursor opens, registers the server, and runs the OAuth login on first use.
 */
export function AddToCursor({ mcpUrl }: { mcpUrl: string }) {
  const config = btoa(JSON.stringify({ url: mcpUrl }));
  const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=euclis&config=${encodeURIComponent(config)}`;

  const snippet = JSON.stringify(
    { mcpServers: { euclis: { url: mcpUrl } } },
    null,
    2
  );

  const origin = mcpUrl.replace(/\/api\/mcp\/?$/, "");
  const rulesCommand = `curl -fsSL ${origin}/api/agent-rules >> AGENTS.md`;

  return (
    <div className="flex flex-col gap-3">
      <a href={deeplink} className={`${ui.btnPrimary} self-start`}>
        Add to Cursor
      </a>
      <p className="text-xs text-ink-faint">
        Opens Cursor and registers Euclis as an MCP server — sign in with your
        Euclis account when Cursor prompts. If the button doesn&apos;t open
        Cursor, paste this into <code className="rounded bg-paper-deep px-1 py-0.5 font-mono text-[11px]">.cursor/mcp.json</code>{" "}
        instead:
      </p>
      <CopyField value={snippet} secret={false} />
      <p className="mt-1 text-xs text-ink-faint">
        Then run this once in each repo so every agent session pulls project
        memory before working and records what it did after:
      </p>
      <CopyField value={rulesCommand} secret={false} />
    </div>
  );
}
