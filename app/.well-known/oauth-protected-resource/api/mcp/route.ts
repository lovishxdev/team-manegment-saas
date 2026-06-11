// Some MCP clients request the path-suffixed variant of the protected
// resource metadata (/.well-known/oauth-protected-resource/api/mcp per
// RFC 9728 section 3). Serve the same document there.
export { GET, OPTIONS } from "../../route";
