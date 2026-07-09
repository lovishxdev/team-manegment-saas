import type Anthropic from "@anthropic-ai/sdk";
import type { ActionOutcome } from "@/lib/channel-formatters";
import { pickReplyOutcomes } from "@/lib/whatsapp-reply-guard";
import type { AgentLoopResult } from "@/lib/whatsapp-agent-loop";

const FALLBACK =
  "I couldn't find enough context to answer — try rephrasing the question or adding more detail to the thread.";

/** Strip storage URLs and noisy tool formatting for inline discussion replies. */
export function sanitizeDiscussionAgentReply(text: string): string {
  return text
    .replace(/^URL:\s*https?:\/\/\S+\s*$/gim, "")
    .replace(/https?:\/\/\S+/g, (url) =>
      url.length > 48 ? "" : url
    )
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Heuristic: still looks like pasted MCP/tool output, not a human answer. */
export function looksLikeRawToolDump(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^Assets in "/m.test(t) && /Type:\s*\S+/m.test(t)) return true;
  if (/^Asset "/m.test(t) && /Uploaded by:/m.test(t)) return true;
  if (t.length > 600 && /(Workspace:|Attached to:|Tags:)/m.test(t)) return true;
  return false;
}

function compressAssetToolText(text: string): string {
  const header = text.match(/^Assets in "([^"]+)" \((\d+)\):/m);
  const detail = text.match(
    /Asset "([^"]+)" in workspace "[^"]+"\nType: ([^\n]+)\nTags: ([^\n]+)\nUploaded by: ([^\n]+)/m
  );
  const listLine = text.match(/^- ([^\n]+)\n\s+type: ([^\n]+)(?:, by ([^\n]+))?/m);

  if (detail) {
    const [, name, type, , uploader] = detail;
    const shortType = type.split("/").pop() ?? type;
    return `**${name}** is in **Assets** (${shortType}, uploaded by ${uploader.trim()}). Open the Assets tab in this workspace to view or download it.`;
  }

  if (header && listLine) {
    const [, workspace, count] = header;
    const [, name, type, uploader] = listLine;
    const shortType = type.split("/").pop() ?? type;
    const who = uploader ? `, uploaded by ${uploader.trim()}` : "";
    if (count === "1") {
      return `**${name}** is the only file in **Assets** for ${workspace} (${shortType}${who}). Open the Assets tab to view or download it.`;
    }
    return `**${count} files** in **Assets** for ${workspace}, including **${name}** (${shortType}${who}). Open the Assets tab to browse them.`;
  }

  if (header) {
    const [, workspace, count] = header;
    return `**${count} file${count === "1" ? "" : "s"}** in **Assets** for ${workspace}. Open the Assets tab in this workspace to browse them.`;
  }

  return sanitizeDiscussionAgentReply(text);
}

function compressToolOutcomes(outcomes: ActionOutcome[]): string {
  const combined = outcomes.map((o) => o.message.trim()).filter(Boolean).join("\n\n");
  if (!combined) return FALLBACK;

  if (/Assets in "/m.test(combined) || /^Asset "/m.test(combined)) {
    const compressed = compressAssetToolText(combined);
    if (!looksLikeRawToolDump(compressed)) return compressed;
  }

  const last = outcomes[outcomes.length - 1]?.message.trim() ?? "";
  return sanitizeDiscussionAgentReply(last || combined);
}

export async function synthesizeDiscussionBranchReply(input: {
  anthropic: Anthropic;
  model: string;
  transcript: string;
  toolText: string;
}): Promise<string | null> {
  try {
    const response = await input.anthropic.messages.create({
      model: input.model,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            "Summarize these investigation findings as a short reply in a team discussion thread.",
            "Rules: 2–5 sentences max; no storage URLs; no internal IDs; don't repeat the same fact twice;",
            "say 'Assets tab' instead of pasting file metadata blocks; plain markdown OK for short lists.",
            "",
            "Discussion context:",
            input.transcript,
            "",
            "Tool findings:",
            input.toolText,
          ].join("\n"),
        },
      ],
    });
    const block = response.content.find(
      (part): part is Anthropic.TextBlock => part.type === "text"
    );
    const text = block?.text.trim();
    return text ? sanitizeDiscussionAgentReply(text) : null;
  } catch {
    return null;
  }
}

export async function finalizeDiscussionBranchReply(input: {
  loop: AgentLoopResult;
  anthropic: Anthropic;
  model: string;
  transcript: string;
}): Promise<string> {
  const { loop, anthropic, model, transcript } = input;
  const directReply = loop.reply?.trim();
  const note = loop.assistantNote?.trim();

  if (note) {
    const clean = sanitizeDiscussionAgentReply(note);
    if (!looksLikeRawToolDump(clean)) return clean;
  }

  if (directReply && loop.actionResults.length === 0) {
    return sanitizeDiscussionAgentReply(directReply);
  }

  if (directReply && !looksLikeRawToolDump(directReply)) {
    return sanitizeDiscussionAgentReply(directReply);
  }

  const outcomes = pickReplyOutcomes(loop.actionResults);
  const successes = outcomes.filter((o) => o.ok && o.message.trim());
  const failures = outcomes
    .filter((o) => !o.ok && o.message.trim())
    .map((o) => o.message.trim());

  if (successes.length === 0) {
    if (failures.length > 0) return failures.join("\n");
    if (loop.budgetExhausted) {
      return "I ran out of steps while investigating — try branching again with a narrower question.";
    }
    return directReply ? sanitizeDiscussionAgentReply(directReply) : FALLBACK;
  }

  const toolText = successes.map((o) => o.message.trim()).join("\n\n");
  const synthesized = await synthesizeDiscussionBranchReply({
    anthropic,
    model,
    transcript,
    toolText,
  });
  if (synthesized && !looksLikeRawToolDump(synthesized)) {
    return synthesized;
  }

  const compressed = compressToolOutcomes(successes);
  if (!looksLikeRawToolDump(compressed)) return compressed;

  return FALLBACK;
}
