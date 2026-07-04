/**
 * Offline + live tests for WhatsApp orchestrator routing.
 *
 * Usage:
 *   npm run test:orchestrator              # fast — refine + route rules (no API)
 *   npm run test:orchestrator -- --live  # Gemini triage on smoke messages
 *   npm run test:orchestrator -- --stress 10  # parallel triage latency
 */
import "dotenv/config";
import { refineTriageResult } from "../lib/whatsapp-orchestrator/refine-triage";
import { pickOrchestratorRoute } from "../lib/whatsapp-orchestrator/route";
import { mockContextPack } from "../lib/whatsapp-orchestrator/test-fixtures";
import { triageWhatsAppMessage } from "../lib/whatsapp-orchestrator/triage";
import {
  shouldPostTaskUpdate,
  isFocusTaskMessage,
} from "../lib/whatsapp-orchestrator/refine-triage";
import { looksLikeFullPack } from "../lib/whatsapp-orchestrator/summarize-ask-task";
import {
  normalizeTriageSlots,
  ragQueryFromTriage,
} from "../lib/whatsapp-orchestrator/normalize-slots";
import { resolveTaskFromBoard, scoreTaskTitleDirect } from "../lib/task-title-search";
import type {
  OrchestratorRoute,
  TriageResult,
  WhatsAppIntent,
} from "../lib/whatsapp-orchestrator/types";

type Case = {
  name: string;
  message: string;
  /** Simulated raw Gemini output before refine */
  rawTriage: Partial<TriageResult> & {
    intent: WhatsAppIntent;
    complexity: TriageResult["complexity"];
    confidence: number;
  };
  expectIntent: WhatsAppIntent;
  expectRoute: OrchestratorRoute;
  mustNotPost?: boolean;
};

const SMOKE_CASES: Case[] = [
  {
    name: "board list",
    message: "What's on my board",
    rawTriage: { intent: "board_list", complexity: "simple", confidence: 1 },
    expectIntent: "board_list",
    expectRoute: "simple",
  },
  {
    name: "focus task not post",
    message: "I want to work on seo queries",
    rawTriage: {
      intent: "post_update",
      complexity: "simple",
      confidence: 0.9,
      slots: { task_ref: "Seo Queries" },
    },
    expectIntent: "read_task",
    expectRoute: "simple",
    mustNotPost: true,
  },
  {
    name: "progress post",
    message: "I have started 2 reddit posts",
    rawTriage: { intent: "post_update", complexity: "simple", confidence: 0.9 },
    expectIntent: "post_update",
    expectRoute: "simple",
  },
  {
    name: "ask task stress test",
    message: "What's going on with the stress test",
    rawTriage: {
      intent: "ask_task",
      complexity: "complex",
      confidence: 0.92,
      slots: { task_ref: "Stress Test Updates System", query: "Stress Test Updates System" },
    },
    expectIntent: "ask_task",
    expectRoute: "sonnet",
  },
  {
    name: "mark done",
    message: "Mark seo queries done",
    rawTriage: { intent: "update_task", complexity: "simple", confidence: 0.9 },
    expectIntent: "update_task",
    expectRoute: "simple",
  },
  {
    name: "switch workspace",
    message: "switch workspace to euclis",
    rawTriage: { intent: "unknown", complexity: "simple", confidence: 0.5 },
    expectIntent: "workspace_admin",
    expectRoute: "haiku",
  },
  {
    name: "create task",
    message: "Add task review Q3 budget",
    rawTriage: { intent: "create_task", complexity: "simple", confidence: 0.85 },
    expectIntent: "create_task",
    expectRoute: "simple",
  },
  {
    name: "ask task updates by name",
    message: "I want to check what are the all updates of Login Page Redesgin task",
    rawTriage: {
      intent: "ask_task",
      complexity: "complex",
      confidence: 0.95,
      slots: { task_ref: "Login Page Redesgin", query: "Login Page Redesgin" },
    },
    expectIntent: "ask_task",
    expectRoute: "sonnet",
  },
  {
    name: "ask task issue typo",
    message: "Hey buddy, what's the issue with Login Page Redesing",
    rawTriage: {
      intent: "ask_task",
      complexity: "complex",
      confidence: 0.9,
      slots: { task_ref: "Login Page Redesgin", query: "Login Page Redesgin" },
    },
    expectIntent: "ask_task",
    expectRoute: "sonnet",
  },
];

function runDeterministicTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  console.log("\n── Deterministic refine + route ──\n");

  for (const c of SMOKE_CASES) {
    const pack = mockContextPack(c.message);
    const raw: TriageResult = {
      intent: c.rawTriage.intent,
      complexity: c.rawTriage.complexity,
      confidence: c.rawTriage.confidence,
      slots: c.rawTriage.slots,
      clarifying_question: c.rawTriage.clarifying_question,
    };
    const refined = refineTriageResult(pack, raw);
    const route = pickOrchestratorRoute(refined);

    const intentOk = refined.intent === c.expectIntent;
    const routeOk = route === c.expectRoute;
    const postOk =
      c.mustNotPost === undefined ||
      shouldPostTaskUpdate(c.message, pack.recent_turns) !== c.mustNotPost;

    if (intentOk && routeOk && postOk) {
      console.log(`✓ ${c.name}`);
      passed++;
    } else {
      console.log(`✗ ${c.name}`);
      if (!intentOk) {
        console.log(`  intent: got ${refined.intent}, want ${c.expectIntent}`);
      }
      if (!routeOk) {
        console.log(`  route:  got ${route}, want ${c.expectRoute}`);
      }
      if (!postOk) {
        console.log(`  shouldPostTaskUpdate mismatch`);
      }
      failed++;
    }
  }

  // Judge helper
  const dump = "*Stress Test* · euclis\nUpdates (20):\n• line\n• line\n• line";
  if (looksLikeFullPack(dump)) {
    console.log("✓ looksLikeFullPack detects update dumps");
    passed++;
  } else {
    console.log("✗ looksLikeFullPack should detect dumps");
    failed++;
  }

  if (isFocusTaskMessage("I want to work on seo queries")) {
    console.log("✓ isFocusTaskMessage");
    passed++;
  } else {
    console.log("✗ isFocusTaskMessage");
    failed++;
  }

  const mockBoard = [
    {
      shortId: 1,
      title: "Login Page Redesgin",
      description: "UI redesign project",
    },
    {
      shortId: 2,
      title: "Backend Api Design",
      description: "API development work",
    },
    {
      shortId: 3,
      title: "New Task Of Marketing",
      description: "marketing initiative",
    },
  ];

  const typoScore = scoreTaskTitleDirect(
    "Login Page Redesgin",
    "Login Page Redesgin"
  );
  if (typoScore >= 0.95) {
    console.log("✓ scoreTaskTitleDirect exact match");
    passed++;
  } else {
    console.log(`✗ scoreTaskTitleDirect exact: ${typoScore}`);
    failed++;
  }

  const typoTolerant = scoreTaskTitleDirect(
    "Login Page Redesing",
    "Login Page Redesgin"
  );
  if (typoTolerant >= 0.72) {
    console.log("✓ scoreTaskTitleDirect tolerates typos on LLM task_ref");
    passed++;
  } else {
    console.log(`✗ scoreTaskTitleDirect typo score: ${typoTolerant}`);
    failed++;
  }

  const resolved = resolveTaskFromBoard(mockBoard, "Login Page Redesgin");
  if (resolved.kind === "one" && resolved.shortId === 1) {
    console.log("✓ resolveTaskFromBoard maps LLM task_ref to board row");
    passed++;
  } else {
    console.log(`✗ resolveTaskFromBoard: ${resolved.kind}`);
    failed++;
  }

  const pack = mockContextPack(
    "I want to check what are the all updates of Login Page Redesgin task"
  );
  const normalized = normalizeTriageSlots(pack, {
    intent: "ask_task",
    complexity: "complex",
    confidence: 0.95,
    slots: { task_ref: "Login Page Redesgin", query: "Login Page Redesgin" },
  });
  const ragQuery = ragQueryFromTriage(normalized, pack.user_message);
  if (ragQuery === "Login Page Redesgin") {
    console.log("✓ ragQueryFromTriage uses LLM slot not full message");
    passed++;
  } else {
    console.log(`✗ ragQueryFromTriage: "${ragQuery}"`);
    failed++;
  }

  const vague = resolveTaskFromBoard(mockBoard, "marketing");
  if (vague.kind === "one" && vague.shortId === 3) {
    console.log("✓ resolveTaskFromBoard partial name");
    passed++;
  } else if (vague.kind !== "one") {
    console.log("✓ resolveTaskFromBoard rejects weak partial matches");
    passed++;
  } else {
    console.log(`✗ resolveTaskFromBoard vague: ${vague.kind}`);
    failed++;
  }

  return { passed, failed };
}

