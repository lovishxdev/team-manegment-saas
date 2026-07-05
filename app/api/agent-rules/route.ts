import { CODING_AGENT_RULES_SNIPPET } from "@/lib/memory/rules-snippet";

/**
 * Public: serves the coding-agent rules snippet so repos can install it with
 * one command instead of copy-pasting:
 *   curl -fsSL <origin>/api/agent-rules >> AGENTS.md
 * Contains no user or workspace data.
 */
export function GET() {
  return new Response(CODING_AGENT_RULES_SNIPPET, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
