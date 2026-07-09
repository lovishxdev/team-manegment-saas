import type Anthropic from "@anthropic-ai/sdk";
import { resolveUserWorkspaceContext, ServiceError } from "@/lib/services/project";
import {
  formatToolExecutionError,
  validateWhatsAppToolInput,
} from "@/lib/whatsapp-tool-guard";
import { waWebhookLog } from "@/lib/whatsapp-webhook-log";
import { toAnthropicTool, toAnthropicTools } from "@/lib/tools/anthropic";
import {
  ALL_TOOLS,
  KNOWN_TOOL_NAMES,
  WHATSAPP_TOOL_NAMES,
} from "@/lib/tools/catalog";
import type {
  ToolContext,
  ToolDef,
  ToolResult,
  WhatsAppSessionState,
} from "@/lib/tools/types";

/**
 * Canonical tool catalog — the ONLY place bot tools are defined.
 * WhatsApp Anthropic schemas, MCP registrations, and dispatch all derive
 * from this list. Adding a tool = adding one ToolDef.
 */
export { ALL_TOOLS, KNOWN_TOOL_NAMES, WHATSAPP_TOOL_NAMES } from "@/lib/tools/catalog";

const TOOLS_BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

export function getToolDef(name: string): ToolDef | undefined {
  return TOOLS_BY_NAME.get(name);
}

export function mcpTools(): ToolDef[] {
  return ALL_TOOLS.filter((t) => !t.whatsappOnly && !t.webOnly);
}

/** Task mutations available in the in-app chat (not MCP context scope). */
export const WEB_CHAT_MUTATION_TOOL_NAMES: ReadonlySet<string> = new Set([
  "create_task",
  "update_task",
  "undo_last_action",
]);

/** In-app floating chat — context-scope tools plus web navigation. */
export function webChatTools(): ToolDef[] {
  return ALL_TOOLS.filter(
    (t) =>
      !t.whatsappOnly &&
      (CONTEXT_SCOPE_TOOL_NAMES.has(t.name) ||
        WEB_CHAT_MUTATION_TOOL_NAMES.has(t.name) ||
        t.webOnly === true)
  );
}

let cachedWebChatTools: Anthropic.Tool[] | null = null;

export function webChatAnthropicTools(): Anthropic.Tool[] {
  if (!cachedWebChatTools) {
    cachedWebChatTools = webChatTools().map((def) =>
      toAnthropicTool(
        {
          ...def,
          waDescription:
            def.webDescription ?? def.mcpDescription ?? def.waDescription,
        },
        "web"
      )
    );
  }
  return cachedWebChatTools;
}

/**
 * MCP credential tool scopes, enforced server-side (a prompt can't talk its
 * way past them):
 *  - "context": what a coding agent needs — read/query tools, the memory
 *    layer, and posting updates. No deletes, no member/workspace admin.
 *  - "full": the complete registry (Claude Desktop chat-style management).
 * WhatsApp always gets the full registry — it's the conversational
 * management channel and authenticates a human by phone.
 */
export type McpToolScope = "context" | "full";

export const CONTEXT_SCOPE_TOOL_NAMES: ReadonlySet<string> = new Set([
  // Read / query
  "read_task",
  "list_task_updates",
  "get_board_state",
  "list_my_tasks",
  "ask_task",
  "find_task",
  "search_tasks",
  "workspace_summary",
  "list_workspaces",
  "list_categories",
  "list_workspace_members",
  "list_assets",
  "read_asset",
  "list_links",
  "list_discussions",
  // Memory layer
  "recall_memory",
  "list_blockers",
  "record_decision",
  "resolve_blocker",
  "get_project_context",
  // Reflecting work back into Euclis
  "add_task_update",
  "create_post",
  "reply_to_post",
]);

export function isToolAllowedForScope(
  toolName: string,
  scope: McpToolScope
): boolean {
  if (scope === "full") return true;
  return CONTEXT_SCOPE_TOOL_NAMES.has(toolName);
}

export function normalizeMcpScope(scope: string | undefined): McpToolScope {
  return scope === "full" ? "full" : "context";
}

let cachedWhatsAppTools: Anthropic.Tool[] | null = null;

/** Anthropic tool schemas for the WhatsApp agent, generated from Zod. */
export function whatsappAnthropicTools(): Anthropic.Tool[] {
  if (!cachedWhatsAppTools) {
    cachedWhatsAppTools = toAnthropicTools(
      ALL_TOOLS.filter((t) => !t.webOnly)
    );
  }
  return cachedWhatsAppTools;
}

export type WhatsAppDispatchDeps = {
  userId: string;
  session: WhatsAppSessionState;
};

