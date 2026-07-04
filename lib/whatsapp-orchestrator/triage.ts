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
    "task_ref": "task name phrase from the user message — match Board list spelling when possible",
    "task_title": "same as task_ref when you can pick the exact board title",
    "task_short_id": "optional integer from Board (#N) when unambiguous",
    "body": "optional — update note text verbatim from user",
    "status": "TODO|IN_PROGRESS|DONE — only if user wants status change",
    "title": "optional — new task title for create_task",
    "query": "for ask_task: the task name to look up (usually same as task_ref), NOT the full user sentence"
  },
  "clarifying_question": "optional — only if confidence < 0.6 and you need one short question",
  "reasoning": "optional — one line for debug"
}

Intent rules:
- simple: one clear action, unambiguous task, no compound requests
- complex: multiple actions, vague task reference, admin flows, or needs reasoning across updates
- post_update: user reports progress ("I started…", "blocked on…") OR confirms posting — NOT "I want to work on X"
- read_task: user wants to focus/discuss a task ("work on seo", "switch to X") — acknowledge, do NOT post an update
- ask_task: status/history/issue questions ("what's going on", "all updates of X", "issue with X") — always complex
- board_list: what's on the board / my tasks overview
- update_task: mark done, start, change priority — NOT progress notes (those are post_update)
- compound: multiple actions in one message

Task resolution (CRITICAL — you have the Board list in context):
1. When the user names or clearly refers to a task, set task_ref to that task name phrase.
2. Prefer the exact spelling from the Board list for task_title / task_ref when it matches (even if user typo'd).
3. If only one board task fits, set task_short_id too.
4. For ask_task: set query to the task name (task_ref), NOT filler like "I want to check what are the all updates of…"
5. If they ask about updates/status but don't name a task AND last discussed task is in context, use that task.
6. If truly ambiguous between 2+ tasks, set confidence < 0.6 and clarifying_question listing task names.

Examples:
User: "I want to check what are the all updates of Login Page Redesgin task"
→ intent ask_task, task_ref "Login Page Redesgin", query "Login Page Redesgin", confidence 0.95

User: "what's the issue with Login Page Redesing"
Board has "Login Page Redesgin"
→ intent ask_task, task_ref "Login Page Redesgin", query "Login Page Redesgin"

User: "I want to work on seo queries"
→ intent read_task, task_ref "seo queries" (or exact board title if listed)

User: "any more issues?"
(no task named, vague)
→ intent ask_task OR unknown, confidence < 0.6, clarifying_question asking which task

Extract body verbatim for post_update when present.
Never invent task titles not on the board unless create_task.`;

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
          task_ref: result.data.slots?.task_ref,
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
