import Anthropic from "@anthropic-ai/sdk";
import { openRouterChat, openRouterConfigured } from "@/lib/openrouter";
import {
  complexAgentModel,
  defaultTriageModel,
} from "@/lib/whatsapp-orchestrator/types";

const SUMMARIZE_SYSTEM = `You answer questions about a task for WhatsApp (Euclis bot).

You receive the user's question plus a task context pack (metadata + update thread). The pack is the ONLY source of truth.

Write a short, direct answer:
- 3–6 sentences OR 3–5 • bullets — never dump the full update list
- Lead with what they asked (status, blockers, budget, latest news)
- Use *task title* with single asterisks — never #N IDs
- Include specific facts (names, numbers, dates) — never invent
- No labeled dumps (Status:, Match:, Updates (N):) — natural prose
- No preamble

Output ONLY the WhatsApp message.`;

/** Last-resort short reply if all models fail — never send the full pack. */
export function fallbackShortAskReply(rawPack: string): string {
  const titleMatch = rawPack.match(/^\*([^*\n]+)\*/m);
  const title = titleMatch?.[1]?.trim() ?? "That task";

  const bodies = [
    ...rawPack.matchAll(
      /•\s+[\d-]+[\d: ]*·\s+@\S+\s*\n\s+(.+?)(?=\n\n•|\n*$)/gs
    ),
  ]
    .map((m) => m[1].trim())
    .filter(Boolean);

  const recent = bodies.slice(-4);
  if (recent.length === 0) {
    return `*${title}* — I pulled the thread but couldn't compress it. Ask something specific (budget, blockers, latest update).`;
  }

  const bullets = recent.map((b) => `• ${b}`).join("\n");
  return `*${title}* — here's the latest:\n${bullets}`;
}

function looksLikeFullPack(text: string): boolean {
  return /Updates \(\d+\):/i.test(text) && (text.match(/•/g)?.length ?? 0) >= 3;
}

async function summarizeWithAnthropic(
  userQuestion: string,
  pack: string,
  workspaceName?: string | null
): Promise<string | null> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: complexAgentModel(),
    max_tokens: 600,
    system: SUMMARIZE_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Workspace: ${workspaceName ?? "unknown"}\n` +
          `Question: ${userQuestion}\n\n` +
          `Task context (source of truth):\n${pack}`,
      },
    ],
  });
  const block = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  const summary = block?.text?.trim();
  if (!summary || looksLikeFullPack(summary)) return null;
  return summary;
}

async function summarizeWithOpenRouter(
  userQuestion: string,
  pack: string,
  workspaceName?: string | null
): Promise<string | null> {
  if (!openRouterConfigured()) return null;
  const raw = await openRouterChat({
    model: defaultTriageModel(),
    temperature: 0.2,
    maxTokens: 600,
    messages: [
      { role: "system", content: SUMMARIZE_SYSTEM },
      {
        role: "user",
        content:
          `Workspace: ${workspaceName ?? "unknown"}\n` +
          `Question: ${userQuestion}\n\n` +
          `Task context:\n${pack}`,
      },
    ],
  });
  const summary = raw.trim();
  if (!summary || looksLikeFullPack(summary)) return null;
  return summary;
}

/**
 * Turn full ask_task RAG pack into a short WhatsApp summary.
 * Facts come from the pack; models only compress.
 */
export async function summarizeAskTaskReply(input: {
  userQuestion: string;
  taskContextPack: string;
  workspaceName?: string | null;
}): Promise<string> {
  const pack = input.taskContextPack.trim();
  if (!pack) return "I couldn't find anything on that task.";

  if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") {
    console.log("[orchestrator] ask_task summarizing", {
      inChars: pack.length,
      model: complexAgentModel(),
    });
  }

  try {
    const sonnet = await summarizeWithAnthropic(
      input.userQuestion,
      pack,
      input.workspaceName
    );
    if (sonnet) {
      if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") {
        console.log("[orchestrator] ask_task summarized", {
          via: "sonnet",
          outChars: sonnet.length,
        });
      }
      return sonnet;
    }
  } catch (err) {
    console.error("[orchestrator] ask_task Sonnet summarize failed:", err);
  }

  try {
    const flash = await summarizeWithOpenRouter(
      input.userQuestion,
      pack,
      input.workspaceName
    );
    if (flash) {
      if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") {
        console.log("[orchestrator] ask_task summarized", {
          via: "openrouter",
          outChars: flash.length,
        });
      }
      return flash;
    }
  } catch (err) {
    console.error("[orchestrator] ask_task OpenRouter summarize failed:", err);
  }

  const fallback = fallbackShortAskReply(pack);
  if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") {
    console.log("[orchestrator] ask_task summarized", {
      via: "fallback",
      outChars: fallback.length,
    });
  }
  return fallback;
}

export { looksLikeFullPack };