/** Structured tool outcome — success comes from the handler, never guessed from strings. */
export type WhatsAppToolOutcome = {
  ok: boolean;
  message: string;
};

/**
 * Execute a tool on the WhatsApp channel. Replaces the webhook's 577-line
 * executeAction switch: workspace resolution + session threading + error
 * mapping happen here once, then the ToolDef handler runs.
 */
export async function dispatchWhatsAppTool(
  action: string,
  input: Record<string, unknown>,
  deps: WhatsAppDispatchDeps
): Promise<WhatsAppToolOutcome> {
  const def = TOOLS_BY_NAME.get(action);
  if (!def) {
    return {
      ok: false,
      message:
        "I don't know how to do that yet. Try creating a task, updating one, or asking about the board.",
    };
  }

  const preflight = validateWhatsAppToolInput(action, input, deps.session);
  if (!preflight.ok) return { ok: false, message: preflight.message };

  try {
    const ctx = await buildWhatsAppContext(def, input, deps);
    const result = await def.run(input, ctx);
    return { ok: result.ok, message: result.message };
  } catch (err) {
    return { ok: false, message: formatToolExecutionError(err) };
  }
}

async function buildWhatsAppContext(
  def: ToolDef,
  input: Record<string, unknown>,
  deps: WhatsAppDispatchDeps
): Promise<ToolContext> {
  const { userId, session } = deps;

  let workspace: ToolContext["workspace"] = null;
  if (def.needsWorkspace !== false) {
    const explicitWorkspace =
      typeof input.workspace === "string" && input.workspace.trim()
        ? input.workspace.trim()
        : undefined;

    const ctx = explicitWorkspace
      ? await resolveUserWorkspaceContext(userId, explicitWorkspace)
      : session.workspaceId && session.workspaceName
        ? {
            workspaceId: session.workspaceId,
            workspaceName: session.workspaceName,
          }
        : await resolveUserWorkspaceContext(userId);

    session.workspaceId = ctx.workspaceId;
    session.workspaceName = ctx.workspaceName;
    workspace = { workspaceId: ctx.workspaceId, workspaceName: ctx.workspaceName };

    waWebhookLog("workspace context", {
      action: def.name,
      workspaceId: ctx.workspaceId,
      workspaceName: ctx.workspaceName,
      explicitWorkspace: explicitWorkspace ?? null,
    });
  }

  return {
    userId,
    channel: "whatsapp",
    workspace,
    wa: { session },
  };
}

/**
 * Execute a tool on the MCP channel. The MCP route calls this from a thin
 * generated registration — no per-tool handler code there anymore.
 */
export type McpCredential = {
  scope: McpToolScope;
  /** Workspace this connection is confined to; null = all workspaces. */
  workspaceId: string | null;
};

export async function dispatchMcpTool(
  def: ToolDef,
  input: Record<string, unknown>,
  userId: string,
  credential: McpCredential = { scope: "full", workspaceId: null }
): Promise<ToolResult> {
  if (!isToolAllowedForScope(def.name, credential.scope)) {
    return {
      ok: false,
      message:
        `This credential has "context" scope: read/query tools, memory tools ` +
        `(recall_memory, list_blockers, record_decision, resolve_blocker, ` +
        `get_project_context, create_post, reply_to_post), and add_task_update. Management actions like ` +
        `${def.name} aren't available on this connection — reconnect and ` +
        `choose "All workspaces" on the Euclis consent screen for full access.`,
    };
  }

  let workspace: ToolContext["workspace"] = null;
  if (def.needsWorkspace !== false) {
    const hint =
      typeof input.workspace === "string" && input.workspace.trim()
        ? input.workspace.trim()
        : undefined;

    if (credential.workspaceId) {
      // Confined connection (chosen once on the consent screen): every call
      // runs in that workspace; requests for any other are rejected. The
      // agent never has a reason to think about other workspaces.
      const pin = await resolvePinnedWorkspace(userId, credential.workspaceId);
      if (!pin) {
        return {
          ok: false,
          message:
            "The workspace this connection was approved for no longer exists " +
            "(or your membership was removed). Reconnect Euclis and pick a " +
            "workspace again.",
        };
      }
      if (
        hint &&
        hint !== pin.workspaceId &&
        hint.toLowerCase() !== pin.workspaceName.toLowerCase()
      ) {
        return {
          ok: false,
          message:
            `This connection only has access to the "${pin.workspaceName}" workspace. ` +
            `Work within it, or ask the user to create a separate connection for other workspaces.`,
        };
      }
      workspace = pin;
    } else {
      // All-workspace connection (chat/management): resolve as usual.
      const ctx = await resolveUserWorkspaceContext(userId, hint);
      workspace = { workspaceId: ctx.workspaceId, workspaceName: ctx.workspaceName };
    }
  }

  return def.run(input, {
    userId,
    channel: "mcp",
    workspace,
  });
}

