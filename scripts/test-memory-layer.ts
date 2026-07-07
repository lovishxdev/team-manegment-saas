/**
 * Deterministic tests for the decision-memory layer's code-owned pieces:
 * scope enforcement, event formatting, blocker nudges, and button parsing.
 * (The capture classifier itself is an LLM call — exercised in staging, not
 * here.)
 *
 * Run: npm run test:memory
 */
import "dotenv/config";
import {
  ALL_TOOLS,
  CONTEXT_SCOPE_TOOL_NAMES,
  isToolAllowedForScope,
  normalizeMcpScope,
} from "../lib/tools/registry";
import {
  deriveDecisionFromMessage,
  formatMemoryEvent,
  formatMemoryEvents,
} from "../lib/tools/defs/memory";
import { formatOpenBlockerNudge } from "../lib/memory/suggest";
import { memoryEventDocument, type MemoryEventRow } from "../lib/services/memory";
import { BUTTON, parseButtonId } from "../lib/whatsapp-interactive";

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

// ── MCP tool scopes ─────────────────────────────────────────────────────

check(
  "context scope allows memory + read tools",
  ["recall_memory", "list_blockers", "get_project_context", "read_task", "add_task_update"].every(
    (t) => isToolAllowedForScope(t, "context")
  )
);

check(
  "context scope blocks destructive/admin tools",
  ["delete_task", "remove_member", "promote_member", "create_task", "delete_asset", "leave_workspace"].every(
    (t) => !isToolAllowedForScope(t, "context")
  )
);

check(
  "full scope allows everything",
  ["delete_task", "recall_memory", "export_whiteboard"].every((t) =>
    isToolAllowedForScope(t, "full")
  )
);

const registryNames = new Set(ALL_TOOLS.map((t) => t.name));
const stale = [...CONTEXT_SCOPE_TOOL_NAMES].filter(
  (t) => !registryNames.has(t)
);
check(
  "context scope list has no stale tool names",
  stale.length === 0,
  `stale: ${stale.join(", ")}`
);

check(
  "unknown scope strings normalize to context (safe default)",
  normalizeMcpScope(undefined) === "context" &&
    normalizeMcpScope("banana") === "context" &&
    normalizeMcpScope("full") === "full"
);

// ── Event formatting ────────────────────────────────────────────────────

const sampleEvent: MemoryEventRow = {
  id: "11111111-2222-3333-4444-555555555555",
  kind: "BLOCKER",
  status: "OPEN",
  summary: "Design files for the login redesign are missing.",
  reasoning: "Figma export was never shared by the design contractor.",
  tags: ["design-handoff"],
  createdAt: new Date("2026-07-01T10:00:00Z"),
  resolvedAt: null,
  supersededByEventId: null,
  author: { id: "u1", username: "priya", email: null },
  task: { shortId: 12, title: "Login page redesign" },
};

const formatted = formatMemoryEvent(sampleEvent);
check(
  "formatMemoryEvent includes kind, status, summary, why, author, task, id",
  formatted.includes("[BLOCKER · OPEN]") &&
    formatted.includes("Design files for the login redesign are missing.") &&
    formatted.includes("why: Figma export") &&
    formatted.includes("@priya") &&
    formatted.includes('#12 "Login page redesign"') &&
    formatted.includes(sampleEvent.id),
  formatted
);

const resolvedDecision: MemoryEventRow = {
  ...sampleEvent,
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  kind: "DECISION",
  status: "RESOLVED",
  reasoning: null,
  task: null,
};
const formattedDecision = formatMemoryEvent(resolvedDecision);
check(
  "formatMemoryEvent omits OPEN flag, why, and task when absent",
  formattedDecision.includes("[DECISION]") &&
    !formattedDecision.includes("OPEN") &&
    !formattedDecision.includes("why:") &&
    !formattedDecision.includes("task #"),
  formattedDecision
);

check(
  "formatMemoryEvents joins multiple records",
  formatMemoryEvents([sampleEvent, resolvedDecision]).split("\n- ").length === 2
);

// ── Blocker nudge (MCP pull-based alerting) ─────────────────────────────

check("nudge is empty for no blockers", formatOpenBlockerNudge([]) === "");

const nudge = formatOpenBlockerNudge([sampleEvent]);
check(
  "nudge lists blocker and instructs confirm-then-resolve",
  nudge.includes("Open blockers on this task") &&
    nudge.includes(sampleEvent.id) &&
    nudge.includes("confirm with the user") &&
    nudge.includes("resolve_blocker"),
  nudge
);

// ── Embedding document ──────────────────────────────────────────────────

check(
  "memoryEventDocument combines summary + reasoning",
  memoryEventDocument({ summary: "A", reasoning: "B" }) === "A\nB" &&
    memoryEventDocument({ summary: "A", reasoning: null }) === "A"
);

// ── record_decision fallback (WhatsApp models may send empty args) ──────

const derived = deriveDecisionFromMessage(
  "log a decision: we're using Figma for all design handoffs because the contractor works there"
);
check(
  "decision fallback strips prefix and splits 'because' into reasoning",
  derived?.summary === "we're using Figma for all design handoffs" &&
    derived?.reasoning === "the contractor works there",
  JSON.stringify(derived)
);

check(
  "decision fallback works without 'because'",
  deriveDecisionFromMessage("note that decision - dark mode ships in v2")
    ?.summary === "dark mode ships in v2" ||
    deriveDecisionFromMessage("record decision: dark mode ships in v2")
      ?.summary === "dark mode ships in v2"
);

check(
  "decision fallback returns null for empty remainder",
  deriveDecisionFromMessage("log a decision:") === null
);

// ── WhatsApp suggestion buttons ─────────────────────────────────────────

const eventId = "11111111-2222-3333-4444-555555555555";
const confirmParsed = parseButtonId(BUTTON.memoryResolveConfirm(eventId));
check(
  "mem_resolve button round-trips",
  confirmParsed?.type === "memory_resolve_confirm" &&
    confirmParsed.eventId === eventId
);

const dismissParsed = parseButtonId(BUTTON.memoryResolveDismiss(eventId));
check(
  "mem_dismiss button round-trips",
  dismissParsed?.type === "memory_resolve_dismiss" &&
    dismissParsed.eventId === eventId
);

check(
  "malformed memory button ids are rejected",
  parseButtonId("mem_resolve_not-a-uuid") === null
);

// ────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
