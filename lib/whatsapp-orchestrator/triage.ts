import {
  openRouterChat,
  openRouterConfigured,
  parseOpenRouterJson,
} from "@/lib/openrouter";
import {
  formatContextForPrompt,
  type OrchestratorContextPack,
} from "@/lib/whatsapp-orchestrator/context-pack";
import {
  defaultTriageModel,
  TriageResultSchema,
  type TriageResult,
} from "@/lib/whatsapp-orchestrator/types";

const TRIAGE_SYSTEM = `You are the intent router for Euclis, a WhatsApp task-management bot.

Return ONLY valid JSON matching this schema:
{
  "intent": "greeting|menu|board_list|create_task|update_task|post_update|ask_task|read_task|delete_task|search_tasks|workspace_admin|assets_links|compound|chitchat|unknown",
  "complexity": "simple|complex",
  "confidence": 0.0-1.0,
  "slots": {
    "task_ref": "optional — task name or reference from user message",
    "task_title": "optional — resolved title if clear",
    "body": "optional — update note text verbatim from user",
    "status": "TODO|IN_PROGRESS|DONE — only if user wants status change",
    "title": "optional — new task title for create_task",
    "query": "optional — question for ask_task"
  },
  "clarifying_question": "optional — only if confidence < 0.6 and you need one short question",
  "reasoning": "optional — one line for debug"
}

Rules:
- simple: one clear action, unambiguous task, no compound requests
- complex: multiple actions, vague task reference, admin flows, or needs reasoning across updates
- post_update: user reports progress ("I started…", "blocked on…") OR confirms posting ("yes post that")
- board_list: what's on the board / my tasks overview
- update_task: mark done, start, change priority/due — NOT progress notes (those are post_update)
- compound: "create X and assign Y", multiple tasks, workspace + tasks
- Extract body verbatim for post_update from user message when present
- Use board + chat context to resolve which task they mean; put name in task_ref
- Never invent task titles not on the board unless create_task`;

/**
 * Step 1 — cheap structured triage (Gemini Flash via OpenRouter by default).
 */
export async function triageWhatsAppMessage(
  pack: OrchestratorContextPack
): Promise<TriageResult> {
  if (!openRouterConfigured()) {
    return fallbackTriage(pack);
  }

  const model = defaultTriageModel();
  const userContent = formatContextForPrompt(pack);

  try {
    const raw = await openRouterChat({
      model,
      temperature: 0.05,
      maxTokens: 512,
      jsonMode: true,
      messages: [
        { role: "system", content: TRIAGE_SYSTEM },
        { role: "user", content: userContent },
      ],
    });

    const parsed = parseOpenRouterJson<unknown>(raw);
    const result = TriageResultSchema.safeParse(parsed);
    if (result.success) {
      if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") {
        console.log("[orchestrator] triage", {
          model,
          intent: result.data.intent,
          complexity: result.data.complexity,
          confidence: result.data.confidence,
        });
      }
      return result.data;
    }
    console.error("[orchestrator] triage schema mismatch:", result.error.message);
    return fallbackTriage(pack);
  } catch (err) {
    console.error("[orchestrator] triage failed:", err);
    return fallbackTriage(pack);
  }
}

/** Rule-based fallback when OpenRouter is down — routes to agent, not executor. */
function fallbackTriage(pack: OrchestratorContextPack): TriageResult {
  const msg = pack.user_message.trim().toLowerCase();
  if (/^(menu|help)\b/.test(msg)) {
    return { intent: "menu", complexity: "simple", confidence: 0.95 };
  }
  if (/what'?s on (the )?board|show (the )?board|my board/.test(msg)) {
    return { intent: "board_list", complexity: "simple", confidence: 0.9 };
  }
  if (/^(add|create)\s+(a\s+)?task\b/.test(msg)) {
    const title = pack.user_message.replace(/^(add|create)\s+(a\s+)?task\s*/i, "").trim();
    return {
      intent: "create_task",
      complexity: "simple",
      confidence: 0.85,
      slots: title ? { title } : undefined,
    };
  }
  return { intent: "unknown", complexity: "complex", confidence: 0.3 };
}
