import type { OrchestratorContextPack } from "@/lib/whatsapp-orchestrator/context-pack";
import { normalizeTriageSlots } from "@/lib/whatsapp-orchestrator/normalize-slots";
import type { TriageResult, TriageSlots } from "@/lib/whatsapp-orchestrator/types";
import {
  isAffirmationOnly,
  isProgressReport,
  resolveTaskUpdateBody,
} from "@/lib/whatsapp-task-context";

const FOCUS_TASK =
  /\b(?:want to|wanna)\s+(?:work on|focus on)|\bwork on\b|\bfocus on\b|\bswitch to\b|\bstart (?:working )?on\b/i;

/** User wants to discuss a task — not post a progress note. */
export function isFocusTaskMessage(text: string): boolean {
  return FOCUS_TASK.test(text.trim());
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
 * Code-owned corrections after LLM triage — intent guards only, not title parsing.
 * Task names come from triage slots; normalizeTriageSlots maps them to the board.
 */
export function refineTriageResult(
  pack: OrchestratorContextPack,
  triage: TriageResult
): TriageResult {
  const msg = pack.user_message.trim();
  const slots = { ...triage.slots };
  let result = triage;

  if (isFocusTaskMessage(msg) && triage.intent === "post_update") {
    result = {
      ...triage,
      intent: "read_task",
      complexity: "simple",
      confidence: Math.max(triage.confidence, 0.9),
      slots,
    };
  }

  const switchWs = msg.match(
    /switch\s+(?:workspace\s+)?to\s+(.+?)(?:\s+then\b|$)/i
  );
  if (switchWs) {
    result = {
      ...triage,
      intent: "workspace_admin",
      complexity: "simple",
      confidence: 0.9,
      slots: { ...slots, query: switchWs[1].trim() },
    };
  }

  if (
    result.intent === "post_update" &&
    !shouldPostTaskUpdate(msg, pack.recent_turns, slots)
  ) {
    if (isFocusTaskMessage(msg)) {
      result = {
        ...result,
        intent: "read_task",
        complexity: "simple",
        confidence: 0.9,
        slots,
      };
    } else {
      result = {
        ...result,
        intent: "unknown",
        complexity: "complex",
        confidence: Math.min(result.confidence, 0.5),
      };
    }
  }

  return normalizeTriageSlots(pack, { ...result, slots });
}
