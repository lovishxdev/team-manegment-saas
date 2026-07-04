import {
  simpleExecuteMinConfidence,
  SIMPLE_INTENTS,
  type OrchestratorRoute,
  type TriageResult,
} from "@/lib/whatsapp-orchestrator/types";

/** Map triage output to execution path. */
export function pickOrchestratorRoute(triage: TriageResult): OrchestratorRoute {
  if (triage.clarifying_question && triage.confidence < 0.6) {
    return "clarify";
  }
  if (triage.intent === "ask_task") {
    return "sonnet";
  }
  if (
    triage.complexity === "simple" &&
    SIMPLE_INTENTS.has(triage.intent) &&
    triage.confidence >= simpleExecuteMinConfidence()
  ) {
    return "simple";
  }
  if (triage.intent === "read_task" && triage.complexity === "simple") {
    return "simple";
  }
  return triage.complexity === "complex" ? "sonnet" : "haiku";
}
