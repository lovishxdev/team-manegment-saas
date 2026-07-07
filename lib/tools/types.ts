import type { z } from "zod";
import type { ConversationTurn } from "@/lib/services/conversation";
import type { Channel } from "@/lib/channel-formatters";

/**
 * Single source of truth for bot tools.
 *
 * One ToolDef drives:
 *  - Anthropic tool schemas for the WhatsApp agent (generated from Zod)
 *  - MCP registrations for the Claude connector (same Zod shapes)
 *  - Dispatch/execution on both channels (one handler, channel-aware)
 *
 * Handlers receive raw input (Record<string, unknown>) and coerce defensively —
 * models occasionally send "3" for an integer — so a malformed arg degrades to
 * a friendly message instead of a crash.
 */

/** Mutable per-message WhatsApp session (owned by the webhook, threaded here). */
export type WhatsAppSessionState = {
  phone: string;
  workspaceId: string | null;
  workspaceName: string | null;
  createdTaskShortIds: number[];
  pendingDeleteShortId: number | null;
  pendingDemote: boolean;
  pendingRemoveMember: boolean;
  pendingDeleteAsset: boolean;
  pendingInviteMembers: boolean;
  whiteboardImages: Buffer[] | null;
  lastCreatedTask: {
    shortId: number;
    workspaceId: string;
    title: string;
  } | null;
  workspacePickerSent: boolean;
  userMessage: string;
  conversationTurns: ConversationTurn[];
  lastDiscussedTaskShortId: number | null;
};

export type WorkspaceCtx = {
  workspaceId: string;
  workspaceName: string;
};

export type ToolContext = {
  userId: string;
  channel: Channel;
  /** Resolved workspace — null only for tools with needsWorkspace: false. */
  workspace: WorkspaceCtx | null;
  /** Present only on the WhatsApp channel. */
  wa?: {
    session: WhatsAppSessionState;
  };
  /** Present only on the in-app web chat. */
  web?: {
    pathname: string;
    workspaceId: string | null;
    workspaceName: string | null;
  };
};

export type ToolResult = {
  /** True when the action succeeded; false for soft failures / clarifications. */
  ok: boolean;
  /** User-facing (or agent-facing) text — same strings both channels use today. */
  message: string;
  /** Structured payload for future consumers (model-composed replies). */
  data?: unknown;
};

export type ToolDef = {
  name: string;
  /** Description shown to the WhatsApp agent (Haiku/Sonnet) — behavioral hints included. */
  waDescription: string;
  /** Description shown to MCP clients (Claude desktop). Defaults to waDescription. */
  mcpDescription?: string;
  /** Canonical input shape (used for MCP; also for WhatsApp unless overridden). */
  inputShape: z.ZodRawShape;
  /** WhatsApp-specific shape when the channels genuinely differ (e.g. confirm param). */
  waInputShape?: z.ZodRawShape;
  /** In-app web chat shape (e.g. taskRef instead of required shortId). */
  webInputShape?: z.ZodRawShape;
  /** Description for the in-app web chat agent. */
  webDescription?: string;
  /** False for tools runnable without a workspace (create/list/switch workspace). */
  needsWorkspace?: boolean;
  /** Tool only exists on WhatsApp (e.g. interactive picker). */
  whatsappOnly?: boolean;
  /** Tool only exists on the in-app web chat (e.g. navigation). */
  webOnly?: boolean;
  run: (
    input: Record<string, unknown>,
    ctx: ToolContext
  ) => Promise<ToolResult>;
};

export function ok(message: string, data?: unknown): ToolResult {
  return { ok: true, message, data };
}

export function soft(message: string): ToolResult {
  return { ok: false, message };
}

/** Workspace is guaranteed by dispatch for needsWorkspace tools. */
export function requireWorkspace(ctx: ToolContext): WorkspaceCtx {
  if (!ctx.workspace) {
    throw new Error(`Tool requires workspace context (channel: ${ctx.channel})`);
  }
  return ctx.workspace;
}
