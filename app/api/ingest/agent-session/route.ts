import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMcpIdentityByToken } from "@/lib/identity-cache";
import { verifyOAuthAccessToken } from "@/lib/services/oauth";
import { resolveUserWorkspaceContext, ServiceError } from "@/lib/services/project";
import { scheduleBackgroundTask } from "@/lib/background-task";
import {
  captureFromAgentSession,
  MAX_AGENT_TRANSCRIPT_CHARS,
} from "@/lib/memory/agent-capture";
import { memoryCaptureEnabled } from "@/lib/memory/capture";
import { buildWorkspaceBrief } from "@/lib/memory/brief";

/**
 * Ambient ingest for coding-agent sessions. The Cursor stop hook POSTs the
 * session's transcript delta here once per completed run:
 *  - capture runs post-response (fire-and-forget judge call) — the agent's
 *    loop is never blocked and no tools are involved;
 *  - the response carries the fresh workspace brief, which the hook writes
 *    to .cursor/rules/euclis-memory.mdc so the NEXT session starts
 *    context-aware without calling anything.
 *
 * Auth mirrors /api/mcp: personal mcpToken (UUID) or an OAuth access token.
 * A workspace-pinned credential is confined exactly like MCP tool calls.
 */

const MAX_BODY_CHARS = 200_000;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Credential = {
  userId: string;
  workspaceId: string | null;
};

async function authenticate(req: Request): Promise<Credential | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  if (UUID_REGEX.test(token)) {
    const identity = await getMcpIdentityByToken(token);
    if (!identity) return null;
    return { userId: identity.userId, workspaceId: identity.workspaceId };
  }

  const oauth = await verifyOAuthAccessToken(token);
  if (!oauth) return null;
  return { userId: oauth.userId, workspaceId: oauth.workspaceId };
}

async function resolveWorkspace(
  credential: Credential,
  hint: string | undefined
): Promise<{ workspaceId: string; workspaceName: string } | null> {
  if (credential.workspaceId) {
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        userId_workspaceId: {
          userId: credential.userId,
          workspaceId: credential.workspaceId,
        },
      },
      include: { workspace: { select: { id: true, name: true } } },
    });
    if (!membership) return null;
    return {
      workspaceId: membership.workspace.id,
      workspaceName: membership.workspace.name,
    };
  }
  const ctx = await resolveUserWorkspaceContext(credential.userId, hint);
  return { workspaceId: ctx.workspaceId, workspaceName: ctx.workspaceName };
}

export async function POST(req: Request) {
  const credential = await authenticate(req);
  if (!credential) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    conversation_id?: unknown;
    transcript?: unknown;
    workspace?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript : "";
  if (transcript.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "transcript too large" }, { status: 413 });
  }
  const conversationId =
    typeof body.conversation_id === "string" && body.conversation_id
      ? body.conversation_id
      : "unknown";
  const hint =
    typeof body.workspace === "string" && body.workspace.trim()
      ? body.workspace.trim()
      : undefined;

  let workspace: { workspaceId: string; workspaceName: string } | null;
  try {
    workspace = await resolveWorkspace(credential, hint);
  } catch (err) {
    const message =
      err instanceof ServiceError ? err.message : "workspace resolution failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (!workspace) {
    return NextResponse.json(
      { error: "the workspace this connection was approved for no longer exists" },
      { status: 403 }
    );
  }

  if (memoryCaptureEnabled() && transcript.trim().length > 0) {
    const ws = workspace;
    scheduleBackgroundTask("agent session capture", () =>
      captureFromAgentSession({
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        userId: credential.userId,
        conversationId,
        transcript: transcript.slice(-MAX_AGENT_TRANSCRIPT_CHARS),
      })
    );
  }

  const brief = await buildWorkspaceBrief({
    workspaceId: workspace.workspaceId,
    workspaceName: workspace.workspaceName,
    userId: credential.userId,
  }).catch(() => null);

  return NextResponse.json({ ok: true, brief });
}
