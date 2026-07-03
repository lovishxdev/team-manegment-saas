import type { ActionOutcome } from "@/lib/channel-formatters";
import {
  openRouterChat,
  openRouterConfigured,
  parseOpenRouterJson,
} from "@/lib/openrouter";
import { formatContextForPrompt } from "@/lib/whatsapp-orchestrator/context-pack";
import type { OrchestratorContextPack } from "@/lib/whatsapp-orchestrator/context-pack";
import {
  defaultJudgeModel,
  JudgeResultSchema,
  type JudgeResult,
  type TriageResult,
} from "@/lib/whatsapp-orchestrator/types";
import { looksLikeFullPack } from "@/lib/whatsapp-orchestrator/summarize-ask-task";

const JUDGE_SYSTEM = `You are the quality gate for Euclis WhatsApp replies.

Return ONLY valid JSON:
{
  "verdict": "approve|fix|reject_use_tools",
  "issues": ["short issue strings"],
  "fixed_reply": "optional — corrected message if verdict is fix",
  "reasoning": "optional one line"
}

Verdicts:
- approve: draft is accurate, uses task TITLES not #N IDs, matches tool results
- fix: draft has minor issues; provide fixed_reply (title-first, WhatsApp *bold*)
- reject_use_tools: draft hallucinates, refuses capabilities, contradicts tools, or invents facts — NOT for long but accurate ask_task/board output

Hard failures (must reject_use_tools or fix):
- Claims cannot post updates from chat when add_task_update succeeded or was requested
- Uses #1 #2 style IDs in user-facing text (use *Task Title* instead)
- Describes actions not present in tool results
- Ignores successful tool output in favor of a worse summary

WhatsApp format: *bold* with single asterisks only. Keep replies short.`;

export type JudgeInput = {
  pack: OrchestratorContextPack;
  triage: TriageResult;
  draftReply: string;
  actionResults: ActionOutcome[];
  toolOnlyFallback: string;
};

/** Deterministic checks — free, always run before LLM judge. */
export function runDeterministicJudge(input: JudgeInput): JudgeResult | null {
  const draft = input.draftReply.trim();
  const tools = input.actionResults.filter((o) => o.message.trim());
  const successes = tools.filter((o) => o.ok);
  const lower = draft.toLowerCase();

  const refusesUpdates =
    /can'?t post|don'?t have a way|use the web|tap into it|add a note/.test(
      lower
    );
  const postedUpdate = successes.some((o) => o.action === "add_task_update");
  if (refusesUpdates && (postedUpdate || input.triage.intent === "post_update")) {
    return {
      verdict: "reject_use_tools",
      issues: ["Refuses post_update capability"],
      fixed_reply: input.toolOnlyFallback,
    };
  }

  if (/#\d+\b/.test(draft) && successes.some((o) => o.action === "get_board_state")) {
    return {
      verdict: "reject_use_tools",
      issues: ["Uses #N instead of title-first board"],
      fixed_reply: input.toolOnlyFallback,
    };
  }

  if (
    input.triage.intent === "ask_task" &&
    looksLikeFullPack(draft)
  ) {
    return {
      verdict: "fix",
      issues: ["Full update dump — must summarize"],
      fixed_reply: input.toolOnlyFallback,
    };
  }

  if (
    successes.length > 0 &&
    draft &&
    !tools.some((o) => draft.includes(o.message.slice(0, 40)))
  ) {
    const inquiryOnly = successes.every(
      (o) =>
        o.action &&
        [
          "get_board_state",
          "read_task",
          "ask_task",
          "list_task_updates",
          "find_task",
        ].includes(o.action)
    );
    if (inquiryOnly && draft.length < input.toolOnlyFallback.length * 0.4) {
      return {
        verdict: "reject_use_tools",
        issues: ["Thin summary over rich tool output"],
        fixed_reply: input.toolOnlyFallback,
      };
    }
  }

  return null;
}

/**
 * Step 3 — verify draft reply before sending (rules + cheap LLM judge).
 */
export async function judgeWhatsAppReply(
  input: JudgeInput
): Promise<JudgeResult> {
  const successes = input.actionResults.filter((o) => o.ok && o.message.trim());

  // Summarized ask_task replies are meant to differ from the raw pack.
  if (
    successes.length > 0 &&
    (input.triage.intent === "board_list" ||
      (input.triage.intent === "read_task" &&
        input.draftReply.includes("What do you want to post")))
  ) {
    return { verdict: "approve", issues: [] };
  }

  if (
    input.triage.intent === "ask_task" &&
    successes.length > 0 &&
    !looksLikeFullPack(input.draftReply)
  ) {
    return { verdict: "approve", issues: [] };
  }

  const deterministic = runDeterministicJudge(input);
  if (deterministic) {
    if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") {
      console.log("[orchestrator] judge deterministic", deterministic.verdict);
    }
    return deterministic;
  }

  if (!openRouterConfigured()) {
    return { verdict: "approve", issues: [] };
  }

  const toolSummary = input.actionResults
    .filter((o) => o.message.trim())
    .map((o) => `[${o.ok ? "ok" : "fail"}:${o.action}] ${o.message}`)
    .join("\n");

  const userBlock =
    formatContextForPrompt(input.pack) +
    `\n\nTriage: ${JSON.stringify({
      intent: input.triage.intent,
      complexity: input.triage.complexity,
      confidence: input.triage.confidence,
      slots: input.triage.slots,
    })}\n\nTool results:\n${toolSummary || "(none)"}\n\nDraft reply:\n${input.draftReply}\n\nTool-only fallback:\n${input.toolOnlyFallback}`;

  try {
    const raw = await openRouterChat({
      model: defaultJudgeModel(),
      temperature: 0,
      maxTokens: 600,
      jsonMode: true,
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: userBlock },
      ],
    });

    const parsed = parseOpenRouterJson<unknown>(raw);
    const result = JudgeResultSchema.safeParse(parsed);
    if (result.success) {
      if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") {
        console.log("[orchestrator] judge", result.data.verdict, result.data.issues);
      }
      return result.data;
    }
    console.error("[orchestrator] judge schema mismatch:", result.error.message);
    return { verdict: "approve", issues: [] };
  } catch (err) {
    console.error("[orchestrator] judge failed:", err);
    return { verdict: "approve", issues: [] };
  }
}

export function applyJudgeVerdict(
  draftReply: string,
  toolOnlyFallback: string,
  judge: JudgeResult
): string {
  switch (judge.verdict) {
    case "approve":
      return draftReply;
    case "fix":
      return judge.fixed_reply?.trim() || draftReply;
    case "reject_use_tools":
      return judge.fixed_reply?.trim() || toolOnlyFallback || draftReply;
    default:
      return draftReply;
  }
}
