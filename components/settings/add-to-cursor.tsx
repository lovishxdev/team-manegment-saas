"use client";

import { CopyField } from "@/components/ui/copy-field";
import { ui } from "@/components/ui/ui";

/**
 * Cursor setup: one-click MCP install (official deeplink), plus a reliable
 * bearer-token config (skips OAuth — use this if Connect hangs / times out),
 * plus the ambient-memory hook installer.
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

  // Bearer token skips the OAuth browser dance. Prefer this when Cursor
  // sits on "Connecting…" / "did not respond within 30 seconds".
  const tokenSnippet = JSON.stringify(
    {
      mcpServers: {
        euclis: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${mcpToken}`,
          },
        },
      },
    },
    null,
    2
  );

  const oauthSnippet = JSON.stringify(
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
        If Connect hangs or times out after 30s, paste this into{" "}
        <code className="rounded bg-paper-deep px-1 py-0.5 font-mono text-[11px]">
          .cursor/mcp.json
        </code>{" "}
        (or Cursor Settings → MCP). Uses your personal token — no OAuth popup:
      </p>
      <CopyField value={tokenSnippet} secret />
      <p className="text-xs text-ink-faint">
        OAuth-only config (browser sign-in) — only if the token config above
        isn&apos;t an option:
      </p>
      <CopyField value={oauthSnippet} secret={false} />
      <p className="mt-1 text-xs text-ink-faint">
        <span className="font-medium text-ink">Ambient memory</span> — run this
        once in each repo. After every agent session, Euclis quietly captures
        decisions and blockers from the session itself and refreshes a live
        project brief that loads into every new chat. No tool calls, nothing
        to remember:
      </p>
      <CopyField value={hooksCommand} secret={false} />
      <p className="mt-1 text-xs text-ink-faint">
        Optional: also install the rules snippet so the agent knows when to
        use the Euclis tools directly (deep context pulls, posting updates):
      </p>
      <CopyField value={rulesCommand} secret={false} />
    </div>
  );
}
