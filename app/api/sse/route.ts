import { mcpAuthHandler, mcpPostWithSalvage } from "@/lib/mcp-http";

/**
 * SSE transport Cursor falls back to after Streamable HTTP 401 during OAuth.
 * mcp-handler expects this at /api/sse when basePath is /api.
 */
export const maxDuration = 120;

export { mcpAuthHandler as GET, mcpPostWithSalvage as POST };
