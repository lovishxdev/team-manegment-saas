import { prisma } from "@/lib/prisma";

/** Meta allows session messages for ~24h after the user's last inbound message. */
export const WHATSAPP_MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** True when the user messaged the bot within the last 24 hours. */
export async function isWithinWhatsAppMessagingWindow(
  userId: string
): Promise<boolean> {
  const last = await prisma.whatsAppMessage.findFirst({
    where: { userId, role: "user" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return false;
  return Date.now() - last.createdAt.getTime() < WHATSAPP_MESSAGING_WINDOW_MS;
}
