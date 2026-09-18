// Path-suffixed Authorization Server metadata (RFC 8414 §3): some MCP
// clients request /.well-known/oauth-authorization-server/api/mcp when the
// resource is /api/mcp. Serve the same document as the root AS metadata.
export { GET, OPTIONS } from "../../route";
