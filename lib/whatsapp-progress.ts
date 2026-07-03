import { sendWhatsAppText } from "@/lib/whatsapp";

const SLOW_THRESHOLD_MS = 5000;

/**
 * Optional slow ping only — no mid-step tool dumps (keeps chat human).
 */
export class WhatsAppProgress {
  private slowTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly to: string,
    private readonly onPing?: () => void | Promise<void>
  ) {}

  private ping() {
    void this.onPing?.();
  }

  beginSlowPing(queued = false) {
    this.ping();
    this.slowTimer = setTimeout(() => {
      void sendWhatsAppText(
        this.to,
        queued ? "Still on your queued message…" : "One sec…"
      ).catch(() => {});
    }, SLOW_THRESHOLD_MS);
  }

  finish() {
    if (this.slowTimer) {
      clearTimeout(this.slowTimer);
      this.slowTimer = null;
    }
  }

  /** No-op — we no longer send interim tool output to users. */
  async step(_action: string, _result: string) {
    this.ping();
  }
}
