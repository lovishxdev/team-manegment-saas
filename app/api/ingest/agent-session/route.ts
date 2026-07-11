import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMcpIdentityByToken } from "@/lib/identity-cache";
import { verifyOAuthAccessToken } from "@/lib/services/oauth";
import { resolveUserWorkspaceContext, ServiceError } from "@/lib/services/project";
import {
  captureFromAgentSession,
  MAX_AGENT_TRANSCRIPT_CHARS,
  type AgentSessionDocument,
  type SessionCaptureResult,
} from "@/lib/memory/agent-capture";
import { memoryCaptureEnabled } from "@/lib/memory/capture";
import { buildWorkspaceBrief } from "@/lib/memory/brief";
import type { ClaimedSuggestion } from "@/lib/memory/suggest";
import { bumpMemoryMetric } from "@/lib/memory/metrics";
import { claimAgentSeat } from "@/lib/billing/entitlements";
import {
  MAX_MEMORY_DOCUMENTS,
  MAX_MEMORY_DOCUMENT_CHARS,
  MAX_MEMORY_DOCUMENT_TOTAL_CHARS,
  upsertMemoryDocuments,
} from "@/lib/memory/documents";

/**
 * Ambient ingest for coding-agent sessions. The agent's stop hook (Cursor /
 * Claude Code) POSTs the session's transcript delta here once per completed
 * run. The judge runs inline — the caller is a hook, not a human, so a few
 * seconds here are invisible — which buys two things:
 *  - the returned brief already reflects what this session produced;
 *  - `ask` carries any confirm-only resolution suggestions, which the hook
 *    feeds back into the editor session (Cursor followup_message /
 *    Claude Code Stop-block) so the user confirms right where they work.
 *    Throttled by the same per-event budget as WhatsApp asks.
 *
 * Auth mirrors /api/mcp: personal mcpToken (UUID) or an OAuth access token.
 * A workspace-pinned credential is confined exactly like MCP tool calls.
 */

export const maxDuration = 60;

function formatAsk(suggestions: ClaimedSuggestion[]): string | null {
  if (suggestions.length === 0) return null;
  const lines = suggestions.map((s) => {
    const kindLabel = s.kind === "DEPENDENCY" ? "dependency" : "blocker";
    const taskRef = s.taskTitle ? ` on "${s.taskTitle}"` : "";
    return `- The ${kindLabel}${taskRef}: "${s.summary}" (memory event id: ${s.eventId})`;
  });
  return (
    `Euclis project memory: this session's work may have cleared ` +
    `${suggestions.length === 1 ? "an open item" : "open items"}:\n` +
    `${lines.join("\n")}\n` +
    `Ask the user whether ${suggestions.length === 1 ? "it is" : "these are"} actually resolved. ` +
    `If they confirm, call the Euclis MCP tool resolve_blocker with the event id. ` +
    `If they decline, are unsure, or you cannot ask, do nothing and finish.`
  );
}

const MAX_BODY_CHARS = 200_000;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Credential = {
  userId: string;
  workspaceId: string | null;
};

function parseDocuments(value: unknown): AgentSessionDocument[] {
  if (!Array.isArray(value)) return [];
  const documents: AgentSessionDocument[] = [];
  let totalChars = 0;

  for (const raw of value.slice(0, MAX_MEMORY_DOCUMENTS)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const path = typeof item.path === "string" ? item.path.trim() : "";
    const hash = typeof item.hash === "string" ? item.hash.trim() : "";
    const content =
      typeof item.content === "string"
        ? item.content.trim().slice(0, MAX_MEMORY_DOCUMENT_CHARS)
        : "";

    const containsLikelySecret =
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(content) ||
      /\b(?:sk-ant-|sk-proj-|ghp_|github_pat_|AKIA)[A-Za-z0-9_-]{16,}/.test(
        content
      );

    // Hooks send repository-relative Markdown only. Reject traversal,
    // generated context/instruction files and likely real credentials even
    // if a custom client submits them.
    if (
      !path ||
      path.startsWith("/") ||
      path.split(/[\\/]/).includes("..") ||
      !/^[a-z0-9_./ -]+\.md$/i.test(path) ||
      path === "AGENTS.md" ||
      path === "CLAUDE.md" ||
      path.startsWith(".cursor/") ||
      path.startsWith(".claude/") ||
      path.startsWith("node_modules/") ||
      path.startsWith(".git/") ||
      !/^[a-f0-9]{64}$/i.test(hash) ||
      !content ||
      containsLikelySecret
    ) {
      continue;
    }
    if (totalChars + content.length > MAX_MEMORY_DOCUMENT_TOTAL_CHARS) break;
    totalChars += content.length;
    documents.push({ path, hash, content });
  }

  return documents;
}

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
    documents?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript : "";
  const submittedDocuments = parseDocuments(body.documents);
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

  // Ambient agent seats are metered per engineer. Existing seats are
  // grandfathered; a new engineer beyond the plan cap is blocked (no brief).
  const seat = await claimAgentSeat(workspace.workspaceId, credential.userId);
  if (!seat.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `This workspace's plan includes ${seat.limit} connected coding-agent ` +
          `seat${seat.limit === 1 ? "" : "s"}. Upgrade to Team for unlimited seats.`,
        brief: null,
        ask: null,
      },
      { status: 402 }
    );
  }

  const documents =
    submittedDocuments.length > 0
      ? await upsertMemoryDocuments({
          workspaceId: workspace.workspaceId,
          userId: credential.userId,
          documents: submittedDocuments,
        }).catch((err) => {
          console.error("[agent-session] document upsert failed:", err);
          return [];
        })
      : [];

  // Judge inline so the response can carry both the up-to-date brief and
  // any resolution asks for this very session. Capture failures never fail
  // the request — the brief still ships.
  let capture: SessionCaptureResult = { suggestions: [] };
  if (
    memoryCaptureEnabled() &&
    (transcript.trim().length > 0 || documents.length > 0)
  ) {
    capture = await captureFromAgentSession({
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      userId: credential.userId,
      conversationId,
      transcript: transcript.slice(-MAX_AGENT_TRANSCRIPT_CHARS),
      documents,
    }).catch((err) => {
      console.error("[agent-session] capture failed:", err);
      return { suggestions: [] };
    });
  }

  const brief = await buildWorkspaceBrief({
    workspaceId: workspace.workspaceId,
    workspaceName: workspace.workspaceName,
    userId: credential.userId,
  }).catch(() => null);
  if (brief) {
    bumpMemoryMetric(workspace.workspaceId, "brief_built", {
      sum: brief.length,
    });
  }

  return NextResponse.json({
    ok: true,
    brief,
    ask: formatAsk(capture.suggestions),
  });
}
