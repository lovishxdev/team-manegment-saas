import Anthropic from "@anthropic-ai/sdk";
import {
  anthropicKeySetupHint,
  getAnthropicApiKey,
} from "@/lib/anthropic-env";
import type { AppNavEntry } from "@/lib/app-navigation";
import { parseWorkspaceIdFromPath } from "@/lib/app-navigation";
import { runWhatsAppAgentLoop } from "@/lib/whatsapp-agent-loop";
import {
  dispatchWebChatTool,
  webChatAnthropicTools,
  type WebChatSession,
} from "@/lib/tools/registry";
import { prisma } from "@/lib/prisma";

export const APP_CHAT_MODEL =
  process.env.APP_CHAT_MODEL?.trim() || "claude-haiku-4-5";

export type AppChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AppChatLink = {
  href: string;
  label: string;
};

export type AppChatResponse = {
  reply: string;
  links: AppChatLink[];
};

async function resolveWebSession(
  userId: string,
  pathname: string
): Promise<WebChatSession> {
  const fromPath = parseWorkspaceIdFromPath(pathname);
  if (!fromPath) {
    return { pathname, workspaceId: null, workspaceName: null };
  }

  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: fromPath } },
    include: { workspace: { select: { id: true, name: true } } },
  });

  if (!membership) {
    return { pathname, workspaceId: null, workspaceName: null };
  }

  return {
    pathname,
    workspaceId: membership.workspace.id,
    workspaceName: membership.workspace.name,
  };
}

function buildAppChatSystemPrompt(session: WebChatSession): string {
  const today = new Date().toISOString().slice(0, 10);
  const location = session.workspaceName
    ? `The user is in workspace "${session.workspaceName}" (${session.pathname}).`
    : `The user is on ${session.pathname || "the app"}.`;

  return `You are Euclis — a concise in-app assistant on the web dashboard. Today is ${today}.
${location}

You help with:
- Finding and updating tasks on the board (use update_task with taskRef for renames, status changes, etc.).
- Finding tasks, board state, memory, and project context (use the shared tools).
- Where to go in the app — ALWAYS call get_app_navigation for "where is…", "take me to…", "how do I invite", "open settings", tab names, etc. Pass workspace when the user names one (e.g. workspace "Euclis"). Account settings are /settings; workspace settings (invites, members) are /w/{id}/settings.
- Brief, friendly answers — no corporate filler.

Rules:
- Use tools for factual lookups and mutations; don't invent task IDs or URLs.
- When the user wants to change a task (rename, mark done, assign, etc.), call update_task — pass taskRef with the task name they mentioned. Do NOT use find_task for updates.
- For navigation, include clickable paths like /dashboard or /w/{id}/settings in your reply.
- After mutations (create/update task), leave your final text empty — the tool output is shown directly.
- Keep replies short (2–5 sentences unless listing search results).
- Markdown is OK for short lists. No HTML.
- If the user greets you, respond warmly and mention you can search tasks or help them navigate.`;
}

function extractNavLinks(
  actionResults: { action: string; result: string }[],
  toolData: unknown[]
): AppChatLink[] {
  const links: AppChatLink[] = [];
  for (let i = 0; i < actionResults.length; i++) {
    if (actionResults[i]?.action !== "get_app_navigation") continue;
    const data = toolData[i] as { entries?: AppNavEntry[] } | undefined;
    for (const entry of data?.entries ?? []) {
      if (!entry.path.includes("{")) {
        links.push({ href: entry.path, label: entry.label });
      }
    }
  }
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

export async function runAppChat(input: {
  userId: string;
  pathname: string;
  messages: AppChatMessage[];
}): Promise<AppChatResponse> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      reply: `App chat isn't configured yet. ${anthropicKeySetupHint()}`,
      links: [],
    };
  }

  const session = await resolveWebSession(input.userId, input.pathname);
  const anthropic = new Anthropic({ apiKey });
  const toolData: unknown[] = [];
  const actionResults: { action: string; result: string }[] = [];

  const anthropicMessages: Anthropic.MessageParam[] = input.messages.map(
    (message) => ({
      role: message.role,
      content: message.content,
    })
  );

  const loop = await runWhatsAppAgentLoop({
    anthropic,
    model: APP_CHAT_MODEL,
    maxTokens: 768,
    maxTurns: 5,
    systemPrompt: buildAppChatSystemPrompt(session),
    tools: webChatAnthropicTools(),
    messages: anthropicMessages,
    usage: {
      feature: "app-chat",
      operation: "agent-loop",
      workspaceId: session.workspaceId ?? undefined,
      userId: input.userId,
    },
    runTool: async (name, toolInput) => {
      const result = await dispatchWebChatTool(
        name,
        toolInput,
        input.userId,
        session
      );
      toolData.push(result.data);
      actionResults.push({ action: name, result: result.message });
      return { ok: result.ok, message: result.message };
    },
  });

  const toolSummary = actionResults
    .map((row) => row.result)
    .filter(Boolean)
    .join("\n\n");

  const reply =
    loop.reply?.trim() ||
    (toolSummary
      ? toolSummary
      : "I couldn't find an answer — try rephrasing or ask about a specific task or page.");

  return {
    reply,
    links: extractNavLinks(actionResults, toolData),
  };
}
