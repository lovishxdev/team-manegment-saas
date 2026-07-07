import { getAppOrigin } from "@/lib/app-origin";
import {
  buildAgentHooksInstaller,
  normalizeHookAgent,
} from "@/lib/memory/hooks-snippet";

/**
 * Public: serves the ambient-memory hook installer so any repo can wire
 * itself to Euclis with one command (token passed as an argument, never
 * part of this script):
 *   curl -fsSL "<origin>/api/agent-hooks?agent=cursor"      | bash -s -- <token>
 *   curl -fsSL "<origin>/api/agent-hooks?agent=claude-code" | bash -s -- <token>
 */
export async function GET(req: Request) {
  const origin = await getAppOrigin();
  const agent = normalizeHookAgent(new URL(req.url).searchParams.get("agent"));
  return new Response(buildAgentHooksInstaller(origin, agent), {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
