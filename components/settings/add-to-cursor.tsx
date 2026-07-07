"use client";

import { CopyField } from "@/components/ui/copy-field";
import { ui } from "@/components/ui/ui";

/**
 * Cursor setup: one-click MCP install (official deeplink), plus the
 * ambient-memory hook installer — a per-repo command that makes memory
 * build itself from agent sessions (capture on stop, brief injected into
 * every new session) with zero tool calls in the loop.
 */
export function AddToCursor({
  mcpUrl,
  mcpToken,
}: {
  mcpUrl: string;
  mcpToken: string;
}) {
  const config = btoa(JSON.stringify({ url: mcpUrl }));
  const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=euclis&config=${encodeURIComponent(config)}`;

  const snippet = JSON.stringify(
    { mcpServers: { euclis: { url: mcpUrl } } },
    null,
    2
  );

  const origin = mcpUrl.replace(/\/api\/mcp\/?$/, "");
  const hooksCommand = `curl -fsSL "${origin}/api/agent-hooks?agent=cursor" | bash -s -- ${mcpToken}`;
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
        <span className="font-medium text-ink">Ambient memory</span> — run this
        once in each repo. After every agent session, Euclis quietly captures
        decisions and blockers from the session itself and refreshes a live
        project brief that loads into every new chat. No tool calls, nothing
        to remember:
      </p>
      <CopyField value={hooksCommand} secret />
      <p className="mt-1 text-xs text-ink-faint">
        Optional: also install the rules snippet so the agent knows when to
        use the Euclis tools directly (deep context pulls, posting updates):
      </p>
      <CopyField value={rulesCommand} secret={false} />
    </div>
  );
}
