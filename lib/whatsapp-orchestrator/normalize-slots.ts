import type { OrchestratorContextPack } from "@/lib/whatsapp-orchestrator/context-pack";
import type { TriageResult } from "@/lib/whatsapp-orchestrator/types";
import { resolveTaskFromBoard } from "@/lib/task-title-search";

/** Task phrase from triage — LLM-owned, not parsed from raw message in code. */
export function taskRefFromTriage(triage: TriageResult): string | null {
  return (
    triage.slots?.task_title?.trim() ||
    triage.slots?.task_ref?.trim() ||
    null
  );
}

/** Query passed to RAG / ask_task tools — prefer LLM slot, not full chat text. */
export function ragQueryFromTriage(
  triage: TriageResult,
  userMessage: string
): string {
  const ref = taskRefFromTriage(triage);
  if (ref) return ref;
  return userMessage.trim();
}

/**
 * After triage: map LLM task_ref onto canonical board titles (typo tolerance).
 * Code validates identity; the model extracts names.
 */
export function normalizeTriageSlots(
  pack: OrchestratorContextPack,
  triage: TriageResult
): TriageResult {
  const slots = { ...(triage.slots ?? {}) };

  if (slots.task_short_id != null && pack.board_tasks.length > 0) {
    const hit = pack.board_tasks.find(
      (t) => t.shortId === slots.task_short_id
    );
    if (hit) {
      slots.task_ref = hit.title;
      slots.task_title = hit.title;
    }
  }

  const ref = slots.task_ref?.trim() || slots.task_title?.trim();
  if (ref && pack.board_tasks.length > 0) {
    const board = pack.board_tasks.map((t) => ({
      shortId: t.shortId,
      title: t.title,
      description: null as string | null,
    }));
    const matched = resolveTaskFromBoard(board, ref);
    if (matched.kind === "one") {
      slots.task_ref = matched.title;
      slots.task_title = matched.title;
    }
  } else if (
    !ref &&
    pack.last_discussed_task_short_id &&
    pack.board_tasks.length > 0
  ) {
    const last = pack.board_tasks.find(
      (t) => t.shortId === pack.last_discussed_task_short_id
    );
    if (last && (triage.intent === "post_update" || triage.intent === "ask_task")) {
      slots.task_ref = last.title;
      slots.task_title = last.title;
    }
  }

  if (triage.intent === "ask_task" && slots.task_ref) {
    slots.query = slots.task_ref;
  }

  return { ...triage, slots };
}
