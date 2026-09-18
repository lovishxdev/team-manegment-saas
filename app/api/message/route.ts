import { mcpAuthHandler, mcpPostWithSalvage } from "@/lib/mcp-http";

/**
 * SSE message endpoint paired with /api/sse (mcp-handler basePath /api).
 */
export const maxDuration = 120;

export { mcpAuthHandler as GET, mcpPostWithSalvage as POST };
