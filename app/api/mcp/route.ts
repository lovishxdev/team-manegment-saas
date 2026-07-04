import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { getUserIdByMcpToken } from "@/lib/identity-cache";
import { verifyOAuthAccessToken } from "@/lib/services/oauth";
import { ServiceError } from "@/lib/services/project";
import { dispatchMcpTool, mcpTools } from "@/lib/tools/registry";

/**
 * Claude App Remote MCP connector (Streamable HTTP transport).
 *
 * Auth: `Authorization: Bearer <User.mcpToken>`. The token identifies the
 * user directly -- MCP never touches signup/login flows.
 *
 * Tools are registered from the shared registry (lib/tools/registry.ts) —
 * the same ToolDefs drive the WhatsApp agent, so schemas, descriptions,
 * and behavior cannot drift between channels.
 */

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function toolError(err: unknown) {
  const message =
    err instanceof ServiceError
      ? err.message
      : "Something went wrong executing this tool";
  return { ...text(message), isError: true };
}

const handler = createMcpHandler(
  (server) => {
    for (const def of mcpTools()) {
      server.registerTool(
        def.name,
        {
          description: def.mcpDescription ?? def.waDescription,
          inputSchema: def.inputShape,
        },
        async (input: Record<string, unknown>, extra) => {
          const userId = extra.authInfo!.extra!.userId as string;
          try {
            const result = await dispatchMcpTool(def, input ?? {}, userId);
            return text(result.message);
          } catch (err) {
            return toolError(err);
          }
        }
      );
    }
  },
  {},
  { basePath: "/api" }
);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bearer-token verification. Two token kinds are accepted:
 *  1. Personal mcpToken (UUID) - copied manually from the settings page.
 *  2. OAuth access tokens - issued via the authorization flow used by
 *     claude.ai web/mobile connectors.
 * Returning undefined yields a 401 from mcp-handler, whose
 * WWW-Authenticate header points clients at the OAuth metadata.
 */
const authHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;

    if (UUID_REGEX.test(bearerToken)) {
      const userId = await getUserIdByMcpToken(bearerToken);
      if (!userId) return undefined;
      return {
        token: bearerToken,
        clientId: userId,
        scopes: ["tasks:read", "tasks:write"],
        extra: { userId },
      };
    }

    const oauth = await verifyOAuthAccessToken(bearerToken);
    if (!oauth) return undefined;
    return {
      token: bearerToken,
      clientId: oauth.clientId,
      scopes: ["tasks:read", "tasks:write"],
      extra: { userId: oauth.userId },
    };
  },
  { required: true }
);

export const maxDuration = 120;

export { authHandler as GET, authHandler as POST };
