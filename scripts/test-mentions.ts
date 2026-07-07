/**
 * @mention parsing for task updates.
 * Run: npx tsx scripts/test-mentions.ts
 */
import {
  applyMentionSelection,
  extractMentionRefs,
  mentionableMembers,
  mentionComposeState,
  parseMentionText,
  resolveAllMentionUserIds,
  resolveMentionUserIds,
} from "../lib/mentions";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.log(`✗ ${label}`);
    failed++;
  } else {
    console.log(`✓ ${label}`);
  }
}

const memberships = [
  {
    user: { id: "u1", username: "lovish", email: "a@example.com" },
  },
  {
    user: { id: "u2", username: null, email: "gvvhbb31@example.com" },
  },
];

assert(
  "extracts multiple refs",
  extractMentionRefs("Hey @lovish and @gvvhbb31 — review?").join(",") ===
    "lovish,gvvhbb31"
);

const ids = resolveMentionUserIds(
  memberships,
  "Blocked on design — @gvvhbb31 can you upload?"
);
assert("resolves display handle", ids.length === 1 && ids[0] === "u2");

const parts = parseMentionText("Thanks @lovish!", [
  { id: "u1", label: "lovish" },
]);
assert(
  "renders mention part",
  parts.some((p) => p.type === "mention" && p.label === "lovish")
);

const compose = mentionComposeState("hello @lov", 10);
assert("detects compose query", compose?.query === "lov");

const applied = applyMentionSelection("hello @lov", compose!, "lovish");
assert(
  "inserts mention",
  applied.next === "hello @lovish " && applied.cursor === 14
);

const mentionable = mentionableMembers(
  [
    { id: "u1", label: "lovish" },
    { id: "u2", label: "alice" },
  ],
  "u1"
);
assert(
  "excludes self from mention list",
  mentionable.length === 1 && mentionable[0].id === "u2"
);

assert(
  "merges explicit refs with body @tokens",
  resolveAllMentionUserIds(
    memberships,
    "please review",
    ["lovish"]
  ).length === 1
);

console.log(failed === 0 ? "\nAll mention checks passed." : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
