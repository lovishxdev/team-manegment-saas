import { refreshWhatsAppTyping } from "@/lib/whatsapp";

const TYPING_REFRESH_MS = 12_000;

/**
 * Keeps the Meta typing indicator alive during slow Haiku/tool work.
 * (Cloud API has no message-edit — typing is the official live-feedback UX.)
 */
export class WhatsAppProgress {
  private typingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly inboundMessageId: string | null,
    private readonly onPing?: () => void | Promise<void>
  ) {}

  private ping() {
    void this.onPing?.();
  }

  beginSlowPing(_queued = false) {
    this.ping();
    if (!this.inboundMessageId) return;

    this.typingTimer = setInterval(() => {
      void refreshWhatsAppTyping(this.inboundMessageId!).catch(() => {});
      this.ping();
    }, TYPING_REFRESH_MS);
  }

  finish() {
    if (this.typingTimer) {
      clearInterval(this.typingTimer);
      this.typingTimer = null;
    }
  }

  async step(_action: string, _result: string) {
    this.ping();
  }
}
