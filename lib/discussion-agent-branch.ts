import Anthropic from "@anthropic-ai/sdk";
import {
  anthropicKeySetupHint,
  getAnthropicApiKey,
} from "@/lib/anthropic-env";
import { prisma } from "@/lib/prisma";
import {
  createAgentBranchReply,
  getPostThread,
} from "@/lib/services/post";
import { ServiceError } from "@/lib/services/project";
import { displayUser } from "@/lib/username";
import { runWhatsAppAgentLoop } from "@/lib/whatsapp-agent-loop";
import { finalizeDiscussionBranchReply } from "@/lib/discussion-agent-reply";
import {
  discussionBranchAnthropicTools,
  dispatchDiscussionBranchTool,
  discussionBranchToolDefs,
  normalizeMcpScope,
  type McpCredential,
} from "@/lib/tools/registry";

export const DISCUSSION_BRANCH_MODEL =
  process.env.DISCUSSION_BRANCH_MODEL?.trim() || "claude-haiku-4-5";

function buildChainTranscript(
  messages: Array<{
    id: string;
    body: string;
    parentMessageId: string | null;
    author: { username: string | null; email: string | null };
    isAgentGenerated: boolean;
  }>,
  triggerMessageId: string
): string {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const lines: string[] = [];
  let current = byId.get(triggerMessageId);
  while (current) {
    const label = current.isAgentGenerated
      ? "Euclis agent"
      : `@${displayUser(current.author)}`;
    lines.unshift(`${label}: ${current.body}`);
    current = current.parentMessageId
      ? byId.get(current.parentMessageId)
      : undefined;
  }
  return lines.join("\n");
}

function buildBranchSystemPrompt(input: {
  workspaceName: string;
  postTitle: string;
  postKind: string;
  taskLine: string;
  triggererLabel: string;
}): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are Euclis — an investigative assistant replying inside a team discussion thread. Today is ${today}.

Workspace: "${input.workspaceName}"
Discussion: "${input.postTitle}" (${input.postKind})
${input.taskLine}

A teammate (@${input.triggererLabel}) branched you from a specific message. Your job:
- Investigate or answer what that message raised using the tools available.
- Use recall_memory, get_project_context, read_task, search_tasks, list_discussions, etc. when helpful.
- Do NOT start new discussion threads — your answer will be posted as one inline reply.
- After using tools, reply in your own words — never paste raw tool output.
- Be concise (2–6 sentences). Short bullet lists are OK for 3+ items.
- Never include storage URLs or long internal IDs — say "in Assets" or "task #N" instead.
- Don't repeat the same fact twice (e.g. don't list an asset then paste its full detail block).
- Plain text only — no HTML. Markdown lists are OK for short findings.

When you have enough to answer, reply directly without calling more tools.`;
}

export type DiscussionBranchResult = {
  messageId: string;
  body: string;
};

export async function runDiscussionAgentBranch(input: {
  workspaceId: string;
  postId: string;
  triggerMessageId: string;
  userId: string;
}): Promise<DiscussionBranchResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new ServiceError(
      `Agent branch isn't configured. ${anthropicKeySetupHint()}`,
      "INVALID_INPUT"
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      username: true,
      mcpScope: true,
      mcpWorkspaceId: true,
    },
  });
  if (!user) {
    throw new ServiceError("User not found", "NOT_FOUND");
  }

  const scope = normalizeMcpScope(user.mcpScope);
  const credential: McpCredential = {
    scope,
    workspaceId: user.mcpWorkspaceId ?? input.workspaceId,
  };

  if (user.mcpWorkspaceId && user.mcpWorkspaceId !== input.workspaceId) {
    throw new ServiceError(
      "Your MCP credential is pinned to a different workspace — can't branch an agent here.",
      "FORBIDDEN"
    );
  }

  const thread = await getPostThread(
    input.workspaceId,
    input.userId,
    input.postId
  );

  const trigger = thread.messages.find((m) => m.id === input.triggerMessageId);
  if (!trigger) {
    throw new ServiceError("Message not found in this thread", "NOT_FOUND");
  }

  if (thread.post.status === "RESOLVED") {
    throw new ServiceError(
      "This discussion is closed — reopen it to branch an agent",
      "INVALID_INPUT"
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true },
  });
  if (!workspace) {
    throw new ServiceError("Workspace not found", "NOT_FOUND");
  }

  const transcript = buildChainTranscript(
    thread.messages.map((message) => ({
      id: message.id,
      body: message.body,
      parentMessageId: message.parentMessageId,
      author: message.author,
      isAgentGenerated: message.isAgentGenerated,
    })),
    input.triggerMessageId
  );

  const triggerer = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { username: true, email: true },
  });
  const triggererLabel = triggerer ? displayUser(triggerer) : "teammate";

  const taskLine = thread.post.taskShortId
    ? `Linked task: #${thread.post.taskShortId} "${thread.post.taskTitle ?? ""}"`
    : "Linked task: (none)";

  const systemPrompt = buildBranchSystemPrompt({
    workspaceName: workspace.name,
    postTitle: thread.post.title,
    postKind: thread.post.kind,
    taskLine,
    triggererLabel,
  });

  const userPrompt = [
    `Message chain up to and including the branch point:`,
    transcript,
    ``,
    `Investigate and answer what @${triggererLabel} needs from the branch point message.`,
  ].join("\n");

  const anthropic = new Anthropic({ apiKey });
  const toolDefs = discussionBranchToolDefs(scope);

  const loop = await runWhatsAppAgentLoop({
    anthropic,
    model: DISCUSSION_BRANCH_MODEL,
    maxTokens: 1024,
    maxTurns: 6,
    systemPrompt,
    tools: discussionBranchAnthropicTools(scope),
    messages: [{ role: "user", content: userPrompt }],
    runTool: async (name, toolInput) => {
      const def = toolDefs.find((tool) => tool.name === name);
      if (!def) {
        return { ok: false, message: `Unknown tool: ${name}` };
      }
      const result = await dispatchDiscussionBranchTool(
        def,
        toolInput,
        input.userId,
        input.workspaceId,
        workspace.name,
        credential
      );
      return { ok: result.ok, message: result.message };
    },
  });

  const reply = await finalizeDiscussionBranchReply({
    loop,
    anthropic,
    model: DISCUSSION_BRANCH_MODEL,
    transcript,
  });

  const created = await createAgentBranchReply({
    workspaceId: input.workspaceId,
    triggeredByUserId: input.userId,
    postId: input.postId,
    parentMessageId: input.triggerMessageId,
    body: reply,
  });

  return { messageId: created.id, body: created.body };
}
