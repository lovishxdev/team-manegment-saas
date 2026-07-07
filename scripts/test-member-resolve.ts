/**
 * Member resolution parity with list_workspace_members labels.
 * Run: npx tsx scripts/test-member-resolve.ts
 */
import {
  matchWorkspaceMember,
  normalizeMemberRef,
} from "../lib/services/member-resolve";

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
    role: "MEMBER",
    user: {
      id: "u1",
      username: "gvvhbb31",
      email: "other@example.com",
    },
  },
  {
    role: "LEADER",
    user: {
      id: "u2",
      username: null,
      email: "sarvikiitd@example.com",
    },
  },
];

assert("strips @ prefix", normalizeMemberRef("@gvvhbb31") === "gvvhbb31");

const byHandle = matchWorkspaceMember(memberships, "gvvhbb31");
assert(
  "matches username handle",
  byHandle.kind === "one" && byHandle.member.user.id === "u1"
);

const byAtHandle = matchWorkspaceMember(memberships, "@gvvhbb31");
assert(
  "matches @username",
  byAtHandle.kind === "one" && byAtHandle.member.user.id === "u1"
);

const byDisplay = matchWorkspaceMember(memberships, "sarvikiitd");
assert(
  "matches displayUser from email-derived handle",
  byDisplay.kind === "one" && byDisplay.member.user.id === "u2"
);

console.log(failed === 0 ? "\nAll member-resolve checks passed." : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
