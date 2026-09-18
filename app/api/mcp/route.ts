import { mcpAuthHandler, mcpPostWithSalvage } from "@/lib/mcp-http";

/**
 * Claude / Cursor Remote MCP connector (Streamable HTTP transport).
 * SSE fallback lives at /api/sse + /api/message (same handler).
 */

export const maxDuration = 120;

export { mcpAuthHandler as GET, mcpPostWithSalvage as POST };
