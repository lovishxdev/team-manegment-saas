import type { ActionOutcome } from "@/lib/channel-formatters";
import { formatTaskRef } from "@/lib/whatsapp-task-ref";

/** Read-only tools — output can go to user as-is (after light cleanup). */
export const INQUIRY_ACTIONS = new Set([
  "read_task",
  "list_task_updates",
  "get_board_state",
  "find_task",
  "search_tasks",
  "list_my_tasks",
  "list_assets",
  "read_asset",
  "list_links",
  "workspace_summary",
  "list_workspace_members",
  "list_categories",
  "list_workspaces",
  "ask_task",
]);

const STATUS_PHRASE: Record<string, string> = {
  TODO: "to do",
  IN_PROGRESS: "in progress",
  DONE: "done",
};

/** Friendly short date for chat (e.g. "Fri 6 Jun"). */
export function formatChatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function stripTechnicalNoise(raw: string, action?: string): string {
  let msg = raw.trim();
  if (!msg) return "";

  msg = msg.replace(/^Done\.\s*/i, "");
  msg = msg.replace(/\s*\(batch task \d+(?:, shortId #\d+)?\)\.?$/i, "");

  const keepLink =
    action && INQUIRY_ACTIONS.has(action) && action === "get_board_state";
  if (!keepLink) {
    msg = msg.replace(/\n*Open: https?:\/\/\S+/gi, "");
  }

  return msg.trim();
}

/** Turn internal tool strings into short, human WhatsApp lines. */
export function humanizeToolMessage(action: string | undefined, raw: string): string {
  const msg = stripTechnicalNoise(raw, action);
  if (!msg) return "";

  if (msg.startsWith("Ready to delete")) {
    const titleMatch = msg.match(
      /Ready to delete\s+(?:#\d+\s+)?(?:"([^"]+)"|\*([^*]+)\*)/i
    );
    if (titleMatch) {
      const title = (titleMatch[1] ?? titleMatch[2]).trim();
      return `I'll delete ${formatTaskRef(title)} — tap Confirm below.`;
    }
    return msg.replace(
      ". I'll send Confirm / Cancel buttons next.",
      " — tap Confirm below."
    );
  }
  if (msg.includes("Confirm / Cancel buttons")) {
    return msg;
  }

  const created =
    msg.match(/^Created\s+\*([^*]+)\*(.*)$/i) ??
    msg.match(/^Created\s+#\d+\s+\*([^*]+)\*(.*)$/i) ??
    msg.match(/^#\d+\s+\*([^*]+)\*(.*)$/);
  if (created && (action === "create_task" || msg.toLowerCase().startsWith("created"))) {
    const [, title, rest] = created;
    const hints = humanizeTaskHints(rest);
    return `Added ${formatTaskRef(title.trim())}${hints}.`;
  }

  const updated =
    msg.match(/^Updated\s+\*([^*]+)\*\s*→\s*(.+)$/i) ??
    msg.match(/^#\d+\s+\*([^*]+)\*.*\bis now\s+(\w+(?:\s+\w+)?)\.?$/i);
  if (updated && action === "update_task") {
    const title = updated[1].trim();
    const statusRaw = updated[2].trim().replace(/\.$/, "");
    const statusKey = statusRaw.toUpperCase().replace(" ", "_");
    const status = STATUS_PHRASE[statusKey] ?? statusRaw.toLowerCase();
    return `Updated ${formatTaskRef(title)} → ${status}.`;
  }

  if (msg.match(/^Updated\s+\*[^*]+\*\s*→/i)) {
    return msg;
  }
  if (msg.match(/^Posted that on #\d+/i)) {
    return msg.replace(
      /^Posted that on #\d+\.?$/i,
      "Posted that."
    );
  }
  if (msg.match(/^Marked #\d+ as done/i)) {
    return msg.replace(/^Marked #\d+ as done\.?$/i, "Marked that as done.");
  }
  if (msg.match(/^Updated #\d+/i)) {
    return msg.replace(
      /^Updated\s+#\d+\s+\*([^*]+)\*\s*→\s*/i,
      (_, title) => `Updated ${formatTaskRef(title.trim())} → `
    );
  }

  if (msg.startsWith("No task #")) {
    return "I couldn't find that task on your board.";
  }
  if (msg.startsWith("No matching tasks")) {
    return "Nothing matched that — try the task name or say *what's on the board*.";
  }
  if (msg.startsWith("No asset") || msg.startsWith("No files")) {
    return msg.replace(/^No files in \*([^*]+)\* yet\./, "No uploads in *$1* yet — send a photo or doc.");
  }
  if (msg.startsWith("Posted update on") || msg.startsWith("Posted on")) {
    const m =
      msg.match(/^Posted (?:update )?on\s+\*([^*]+)\*/i) ??
      msg.match(/^Posted (?:update )?on\s+#\d+\s+\*([^*]+)\*/i);
    if (m) return `Posted on ${formatTaskRef(m[1].trim())}.`;
  }
  if (msg.startsWith("Deleted ")) {
    const m =
      msg.match(/^Deleted\s+\*([^*]+)\*/i) ??
      msg.match(/^Deleted\s+#\d+\s+"([^"]+)"/i);
    if (m) return `Deleted ${formatTaskRef(m[1].trim())}.`;
  }
  if (msg.match(/^Unassigned everyone from/i)) {
    return msg.replace(
      /^Unassigned everyone from\s+#\d+\s+\*([^*]+)\*/i,
      (_, title) => `Unassigned everyone from ${formatTaskRef(title.trim())}`
    );
  }
  if (msg.startsWith("I need ")) {
    return msg;
  }
  if (msg.startsWith("Could not")) {
    return msg;
  }
  if (msg.startsWith("Attached \"")) {
    return msg
      .replace(/ to #\d+\s+\*([^*]+)\*/i, (_, title) => ` to ${formatTaskRef(title.trim())}`)
      .replace(/ in [^.]+\.$/, ".");
  }
  if (msg.startsWith("Saved link")) {
    return msg.replace(/ in \*[^*]+\*/, "");
  }
  if (msg.startsWith("Renamed workspace")) {
    return msg;
  }

  return msg;
}

function humanizeTaskHints(rest: string): string {
  const hints: string[] = [];
  const lower = rest.toLowerCase();
  if (lower.includes("high")) hints.push("high priority");
  const due = rest.match(/due\s+(\d{4}-\d{2}-\d{2})/i);
  if (due) {
    const d = new Date(due[1] + "T12:00:00");
    if (!isNaN(d.getTime())) hints.push(`due ${formatChatDate(d)}`);
  }
  return hints.length ? ` (${hints.join(", ")})` : "";
}

/**
 * User-facing WhatsApp reply — prefer formatted tool output over model summaries.
 */
export function formatWhatsAppUserReply(
  outcomes: ActionOutcome[],
  budgetExhausted: boolean,
  assistantNote?: string | null
): string {
  const note = assistantNote?.trim();
  const withMessage = outcomes.filter((o) => o.message.trim());
  const successes = withMessage.filter((o) => o.ok);
  const failures = withMessage.filter((o) => !o.ok);

  const humanizedSuccesses = successes.map((o) =>
    humanizeToolMessage(o.action, o.message)
  );
  const humanizedFailures = [
    ...new Set(
      failures.map((o) => humanizeToolMessage(o.action, o.message))
    ),
  ];

  if (successes.length === 1 && failures.length === 0 && !budgetExhausted) {
    return humanizedSuccesses[0];
  }

  if (withMessage.length === 0 && note) return note;

  if (withMessage.length === 0) {
    return "Tell me what to add or change on your board — or send *menu*.";
  }

  const lines: string[] = [];

  if (failures.length === 0 && !budgetExhausted && successes.length > 1) {
    for (const msg of humanizedSuccesses) {
      lines.push(`• ${msg}`);
    }
    return lines.join("\n");
  }

  if (failures.length > 0 && successes.length === 0) {
    let body = humanizedFailures.join("\n");
    if (budgetExhausted) {
      body += "\n\nI ran out of steps — send the rest in a new message.";
    }
    return body;
  }

  if (failures.length > 0 && successes.length > 0) {
    for (const msg of humanizedSuccesses) {
      lines.push(`✓ ${msg}`);
    }
    for (const msg of humanizedFailures) {
      lines.push(`✗ ${msg}`);
    }
    let body = lines.join("\n");
    body += "\n\nFix the ✗ lines and try again.";
    return body;
  }

  if (budgetExhausted && successes.length > 0 && failures.length === 0) {
    return `${humanizedSuccesses.map((m) => `• ${m}`).join("\n")}\n\nSend any remaining steps in a new message.`;
  }

  return humanizedSuccesses.join("\n");
}
