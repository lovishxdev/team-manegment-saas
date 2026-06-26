/** E.164 digits only (no +), e.g. 15551234567 */
export function getWhatsAppBotNumber(): string | null {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER?.trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/** Prefilled first message when opening the bot chat. */
export const WHATSAPP_START_MESSAGE = "hi";

const GREETING_PATTERN =
  /^(hi+|hii+|hello+|hey+|heya+|hola+|yo+)\b[\s!.?]*$/i;

export function isWhatsAppGreeting(text: string): boolean {
  return GREETING_PATTERN.test(text.trim());
}

export function formatWhatsAppBotNumber(e164: string): string {
  if (e164.length === 11 && e164.startsWith("1")) {
    return `+1 (${e164.slice(1, 4)}) ${e164.slice(4, 7)}-${e164.slice(7)}`;
  }

  if (e164.length === 12 && e164.startsWith("91")) {
    return `+91 ${e164.slice(2, 7)} ${e164.slice(7)}`;
  }

  return `+${e164}`;
}

export function whatsAppBotDeepLink(
  e164: string,
  text: string = WHATSAPP_START_MESSAGE
): string {
  const base = `https://wa.me/${e164}`;
  if (!text.trim()) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}
