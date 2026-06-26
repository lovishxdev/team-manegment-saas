import { sendWhatsAppText } from "@/lib/whatsapp";

const MIN_STEP_MS = 2500;

/** Throttled progress pings so long compound requests feel alive on WhatsApp. */
export class WhatsAppProgress {
  private lastStepAt = 0;
  private stepCount = 0;

  constructor(
    private readonly to: string,
    private readonly onPing?: () => void | Promise<void>
  ) {}

  private ping() {
    void this.onPing?.();
  }

  async started(queued = false) {
    this.ping();
    await sendWhatsAppText(
      this.to,
      queued
        ? "Working on your next queued message. This may take a minute for big requests."
        : "Got it. Working on that now. Big requests can take up to a minute; I'll send updates as I go."
    ).catch(() => {});
  }

  async step(result: string) {
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
