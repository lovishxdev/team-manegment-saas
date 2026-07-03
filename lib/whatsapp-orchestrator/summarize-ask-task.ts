import Anthropic from "@anthropic-ai/sdk";
import { complexAgentModel } from "@/lib/whatsapp-orchestrator/types";

const SUMMARIZE_SYSTEM = `You answer questions about a task for WhatsApp (Euclis bot).

You receive the user's question plus a task context pack (metadata + update thread). The pack is the ONLY source of truth.

Write a short, direct answer:
- 3–6 sentences OR a few • bullets — whatever fits the question
- Lead with what they asked (status, blockers, budget, latest news, etc.)
- Use *task title* with single asterisks — never #N IDs
- Include specific facts from updates (names, numbers, dates) — never invent
- No labeled dumps (Status:, Category:, Updates (N):) — natural prose
- No preamble ("Here's what I found", "Based on the updates")

Output ONLY the WhatsApp message.`;

/**
 * Sonnet pass: turn full ask_task RAG pack into a short WhatsApp summary.
 * Facts come from the pack; Sonnet only compresses and targets the question.
 */
export async function summarizeAskTaskReply(input: {
  userQuestion: string;
  taskContextPack: string;
  workspaceName?: string | null;
}): Promise<string> {
  const pack = input.taskContextPack.trim();
  if (!pack) return "I couldn't find anything on that task.";

  const model = complexAgentModel();
  const anthropic = new Anthropic();

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 600,
      system: SUMMARIZE_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Workspace: ${input.workspaceName ?? "unknown"}\n` +
            `Question: ${input.userQuestion}\n\n` +
            `Task context (source of truth):\n${pack}`,
        },
      ],
    });

    const block = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const summary = block?.text?.trim();
    if (summary) {
      if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") {
        console.log("[orchestrator] ask_task summarized", {
          model,
          inChars: pack.length,
          outChars: summary.length,
        });
      }
      return summary;
    }
  } catch (err) {
    console.error("[orchestrator] ask_task summarize failed:", err);
  }

  // Fallback: first ~800 chars of pack if Sonnet fails
  return pack.length > 800 ? `${pack.slice(0, 800)}…` : pack;
}
