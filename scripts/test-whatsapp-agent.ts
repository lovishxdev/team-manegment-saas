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
  pickReplyOutcomes,
  shortenFullPack,
} from "../lib/whatsapp-reply-guard";
import {
  resolveTaskFromBoard,
  scoreTaskTitleDirect,
} from "../lib/task-title-search";
import { mcpTools, whatsappAnthropicTools } from "../lib/tools/registry";
import { formatWhatsAppUserReply } from "../lib/whatsapp-voice";
import { buildTaskSnapshot } from "../lib/services/action-log";
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

// "Login page" → ask_task (lookup) → add_task_update (mutation): the user
// must see only the posted confirmation, never the intermediate task dump.
const chained = pickReplyOutcomes([
  {
    action: "ask_task",
    ok: true,
    message:
      "• *Login Page Redesign* · Landing Page Site\nMatch: 87%\nStatus: TODO · General · MEDIUM",
  },
  { action: "add_task_update", ok: true, message: "Posted on *Login Page Redesign*." },
]);
check(
  "inquiry-then-mutation drops the intermediate lookup output",
  chained.length === 1 && chained[0].action === "add_task_update"
);

const inquiryOnly = pickReplyOutcomes([
  { action: "ask_task", ok: true, message: "*Login Page Redesign* status…" },
]);
check(
  "pure inquiry outcomes are kept",
  inquiryOnly.length === 1 && inquiryOnly[0].action === "ask_task"
);

// Reply assembly must pass tool copy through untouched — final copy lives in
// the tool handlers, not in a rewriting layer.
check(
  "single success passes through verbatim",
  formatWhatsAppUserReply(
    [{ action: "create_task", ok: true, message: "Added *Review Q3 Budget* (high priority)." }],
    false,
    null
  ) === "Added *Review Q3 Budget* (high priority)."
);
check(
  "mixed outcomes get ✓/✗ assembly without rewriting",
  formatWhatsAppUserReply(
    [
      { action: "create_task", ok: true, message: "Added *A*." },
      { action: "update_task", ok: false, message: "I couldn't find that task on your board." },
    ],
    false,
    null
  ).startsWith("✓ Added *A*.\n✗ I couldn't find that task on your board.")
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

// ── add_task_update contract: the MODEL owns NL understanding ───────────
// No regex classifies progress reports; the schema forces the model to pass
// the update text explicitly, so "just uploaded the files" etc. work by
// contract, not by verb list.

const addUpdate = whatsappAnthropicTools().find(
  (t) => t.name === "add_task_update"
)!;
const addUpdateSchema = addUpdate.input_schema as {
  required?: string[];
  properties?: Record<string, unknown>;
};
check(
  "add_task_update requires body from the model (no NL mining in code)",
  (addUpdateSchema.required ?? []).includes("body")
);
check(
  "add_task_update keeps shortId optional (resolved from chat state)",
  !(addUpdateSchema.required ?? []).includes("shortId")
);

// ── Prompt-cache breakpoint ──────────────────────────────────────────────
// Every tool ships its full schema (no deferral — the model must never
// guess argument shapes); the breakpoint on the last tool caches the block.

type TestTool = { name: string; cache_control?: unknown };
const cached = applyToolCacheBreakpoint([
  { name: "a" },
  { name: "b" },
] as never[]) as TestTool[];
check(
  "cache breakpoint lands on the last tool",
  !cached[0].cache_control && Boolean(cached[1].cache_control)
);
check(
  "all registry tools expose full schemas (no defer_loading anywhere)",
  whatsappAnthropicTools().every(
    (t) => !(t as { defer_loading?: boolean }).defer_loading
  )
);

// ── Undo: journaled inverses, model only decides WHEN ───────────────────

check(
  "undo_last_action exists on both channels",
  whatsappAnthropicTools().some((t) => t.name === "undo_last_action") &&
    mcpTools().some((t) => t.name === "undo_last_action")
);

const snapshot = buildTaskSnapshot(
  {
    title: "Login Page Redesign",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    tags: ["ui"],
    categoryId: "cat-1",
    assigneeIds: ["u1"],
  },
  { status: "DONE", priority: "HIGH" }
);
check(
  "snapshot captures only fields being changed",
  snapshot.status === "TODO" &&
    snapshot.priority === "MEDIUM" &&
    snapshot.title === undefined &&
    snapshot.tags === undefined &&
    snapshot.assigneeIds === undefined
);

const assigneeSnapshot = buildTaskSnapshot(
  {
    title: "T",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: new Date("2026-07-10T12:00:00Z"),
    tags: [],
    categoryId: "c",
    assigneeIds: ["u1", "u2"],
  },
  { assignee: "someone", dueDate: "" }
);
check(
  "snapshot captures assignees and due date when changing",
  JSON.stringify(assigneeSnapshot.assigneeIds) === '["u1","u2"]' &&
    assigneeSnapshot.dueDate === "2026-07-10T12:00:00.000Z"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
