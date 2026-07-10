/**
 * Workspace picker reply matching.
 * Run: npx tsx scripts/test-workspace-pick.ts
 */
import {
  findWorkspaceMentionedInMessage,
  matchWorkspaceByPickReply,
  normalizeWorkspacePickReply,
  parseWorkspacePickId,
} from "../lib/whatsapp-workspace";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.log(`✗ ${label}`);
    failed++;
  } else {
    console.log(`✓ ${label}`);
  }
}

const workspaces = [
  { id: "ws-1", name: "Euclis" },
  { id: "ws-2", name: "Landing Page Site" },
  { id: "ws-3", name: "Euclis Internal Tools Platform" },
  { id: "ws-4", name: "My Team" },
  { id: "ws-5", name: "My Teams" },
];

assert(
  "parses ws_pick id",
  parseWorkspacePickId("ws_pick_ws-1") === "ws-1"
);

assert(
  "normalizes list row text",
  normalizeWorkspacePickReply("Euclis\nUse this workspace") === "Euclis"
);

assert(
  "normalizes single-line suffix",
  normalizeWorkspacePickReply("Landing Page Site use this workspace") ===
    "Landing Page Site"
);

const listPick = matchWorkspaceByPickReply(
  workspaces,
  "Euclis\nUse this workspace"
);
assert("matches list row by title", listPick?.id === "ws-1");

const truncated = matchWorkspaceByPickReply(
  workspaces,
  "Euclis Internal Tools Pl\nUse this workspace"
);
assert(
  "matches truncated list title",
  truncated?.id === "ws-3"
);

assert(
  "picks Euclis from natural language",
  findWorkspaceMentionedInMessage(
    workspaces,
    "Add this to euclis tasks"
  )?.id === "ws-1"
);

assert(
  "picks multi-word workspace from message",
  findWorkspaceMentionedInMessage(
    workspaces,
    "put it on Landing Page Site please"
  )?.id === "ws-2"
);

assert(
  "longer name wins (My Teams over My Team)",
  findWorkspaceMentionedInMessage(workspaces, "add to My Teams")?.id ===
    "ws-5"
);

assert(
  "does not match partial word",
  findWorkspaceMentionedInMessage(workspaces, "euclisian roadmap") === null
);

console.log(failed === 0 ? "\nAll workspace-pick checks passed." : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
