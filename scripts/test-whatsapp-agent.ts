/**
 * Deterministic tests for the WhatsApp agent's code-owned layers:
 * reply guard, task title matching, and update-body heuristics.
 *
 * Run: npm run test:whatsapp
 */
import "dotenv/config";
import {
  guardWhatsAppReply,
  looksLikeFullPack,
  shortenFullPack,
} from "../lib/whatsapp-reply-guard";
import {
  resolveTaskFromBoard,
  scoreTaskTitleDirect,
} from "../lib/task-title-search";
import {
  isAffirmationOnly,
  isProgressReport,
} from "../lib/whatsapp-task-context";
import { applyToolCacheBreakpoint } from "../lib/whatsapp-agent-loop";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ── Reply guard ──────────────────────────────────────────────────────────

const okOutcome = { action: "add_task_update", ok: true, message: "Posted on *Seo Queries*." };

check(
  "guard converts **markdown** bold to *whatsapp* bold",
  guardWhatsAppReply({
    draft: "Updated **Seo Queries** just now",
    toolFallback: "x",
    actionResults: [],
  }) === "Updated *Seo Queries* just now"
);

check(
  "guard strips (#N) suffixes and bare #N ids",
  guardWhatsAppReply({
    draft: "*Login Page Redesgin* (#4) is blocked — see task #4 for details",
    toolFallback: "x",
    actionResults: [],
  }) === "*Login Page Redesgin* is blocked — see task for details"
);

check(
  "guard falls back when model refuses a capability a tool just used",
  guardWhatsAppReply({
    draft: "I can't post updates from WhatsApp — use the web app.",
    toolFallback: "Posted on *Seo Queries*.",
    actionResults: [okOutcome],
  }) === "Posted on *Seo Queries*."
);

check(
  "guard uses tool fallback for empty drafts",
  guardWhatsAppReply({
    draft: "  ",
    toolFallback: "Created *Review Q3 Budget*.",
    actionResults: [],
  }) === "Created *Review Q3 Budget*."
);

const pack =
  "*Stress Test Updates System* · euclis\nUpdates (20):\n" +
  "• 2026-07-01 10:00 · @lovish\n  Kicked off the stress test plan\n\n" +
  "• 2026-07-02 11:00 · @sarvikiitd\n  BetaCorp budget approved at 40k\n\n" +
  "• 2026-07-03 12:00 · @lovish\n  Blocked on rate limits\n\n" +
  "• 2026-07-04 13:00 · @sarvikiitd\n  Retry queue shipped\n";

check("looksLikeFullPack detects raw RAG packs", looksLikeFullPack(pack));
check(
  "shortenFullPack keeps title + recent updates",
  shortenFullPack(pack).startsWith("*Stress Test Updates System*") &&
    shortenFullPack(pack).includes("Retry queue shipped") &&
    !shortenFullPack(pack).includes("Updates (20):")
);
check(
  "guard compresses a leaked full pack",
  !looksLikeFullPack(
    guardWhatsAppReply({ draft: pack, toolFallback: pack, actionResults: [] })
  )
);

const longDraft = "a".repeat(5000);
check(
  "guard caps replies under the WhatsApp limit",
  guardWhatsAppReply({ draft: longDraft, toolFallback: "x", actionResults: [] })
    .length <= 3905
);

// ── Task title matching (typo tolerance) ────────────────────────────────

const board = [
  { shortId: 1, title: "Login Page Redesgin", description: "UI redesign project" },
  { shortId: 2, title: "Backend Api Design", description: "API development work" },
  { shortId: 3, title: "New Task Of Marketing", description: "marketing initiative" },
];

check(
  "exact title scores 1",
  scoreTaskTitleDirect("Login Page Redesgin", "Login Page Redesgin") >= 0.95
);
check(
  "typo'd title still scores high (Redesing vs Redesgin)",
  scoreTaskTitleDirect("Login Page Redesing", "Login Page Redesgin") >= 0.72
);
const resolved = resolveTaskFromBoard(board, "Login Page Redesgin");
check(
  "resolveTaskFromBoard picks the named task",
  resolved.kind === "one" && resolved.shortId === 1,
  `got ${resolved.kind}`
);

// ── Progress / affirmation heuristics (used by add_task_update tool) ────

check("progress report detected", isProgressReport("I have started 2 reddit posts"));
check("focus message is not a progress report", !isProgressReport("I want to work on seo queries"));
check("affirmation detected", isAffirmationOnly("yes post that"));

// ── Prompt-cache breakpoint vs deferred tools ───────────────────────────
// The API rejects tools with both defer_loading and cache_control set.

type TestTool = { name: string; defer_loading?: boolean; cache_control?: unknown };
const mkTool = (name: string, defer?: boolean): TestTool =>
  defer ? { name, defer_loading: true } : { name };

const plain = applyToolCacheBreakpoint([
  mkTool("a"),
  mkTool("b"),
] as never[]) as TestTool[];
check(
  "cache breakpoint lands on last tool when none deferred",
  !plain[0].cache_control && Boolean(plain[1].cache_control)
);

const mixed = applyToolCacheBreakpoint([
  mkTool("core"),
  mkTool("deferred1", true),
  mkTool("deferred2", true),
] as never[]) as TestTool[];
check(
  "cache breakpoint skips deferred tools (lands on last non-deferred)",
  Boolean(mixed[0].cache_control) &&
    !mixed[1].cache_control &&
    !mixed[2].cache_control
);

const allDeferred = applyToolCacheBreakpoint([
  mkTool("d1", true),
  mkTool("d2", true),
] as never[]) as TestTool[];
check(
  "no cache breakpoint when every tool is deferred",
  allDeferred.every((t) => !t.cache_control)
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
