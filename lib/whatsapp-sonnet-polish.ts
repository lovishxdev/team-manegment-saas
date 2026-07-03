import Anthropic from "@anthropic-ai/sdk";
import type { ActionOutcome } from "@/lib/channel-formatters";

const DEFAULT_SONNET_MODEL = "claude-sonnet-4-5";

export function isSonnetPolishEnabled(): boolean {
  const flag = process.env.WHATSAPP_SONNET_POLISH?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

const POLISH_SYSTEM = `You rewrite draft WhatsApp replies for Euclis (task management bot).

Sound like a helpful teammate texting back — warm, short, clear.

Formatting (WhatsApp only — NOT Markdown):
- Bold = single asterisks: *like this*
- NEVER use **double asterisks** or __underscores__ for bold
- NEVER nest asterisks (*outer *inner* outer*)
- Task titles may be bold: *Fix login bug*
- Section headers: plain "To do:" or "In progress:" — no asterisks on headers
- Keep task *titles* bold; use titles not #N IDs in user-facing text
- Keep URLs, @usernames, and facts exactly as in the draft
- Use _italic_ sparingly for notes only

Content:
- Do not add new facts or claim actions not in the draft
- Preserve errors/partial success from the draft
- No "Here's what happened", "Done.", or corporate filler
- Output ONLY the final message — no preamble`;

function summarizeOutcomes(outcomes: ActionOutcome[]): string {
  return outcomes
    .filter((o) => o.message.trim())
    .map((o) => `[${o.ok ? "ok" : "fail"}:${o.action ?? "?"}] ${o.message}`)
    .join("\n");
}

/**
 * Optional Sonnet pass — rewrites the deterministic draft into natural chat.
 * Enable with WHATSAPP_SONNET_POLISH=1
 */
export async function polishWhatsAppReply(input: {
  userMessage: string;
  draftReply: string;
  workspaceName?: string | null;
  actionResults?: ActionOutcome[];
}): Promise<string> {
  const draft = input.draftReply.trim();
  if (!draft) return draft;

  const model =
    process.env.WHATSAPP_SONNET_MODEL?.trim() || DEFAULT_SONNET_MODEL;

  const toolContext = input.actionResults?.length
    ? `\n\nTool results (source of truth):\n${summarizeOutcomes(input.actionResults)}`
    : "";

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model,
    max_tokens: 600,
    system: POLISH_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Workspace: ${input.workspaceName ?? "(none)"}\n` +
          `User message: ${input.userMessage}\n` +
          `Draft reply to rewrite:\n${draft}` +
          toolContext,
      },
    ],
  });

  const block = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  const polished = block?.text?.trim();
  if (!polished) return draft;

  return polished;
}
