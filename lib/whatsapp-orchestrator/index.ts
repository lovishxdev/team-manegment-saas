import Anthropic from "@anthropic-ai/sdk";
import type { ConversationTurn } from "@/lib/services/conversation";
import type { ActionOutcome } from "@/lib/channel-formatters";
import { formatWhatsAppUserReply } from "@/lib/whatsapp-voice";
import { runWhatsAppAgentLoop } from "@/lib/whatsapp-agent-loop";
import { buildOrchestratorContext } from "@/lib/whatsapp-orchestrator/context-pack";
import { executeSimpleIntent } from "@/lib/whatsapp-orchestrator/execute-simple";
import {
  applyJudgeVerdict,
  judgeWhatsAppReply,
} from "@/lib/whatsapp-orchestrator/judge";
import { triageWhatsAppMessage } from "@/lib/whatsapp-orchestrator/triage";
import {
  toolsForIntent,
  triageSystemAugment,
} from "@/lib/whatsapp-orchestrator/tools-for-intent";
import {
  complexAgentModel,
  isJudgeEnabled,
  simpleAgentModel,
  simpleExecuteMinConfidence,
  SIMPLE_INTENTS,
  type OrchestratorResult,
  type OrchestratorRoute,
  type TriageResult,
} from "@/lib/whatsapp-orchestrator/types";

export type OrchestratorDeps = {
  userId: string;
  userMessage: string;
  history: ConversationTurn[];
  workspaceId: string | null;
  workspaceName: string | null;
  lastDiscussedTaskShortId: number | null;
  session?: {
    lastCreatedTask: { shortId: number; workspaceId: string; title: string } | null;
    createdTaskShortIds: number[];
    lastDiscussedTaskShortId: number | null;
  };
  buildSystemPrompt: (workspaceName: string | null) => string;
  allTools: Anthropic.Tool[];
  buildHaikuTools: (
    tools: Anthropic.Tool[]
  ) => Anthropic.Tool[] | Anthropic.ToolUnion[] | undefined;
  maxToolTurns: number;
  executeAction: (
    action: string,
    input: Record<string, unknown>
  ) => Promise<string>;
  onProgress?: (action: string, result: string) => void | Promise<void>;
};

function pickRoute(triage: TriageResult): OrchestratorRoute {
  if (
    triage.clarifying_question &&
    triage.confidence < 0.6
  ) {
    return "clarify";
  }
  if (
    triage.complexity === "simple" &&
    SIMPLE_INTENTS.has(triage.intent) &&
    triage.confidence >= simpleExecuteMinConfidence()
  ) {
    return "simple";
  }
  return triage.complexity === "complex" ? "sonnet" : "haiku";
}

/**
 * Multi-step WhatsApp orchestration:
 * 1. Triage (Gemini Flash via OpenRouter)
 * 2. Simple executor | Haiku | Sonnet agent
 * 3. Judge (rules + Gemini Flash)
 */
export async function runWhatsAppOrchestrator(
  deps: OrchestratorDeps
): Promise<OrchestratorResult> {
  const pack = await buildOrchestratorContext({
    userMessage: deps.userMessage,
    workspaceId: deps.workspaceId,
    workspaceName: deps.workspaceName,
    turns: deps.history,
    lastDiscussedTaskShortId: deps.lastDiscussedTaskShortId,
  });

  const triage = await triageWhatsAppMessage(pack);
  const route = pickRoute(triage);

  if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") {
    console.log("[orchestrator] route", route, triage.intent, triage.confidence);
  }

  if (route === "clarify" && triage.clarifying_question) {
    return {
      reply: triage.clarifying_question,
      route: "clarify",
      triage,
    };
  }

  let actionResults: ActionOutcome[] = [];
  let draftReply: string | null = null;
  let budgetExhausted = false;

  if (route === "simple") {
    const simple = await executeSimpleIntent({
      userId: deps.userId,
      userMessage: deps.userMessage,
      turns: deps.history,
      lastDiscussedTaskShortId: deps.lastDiscussedTaskShortId,
      triage,
      session: deps.session,
    });
    if (simple) {
      actionResults = simple.actionResults;
      draftReply = simple.reply;
    } else {
      // Triage was confident but executor couldn't resolve — fall through to agent.
      return runAgentPath(deps, pack, triage, "haiku");
    }
  } else {
    const agentRoute = route === "sonnet" ? "sonnet" : "haiku";
    return runAgentPath(deps, pack, triage, agentRoute);
  }

  const toolOnlyFallback =
    actionResults.length > 0
      ? formatWhatsAppUserReply(actionResults, budgetExhausted, null)
      : draftReply ?? "";

  let finalReply = draftReply ?? toolOnlyFallback;

  if (isJudgeEnabled() && finalReply) {
    const judge = await judgeWhatsAppReply({
      pack,
      triage,
      draftReply: finalReply,
      actionResults,
      toolOnlyFallback,
    });
    finalReply = applyJudgeVerdict(finalReply, toolOnlyFallback, judge);
    return { reply: finalReply, route, triage, judge };
  }

  return { reply: finalReply, route, triage };
}

async function runAgentPath(
  deps: OrchestratorDeps,
  pack: Awaited<ReturnType<typeof buildOrchestratorContext>>,
  triage: TriageResult,
  agentRoute: "haiku" | "sonnet"
): Promise<OrchestratorResult> {
  const model =
    agentRoute === "sonnet" ? complexAgentModel() : simpleAgentModel();
  const complex = agentRoute === "sonnet" || triage.complexity === "complex";
  const narrowed = toolsForIntent(deps.allTools, triage.intent, complex);
  const tools = deps.buildHaikuTools(narrowed) ?? narrowed;

  const system =
    deps.buildSystemPrompt(deps.workspaceName) +
    triageSystemAugment(triage);

  const messages: Anthropic.MessageParam[] = [
    ...deps.history,
    { role: "user", content: deps.userMessage },
  ];

  const anthropic = new Anthropic();
  const loop = await runWhatsAppAgentLoop({
    anthropic,
    model,
    systemPrompt: system,
    tools,
    messages,
    maxTurns: deps.maxToolTurns,
    runTool: deps.executeAction,
    onProgress: deps.onProgress,
  });

  const withMessage = loop.actionResults.filter((o) => o.message.trim());
  const staticFallback =
    "Tell me what to add or change on your board — or send *menu*.";

  let draftReply: string | null = null;
  if (withMessage.length > 0) {
    draftReply = formatWhatsAppUserReply(
      loop.actionResults,
      loop.budgetExhausted,
      null
    );
  } else if (loop.reply) {
    draftReply = loop.reply;
  } else {
    draftReply = staticFallback;
  }

  const toolOnlyFallback =
    withMessage.length > 0
      ? formatWhatsAppUserReply(loop.actionResults, loop.budgetExhausted, null)
      : staticFallback;

  let finalReply = draftReply;

  if (isJudgeEnabled() && finalReply) {
    const judge = await judgeWhatsAppReply({
      pack,
      triage,
      draftReply: finalReply,
      actionResults: loop.actionResults,
      toolOnlyFallback,
    });
    finalReply = applyJudgeVerdict(finalReply, toolOnlyFallback, judge);
    return {
      reply: finalReply,
      route: agentRoute,
      triage,
      judge,
    };
  }

  return { reply: finalReply, route: agentRoute, triage };
}

export {
  isOrchestratorEnabled,
  isJudgeEnabled,
  type TriageResult,
  type OrchestratorResult,
} from "@/lib/whatsapp-orchestrator/types";
