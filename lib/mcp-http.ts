import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { getMcpIdentityByToken } from "@/lib/identity-cache";
import { verifyOAuthAccessToken } from "@/lib/services/oauth";
import { ServiceError } from "@/lib/services/project";
import { salvageJsonRpcBody } from "@/lib/tools/input-salvage";
import {
  dispatchMcpTool,
  getToolDef,
  mcpTools,
  normalizeMcpScope,
} from "@/lib/tools/registry";

/**
 * Shared MCP HTTP handler for Streamable HTTP (/api/mcp) and the SSE
 * fallback Cursor uses after a 401 (/api/sse + /api/message).
 *
 * mcp-handler derives all three paths from basePath "/api". They must be
 * wired as Next.js routes or Cursor's SSE fallback 404s / hangs until the
 * 30s client timeout.
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
          const credential = {
            scope: normalizeMcpScope(
              extra.authInfo!.extra!.toolScope as string | undefined
            ),
            workspaceId:
              (extra.authInfo!.extra!.workspaceId as string | null) ?? null,
          };
          try {
            const result = await dispatchMcpTool(
              def,
              input ?? {},
              userId,
              credential
            );
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

export const mcpAuthHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;

    if (UUID_REGEX.test(bearerToken)) {
      const identity = await getMcpIdentityByToken(bearerToken);
      if (!identity) return undefined;
      return {
        token: bearerToken,
        clientId: identity.userId,
        scopes: ["tasks:read", "tasks:write"],
        extra: {
          userId: identity.userId,
          toolScope: identity.scope,
          workspaceId: identity.workspaceId,
        },
      };
    }

    const oauth = await verifyOAuthAccessToken(bearerToken);
    if (!oauth) return undefined;
    return {
      token: bearerToken,
      clientId: oauth.clientId,
      scopes: ["tasks:read", "tasks:write"],
      extra: {
        userId: oauth.userId,
        toolScope: oauth.scope,
        workspaceId: oauth.workspaceId,
      },
    };
  },
  { required: true }
);

/**
 * Salvage only tools/call payloads. initialize / notifications must stay
 * untouched so reconnect handshakes stay fast.
 */
export async function mcpPostWithSalvage(req: Request): Promise<Response> {
  let salvagedReq = req;
  try {
    const rawBody = await req.text();
    let shouldSalvage = false;
    try {
      const parsed = JSON.parse(rawBody) as { method?: unknown };
      shouldSalvage = parsed?.method === "tools/call";
    } catch {
      shouldSalvage = false;
    }

    const body = shouldSalvage
      ? await salvageJsonRpcBody(
          rawBody,
          (name) => getToolDef(name)?.inputShape
        )
      : rawBody;

    const headers = new Headers(req.headers);
    headers.delete("content-length");
    salvagedReq = new Request(req.url, {
      method: req.method,
      headers,
      body,
    });
  } catch {
    // Body already consumed or unreadable — fall through with the original.
  }
  return mcpAuthHandler(salvagedReq);
}