async function runLiveTriage(): Promise<{ passed: number; failed: number }> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error("\n--live requires OPENROUTER_API_KEY in .env\n");
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  console.log("\n── Live Gemini triage (OpenRouter) ──\n");

  for (const c of SMOKE_CASES) {
    const pack = mockContextPack(c.message);
    const raw = await triageWhatsAppMessage(pack);
    const refined = refineTriageResult(pack, raw);
    const route = pickOrchestratorRoute(refined);

    const intentOk = refined.intent === c.expectIntent;
    const routeOk = route === c.expectRoute;

    if (intentOk && routeOk) {
      console.log(
        `✓ ${c.name} → ${refined.intent} / ${route} (${refined.confidence})`
      );
      passed++;
    } else {
      console.log(`✗ ${c.name}`);
      console.log(
        `  raw:     ${raw.intent} / ${raw.complexity} (${raw.confidence})`
      );
      console.log(
        `  refined: ${refined.intent} / ${route} (${refined.confidence})`
      );
      console.log(`  want:    ${c.expectIntent} / ${c.expectRoute}`);
      failed++;
    }
  }

  return { passed, failed };
}

async function runStress(count: number): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error("\n--stress requires OPENROUTER_API_KEY\n");
    process.exit(1);
  }

  const message = "What's going on with the stress test";
  const pack = mockContextPack(message);

  console.log(`\n── Stress: ${count} parallel triage calls ──\n`);

  const start = Date.now();
  const results = await Promise.all(
    Array.from({ length: count }, () => triageWhatsAppMessage(pack))
  );
  const ms = Date.now() - start;

  const intents = results.map((r) => r.intent);
  const askCount = intents.filter((i) => i === "ask_task").length;
  const refined = results.map((r) =>
    refineTriageResult(pack, r)
  );
  const allAsk = refined.every((r) => r.intent === "ask_task");

  console.log(`Total time: ${ms}ms (${(ms / count).toFixed(0)}ms avg)`);
  console.log(`Raw ask_task: ${askCount}/${count}`);
  console.log(`After refine all ask_task: ${allAsk ? "yes" : "NO"}`);

  if (!allAsk) {
    console.log("Intents:", [...new Set(refined.map((r) => r.intent))].join(", "));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const stressIdx = args.indexOf("--stress");
  const stressN =
    stressIdx >= 0 ? Number(args[stressIdx + 1] ?? 10) : 0;

  console.log("WhatsApp orchestrator tests");

  const det = runDeterministicTests();
  console.log(`\nDeterministic: ${det.passed} passed, ${det.failed} failed`);

  if (live) {
    const liveResult = await runLiveTriage();
    console.log(
      `\nLive triage: ${liveResult.passed} passed, ${liveResult.failed} failed`
    );
    if (liveResult.failed > 0) process.exit(1);
  }

  if (stressN > 0) {
    await runStress(stressN);
  }

  if (det.failed > 0) process.exit(1);

  console.log("\nAll deterministic checks passed.");
  if (!live && stressN === 0) {
    console.log("Tip: npm run test:orchestrator -- --live");
    console.log("Tip: npm run test:orchestrator -- --stress 20");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
