import { z } from "zod";
import {
  createPost,
  createPostReply,
  getPostThread,
  listPosts,
  resolvePostInWorkspace,
} from "@/lib/services/post";
import { formatDiscussionList } from "@/lib/channel-formatters";
import { POST_KINDS } from "@/lib/post-kind";
import { parseMentionRefsInput, str, workspaceParam } from "@/lib/tools/helpers";
import {
  ok,
  requireWorkspace,
  soft,
  type ToolDef,
} from "@/lib/tools/types";
import { workspaceUrl } from "@/lib/app-url";

const postKindParam = z
  .enum(POST_KINDS)
  .optional()
  .describe("DISCUSSION, QUESTION, ANNOUNCEMENT, or PROPOSAL (default DISCUSSION)");

const createPostTool: ToolDef = {
  name: "create_post",
  waDescription:
    "Start a team discussion for announcements, questions, or proposals — separate from task updates.",
  mcpDescription:
    "Start a workspace discussion thread (announcement, question, proposal, or general discussion).",
  inputShape: {
    body: z.string().min(1).describe("Opening message for the discussion"),
    title: z.string().max(120).optional().describe("Optional display title"),
    kind: postKindParam,
    task: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Optional task # to link this discussion to"),
    mentions: z
      .array(z.string())
      .optional()
      .describe("Teammate handles to @mention in the opening message"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const body = str(input.body);
    if (!body) return soft("What should the discussion say?");
    const created = await createPost({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      body,
      title: str(input.title) || undefined,
      kind:
        input.kind === "QUESTION" ||
        input.kind === "ANNOUNCEMENT" ||
        input.kind === "PROPOSAL" ||
        input.kind === "DISCUSSION"
          ? input.kind
          : undefined,
      taskShortId:
        typeof input.task === "number" ? input.task : undefined,
      mentionRefs: parseMentionRefsInput(input.mentions),
    });
    const thread = await getPostThread(
      ws.workspaceId,
      ctx.userId,
      created.postId
    );
    const url = workspaceUrl(
      `/w/${ws.workspaceId}/discussion/${created.postId}`
    );
    const title = thread.post.title;
    const message = ctx.wa
      ? `Started discussion *${title}* in ${ws.workspaceName}.\n${url}`
      : `Started discussion "${title}" in workspace "${ws.workspaceName}".\n${url}`;
    return ok(message, { postId: created.postId });
  },
};

const replyToPostTool: ToolDef = {
  name: "reply_to_post",
  waDescription:
    "Reply in an existing team discussion. Pass the discussion title or opening words to find it.",
  mcpDescription:
    "Reply in an existing workspace discussion thread.",
  inputShape: {
    discussion: z
      .string()
      .min(1)
      .describe("Discussion title, opening text, or post id"),
    body: z.string().min(1).describe("Reply text"),
    reply_to: z
      .string()
      .optional()
      .describe(
        "Optional: reply to a specific message by author handle or message snippet"
      ),
    mentions: z
      .array(z.string())
      .optional()
      .describe("Teammate handles to @mention"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const body = str(input.body);
    const discussion = str(input.discussion);
    if (!discussion) return soft("Which discussion should I reply in?");
    if (!body) return soft("What should the reply say?");

    const resolved = await resolvePostInWorkspace(
      ws.workspaceId,
      ctx.userId,
      discussion
    );
    const thread = await getPostThread(
      ws.workspaceId,
      ctx.userId,
      resolved.id
    );

    let parentMessageId = resolved.openerMessageId;
    const replyTo = str(input.reply_to);
    if (replyTo) {
      const needle = replyTo.toLowerCase();
      const match = thread.messages.find(
        (message) =>
          message.author.username?.toLowerCase() === needle ||
          message.author.email?.toLowerCase() === needle ||
          message.body.toLowerCase().includes(needle)
      );
      if (match) parentMessageId = match.id;
    }

    await createPostReply({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      postId: resolved.id,
      body,
      parentMessageId,
      mentionRefs: parseMentionRefsInput(input.mentions),
    });

    const url = workspaceUrl(`/w/${ws.workspaceId}/discussion/${resolved.id}`);
    const message = ctx.wa
      ? `Replied in *${resolved.title}*.\n${url}`
      : `Replied in discussion "${resolved.title}".\n${url}`;
    return ok(message, { postId: resolved.id });
  },
};

const listDiscussionsTool: ToolDef = {
  name: "list_discussions",
  waDescription:
    "List recent team discussions (pinned first), optionally filtered by kind.",
  mcpDescription:
    "List recent workspace discussions, optionally filtered by kind.",
  inputShape: {
    kind: postKindParam,
    limit: z.number().int().min(1).max(20).optional(),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const posts = await listPosts(ws.workspaceId, ctx.userId, {
      kind:
        input.kind === "QUESTION" ||
        input.kind === "ANNOUNCEMENT" ||
        input.kind === "PROPOSAL" ||
        input.kind === "DISCUSSION"
          ? input.kind
          : undefined,
      limit: typeof input.limit === "number" ? input.limit : 10,
    });
    return ok(formatDiscussionList(ws.workspaceName, posts, ctx.channel));
  },
};

export const discussionTools: ToolDef[] = [
  createPostTool,
  replyToPostTool,
  listDiscussionsTool,
];