/** Validates the pinned workspace still exists and the user is a member. */
async function resolvePinnedWorkspace(
  userId: string,
  workspaceId: string
): Promise<{ workspaceId: string; workspaceName: string } | null> {
  const { prisma } = await import("@/lib/prisma");
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!membership) return null;
  return {
    workspaceId: membership.workspace.id,
    workspaceName: membership.workspace.name,
  };
}

export const DISCUSSION_BRANCH_EXCLUDED_TOOL_NAMES: ReadonlySet<string> =
  new Set(["create_post", "reply_to_post"]);

export function discussionBranchToolDefs(scope: McpToolScope): ToolDef[] {
  return ALL_TOOLS.filter(
    (tool) =>
      !tool.whatsappOnly &&
      !tool.webOnly &&
      isToolAllowedForScope(tool.name, scope) &&
      !DISCUSSION_BRANCH_EXCLUDED_TOOL_NAMES.has(tool.name)
  );
}

let cachedDiscussionBranchTools: Anthropic.Tool[] | null = null;

export function discussionBranchAnthropicTools(
  scope: McpToolScope = "context"
): Anthropic.Tool[] {
  if (scope === "context" && cachedDiscussionBranchTools) {
    return cachedDiscussionBranchTools;
  }
  const tools = discussionBranchToolDefs(scope).map((def) =>
    toAnthropicTool(
      {
        ...def,
        waDescription: def.mcpDescription ?? def.waDescription,
      },
      "mcp"
    )
  );
  if (scope === "context") {
    cachedDiscussionBranchTools = tools;
  }
  return tools;
}

/**
 * Run one MCP tool for an in-thread discussion agent branch.
 * Workspace is pinned to the discussion workspace (same confinement as MCP).
 */
export async function dispatchDiscussionBranchTool(
  def: ToolDef,
  input: Record<string, unknown>,
  userId: string,
  workspaceId: string,
  workspaceName: string,
  credential: McpCredential
): Promise<ToolResult> {
  if (!isToolAllowedForScope(def.name, credential.scope)) {
    return {
      ok: false,
      message: `Tool ${def.name} isn't available on your MCP credential scope.`,
    };
  }
  if (DISCUSSION_BRANCH_EXCLUDED_TOOL_NAMES.has(def.name)) {
    return {
      ok: false,
      message:
        "The discussion agent can't start separate threads — it replies inline only.",
    };
  }

  if (credential.workspaceId && credential.workspaceId !== workspaceId) {
    return {
      ok: false,
      message:
        `Your MCP connection is pinned to a different workspace. ` +
        `Branch to agent only works inside the workspace your credential allows.`,
    };
  }

  if (def.needsWorkspace === false) {
    return def.run(input, { userId, channel: "mcp", workspace: null });
  }

  return def.run(input, {
    userId,
    channel: "mcp",
    workspace: { workspaceId, workspaceName },
  });
}

export type WebChatSession = {
  pathname: string;
  workspaceId: string | null;
  workspaceName: string | null;
};

export async function dispatchWebChatTool(
  action: string,
  input: Record<string, unknown>,
  userId: string,
  session: WebChatSession
): Promise<ToolResult> {
  const def = TOOLS_BY_NAME.get(action);
  if (!def || def.whatsappOnly) {
    return {
      ok: false,
      message: "That action isn't available in the app chat.",
    };
  }
  if (
    !CONTEXT_SCOPE_TOOL_NAMES.has(def.name) &&
    !WEB_CHAT_MUTATION_TOOL_NAMES.has(def.name) &&
    !def.webOnly
  ) {
    return {
      ok: false,
      message:
        "That management action isn't available here — use workspace settings or WhatsApp for full control.",
    };
  }

  try {
    let workspace: ToolContext["workspace"] = null;
    if (def.needsWorkspace !== false) {
      const hint =
        typeof input.workspace === "string" && input.workspace.trim()
          ? input.workspace.trim()
          : undefined;

      if (session.workspaceId && session.workspaceName && !hint) {
        workspace = {
          workspaceId: session.workspaceId,
          workspaceName: session.workspaceName,
        };
      } else {
        const ctx = await resolveUserWorkspaceContext(userId, hint);
        workspace = {
          workspaceId: ctx.workspaceId,
          workspaceName: ctx.workspaceName,
        };
      }
    }

    return await def.run(input, {
      userId,
      channel: "web",
      workspace,
      web: session,
    });
  } catch (err) {
    return { ok: false, message: formatToolExecutionError(err) };
  }
}

export { ServiceError };
export type { ToolDef, ToolResult, ToolContext };
