import { sendWhatsAppText } from "@/lib/whatsapp";

const MIN_STEP_MS = 2500;
/** Only show "working on it" if Haiku takes longer than this. */
const SLOW_THRESHOLD_MS = 3000;

/**
 * Throttled progress pings for long AI requests.
 * Does not message the user immediately — waits until processing is slow.
 */
export class WhatsAppProgress {
  private lastStepAt = 0;
  private stepCount = 0;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private sentSlow = false;

  constructor(
    private readonly to: string,
    private readonly onPing?: () => void | Promise<void>
  ) {}

  private ping() {
    void this.onPing?.();
  }

  /** Start a delayed ping — call finish() when the request completes. */
  beginSlowPing(queued = false) {
    this.ping();
    this.slowTimer = setTimeout(() => {
      this.sentSlow = true;
      void sendWhatsAppText(
        this.to,
        queued
          ? "Still working through your queued message…"
          : "Still working on that…"
      ).catch(() => {});
    }, SLOW_THRESHOLD_MS);
  }

  finish() {
    if (this.slowTimer) {
      clearTimeout(this.slowTimer);
      this.slowTimer = null;
    }
  }

  /** Mid-request updates — only after the slow ping, and only for short mutating steps. */
  async step(action: string, result: string) {
    if (!this.sentSlow) return;

    const skipActions = new Set([
      "read_task",
      "list_task_updates",
      "get_board_state",
      "find_task",
      "ask_task",
      "search_tasks",
      "list_my_tasks",
      "list_assets",
      "read_asset",
      "list_links",
      "workspace_summary",
      "list_workspace_members",
      "list_categories",
      "list_workspaces",
    ]);
    if (skipActions.has(action)) return;
    if (result.length > 220) return;

    this.stepCount++;
    this.ping();
    const now = Date.now();
    if (this.stepCount > 1 && now - this.lastStepAt < MIN_STEP_MS) return;
    this.lastStepAt = now;

    const short = result
      .replace(/^Done\.\s*/i, "")
      .replace(/\s*\(batch task \d+, shortId #\d+\)\.?$/i, "")
      .slice(0, 160);
    if (!short) return;
    await sendWhatsAppText(this.to, short).catch(() => {});
  }
}
