import type { OrchestratorContextPack } from "@/lib/whatsapp-orchestrator/context-pack";
import type { TriageResult, TriageSlots } from "@/lib/whatsapp-orchestrator/types";
import {
  isAffirmationOnly,
  isProgressReport,
  resolveTaskUpdateBody,
} from "@/lib/whatsapp-task-context";

const FOCUS_TASK =
  /\b(?:want to|wanna)\s+(?:work on|focus on)|\bwork on\b|\bfocus on\b|\bswitch to\b|\bstart (?:working )?on\b/i;

const ASK_TASK =
  /\bwhat'?s going on\b|\bwhat happened\b|\bwhat'?s the (?:status|update|latest)\b|\btell me about\b|\bhow is\b.*\bgoing\b|\bcurrent\b.*\bon\b/i;

/** User wants to discuss a task — not post a progress note. */
export function isFocusTaskMessage(text: string): boolean {
  return FOCUS_TASK.test(text.trim());
}

export function isAskTaskMessage(text: string): boolean {
  return ASK_TASK.test(text.trim());
}

/** Only true when we should actually write a task update. */
export function shouldPostTaskUpdate(
  userMessage: string,
  turns: { role: string; content: string }[],
  slots?: TriageSlots
): boolean {
  const msg = userMessage.trim();
  if (!msg) return false;
  if (isFocusTaskMessage(msg)) return false;
  if (/^(i )?want to (post|add|write)/i.test(msg)) return true;
  if (isProgressReport(msg)) return true;
  if (isAffirmationOnly(msg)) {
    return Boolean(resolveTaskUpdateBody("", msg, turns as never));
  }
  if (slots?.body?.trim() && isProgressReport(slots.body)) return true;
  return false;
}

/**
 * Code-owned corrections after LLM triage — prevents costly misroutes.
 */
export function refineTriageResult(
  pack: OrchestratorContextPack,
  triage: TriageResult
): TriageResult {
  const msg = pack.user_message.trim();
  const slots = { ...triage.slots };

  if (isAskTaskMessage(msg)) {
    return {
      ...triage,
      intent: "ask_task",
      complexity: "complex",
      confidence: Math.max(triage.confidence, 0.88),
      slots: { ...slots, query: msg },
    };
  }

  if (isFocusTaskMessage(msg)) {
    const taskRef =
      slots.task_ref ||
      msg.replace(
        /.*(?:work on|focus on|switch to|start (?:working )?on)\s+/i,
        ""
      ).trim();
    return {
      ...triage,
      intent: "read_task",
      complexity: "simple",
      confidence: Math.max(triage.confidence, 0.9),
      slots: { ...slots, task_ref: taskRef || slots.task_ref },
    };
  }

  if (
    triage.intent === "post_update" &&
    !shouldPostTaskUpdate(msg, pack.recent_turns, slots)
  ) {
    if (isFocusTaskMessage(msg)) {
      return {
        ...triage,
        intent: "read_task",
        complexity: "simple",
        confidence: 0.9,
        slots,
      };
    }
    return {
      ...triage,
      intent: "unknown",
      complexity: "complex",
      confidence: Math.min(triage.confidence, 0.5),
    };
  }

  return { ...triage, slots };
}
