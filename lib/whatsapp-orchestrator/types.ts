import { z } from "zod";

/** What the user is trying to do — stable contract for routing + execution. */
export const WhatsAppIntentSchema = z.enum([
  "greeting",
  "menu",
  "board_list",
  "create_task",
  "update_task",
  "post_update",
  "ask_task",
  "read_task",
  "delete_task",
  "search_tasks",
  "workspace_admin",
  "assets_links",
  "compound",
  "chitchat",
  "unknown",
]);

export type WhatsAppIntent = z.infer<typeof WhatsAppIntentSchema>;

export const ComplexitySchema = z.enum(["simple", "complex"]);

export type Complexity = z.infer<typeof ComplexitySchema>;

export const TriageSlotsSchema = z.object({
  task_ref: z.string().optional(),
  task_title: z.string().optional(),
  body: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  title: z.string().optional(),
  query: z.string().optional(),
});

export type TriageSlots = z.infer<typeof TriageSlotsSchema>;

/** Step 1 output — cheap triage model (Gemini Flash via OpenRouter). */
export const TriageResultSchema = z.object({
  intent: WhatsAppIntentSchema,
  complexity: ComplexitySchema,
  confidence: z.number().min(0).max(1),
  slots: TriageSlotsSchema.optional(),
  clarifying_question: z.string().optional(),
  reasoning: z.string().optional(),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;

export const JudgeVerdictSchema = z.enum([
  "approve",
  "fix",
  "reject_use_tools",
]);

export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

/** Step 3 output — verification before sending to user. */
export const JudgeResultSchema = z.object({
  verdict: JudgeVerdictSchema,
  issues: z.array(z.string()).default([]),
  fixed_reply: z.string().optional(),
  reasoning: z.string().optional(),
});

export type JudgeResult = z.infer<typeof JudgeResultSchema>;

export type OrchestratorRoute = "simple" | "haiku" | "sonnet" | "clarify";

export type OrchestratorResult = {
  reply: string | null;
  route: OrchestratorRoute;
  triage: TriageResult;
  judge?: JudgeResult;
};

export const SIMPLE_INTENTS: ReadonlySet<WhatsAppIntent> = new Set([
  "board_list",
  "create_task",
  "update_task",
  "post_update",
  "menu",
]);

export function defaultTriageModel(): string {
  return (
    process.env.WHATSAPP_TRIAGE_MODEL?.trim() || "google/gemini-2.5-flash"
  );
}

export function defaultJudgeModel(): string {
  return process.env.WHATSAPP_JUDGE_MODEL?.trim() || defaultTriageModel();
}

export function simpleAgentModel(): string {
  return process.env.WHATSAPP_SIMPLE_MODEL?.trim() || "claude-haiku-4-5";
}

export function complexAgentModel(): string {
  return (
    process.env.WHATSAPP_COMPLEX_MODEL?.trim() || "claude-sonnet-4-5"
  );
}

export function isOrchestratorEnabled(): boolean {
  const flag = process.env.WHATSAPP_ORCHESTRATOR?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function isJudgeEnabled(): boolean {
  const flag = process.env.WHATSAPP_JUDGE?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return isOrchestratorEnabled();
}

/** Minimum triage confidence to run deterministic simple executor. */
export function simpleExecuteMinConfidence(): number {
  const raw = process.env.WHATSAPP_SIMPLE_CONFIDENCE?.trim();
  const n = raw ? Number(raw) : 0.82;
  return Number.isFinite(n) ? Math.min(1, Math.max(0.5, n)) : 0.82;
}
