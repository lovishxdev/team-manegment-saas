/**
 * WhatsApp session cache (load/persist/prompt formatting).
 * Run: npx tsx scripts/test-whatsapp-cache.ts
 */
import {
  formatWhatsAppCacheForPrompt,
  type WhatsAppUserCache,
} from "../lib/whatsapp-cache";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.log(`✗ ${label}`);
    failed++;
  } else {
    console.log(`✓ ${label}`);
  }
}

const sample: WhatsAppUserCache = {
  workspaceId: "ws-1",
  workspaceName: "Euclis",
  lastDiscussedTask: { shortId: 3, title: "Add Dark Mode" },
  lastCreatedTask: { shortId: 3, title: "Add Dark Mode" },
  lastUpdate: {
    taskShortId: 3,
    taskTitle: "Add Dark Mode",
    body: "please change your username",
    at: new Date(),
  },
  lastBlocker: {
    eventId: "dd11ead4-8f5e-4866-b921-a72d863237be",
    summary: "WhatsApp workspace picker loops",
  },
  updatedAt: new Date(),
};

const prompt = formatWhatsAppCacheForPrompt(sample);
assert("includes workspace", prompt.includes("*Euclis*"));
assert("includes last created task", prompt.includes("Add Dark Mode"));
assert("includes last update", prompt.includes("please change your username"));
assert("includes blocker event id", prompt.includes("dd11ead4"));

assert(
  "empty cache returns empty string",
  formatWhatsAppCacheForPrompt(null) === ""
);

console.log(
  failed === 0
    ? "\nAll WhatsApp cache checks passed."
    : `\n${failed} FAILURES`
);
process.exit(failed === 0 ? 0 : 1);
