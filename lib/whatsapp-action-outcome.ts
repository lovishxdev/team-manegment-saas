import type { ActionOutcome } from "@/lib/channel-formatters";

const FAIL_STARTS = [
  "Could not",
  "No task",
  "No matching",
  "No asset",
  "I need ",
  "I didn't",
  "Which ",
  "You need ",
  "Specify ",
  "What should ",
];

const FAIL_CONTAINS = [
  "not found",
  "not in ",
  "only leaders",
  "only the workspace leader",
  "forbidden",
  "invalid",
];

/** Classify a tool return string as success or failure for the user summary. */
export function classifyActionOutcome(
  action: string,
  message: string
): ActionOutcome {
  const trimmed = message.trim();
  if (!trimmed) return { ok: true, message: "", action };

  const lower = trimmed.toLowerCase();
  const failed =
    FAIL_STARTS.some((p) => trimmed.startsWith(p)) ||
    FAIL_CONTAINS.some((p) => lower.includes(p));

  return { ok: !failed, message: trimmed, action };
}
