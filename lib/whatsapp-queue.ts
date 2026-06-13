import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { InboundMessage } from "@/lib/whatsapp";
import {
  releaseProcessorLock,
  tryAcquireProcessorLock,
} from "@/lib/whatsapp-inbound";

export type QueuedInboundPayload =
  | { kind: "text"; text: string }
  | {
      kind: "media";
      mediaId: string;
      mimeType: string;
      fileName: string;
      caption: string | null;
    };

/** How long without a lock heartbeat before treating the drain as crashed. */
const PROCESSOR_STALE_MS = 60_000;

export async function touchProcessorLock(phone: string): Promise<void> {
  await prisma.whatsAppProcessingLock
    .update({
      where: { phone },
      data: { startedAt: new Date() },
    })
    .catch(() => {});
}

/** Reset rows stuck in processing and drop any stale processor lock. */
async function forceUnstickQueue(phone: string): Promise<number> {
  await prisma.whatsAppInboundQueue.updateMany({
    where: { phone, status: "processing" },
    data: { status: "pending" },
  });
  await releaseProcessorLock(phone);
  return prisma.whatsAppInboundQueue.count({
    where: { phone, status: "pending" },
  });
}

function toPayload(message: InboundMessage): QueuedInboundPayload {
  if (message.kind === "text") {
    return { kind: "text", text: message.text };
  }
  return {
    kind: "media",
    mediaId: message.mediaId,
    mimeType: message.mimeType,
    fileName: message.fileName,
    caption: message.caption,
  };
}

function toInboundMessage(
  phone: string,
  messageId: string,
  kind: string,
  payload: unknown
): InboundMessage | null {
  const data = payload as QueuedInboundPayload;
  if (kind === "text" && data.kind === "text") {
    return { kind: "text", from: phone, messageId, text: data.text };
  }
  if (kind === "media" && data.kind === "media") {
    return {
      kind: "media",
      from: phone,
      messageId,
      mediaId: data.mediaId,
      mimeType: data.mimeType,
      fileName: data.fileName,
      caption: data.caption,
    };
  }
  return null;
}

/** Add an inbound message to the phone's FIFO queue. */
export async function enqueueInboundMessage(
  message: InboundMessage
): Promise<{ depth: number; mode: "queued" | "direct" }> {
  const payload = toPayload(message);

  try {
    await prisma.whatsAppInboundQueue.create({
      data: {
        phone: message.from,
        messageId: message.messageId,
        kind: message.kind,
        payload,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Already queued — fall through to depth count.
    } else if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2021" || err.code === "P2022")
    ) {
      console.warn(
        "WhatsAppInboundQueue table missing — run `npx prisma migrate deploy`"
      );
      return { depth: 1, mode: "direct" };
    } else {
      throw err;
    }
  }

  const depth = await prisma.whatsAppInboundQueue.count({
    where: { phone: message.from, status: "pending" },
  });
  return { depth, mode: "queued" };
}

/** Clear ghost locks / zombie rows left by aborted background work. */
export async function recoverStuckQueue(phone: string): Promise<void> {
  try {
    const lock = await prisma.whatsAppProcessingLock.findUnique({
      where: { phone },
      select: { startedAt: true },
    });

    // Lock held recently — a drain is probably still running in another request.
    if (lock && lock.startedAt >= new Date(Date.now() - PROCESSOR_STALE_MS)) {
      return;
    }

    await prisma.whatsAppInboundQueue.updateMany({
      where: { phone, status: "processing" },
      data: { status: "pending" },
    });
    await prisma.whatsAppProcessingLock.deleteMany({ where: { phone } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2021" || err.code === "P2022")
    ) {
      return;
    }
    console.error("WhatsApp queue recovery failed:", err);
  }
}

async function claimNextQueueItem(phone: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.whatsAppInboundQueue.findFirst({
      where: { phone, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    if (!row) return null;

    return tx.whatsAppInboundQueue.update({
      where: { id: row.id },
      data: { status: "processing" },
    });
  });
}

async function finishQueueItem(id: string, status: "done" | "failed") {
  await prisma.whatsAppInboundQueue
    .update({ where: { id }, data: { status } })
    .catch(() => {});
}

export async function pruneInboundQueue(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.whatsAppInboundQueue
    .deleteMany({
      where: { status: "done", updatedAt: { lt: cutoff } },
    })
    .catch(() => {});
}

async function drainQueue(
  phone: string,
  handler: (message: InboundMessage, queued: boolean) => Promise<void>
) {
  while (true) {
    const item = await claimNextQueueItem(phone);
    if (!item) break;

    const message = toInboundMessage(
      phone,
      item.messageId,
      item.kind,
      item.payload
    );
    if (!message) {
      await finishQueueItem(item.id, "failed");
      continue;
    }

    const stillQueued = await prisma.whatsAppInboundQueue.count({
      where: { phone, status: "pending" },
    });

    try {
      console.log(`[whatsapp-queue] processing ${item.messageId} for ${phone}`);
      await touchProcessorLock(phone);
      const heartbeat = setInterval(() => {
        void touchProcessorLock(phone);
      }, 15_000);
      try {
        await handler(message, stillQueued > 0);
      } finally {
        clearInterval(heartbeat);
      }
      await finishQueueItem(item.id, "done");
    } catch (err) {
      console.error("Queued WhatsApp message failed:", err);
      await finishQueueItem(item.id, "failed");
    }
  }
}

/**
 * Process all pending messages for a phone sequentially. Must be awaited
 * by the webhook handler — fire-and-forget gets killed when the response
 * returns and leaves ghost locks / stuck queue rows.
 */
export async function ensureQueueProcessed(
  phone: string,
  handler: (message: InboundMessage, queued: boolean) => Promise<void>
): Promise<"drained" | "delegated" | "direct"> {
  await recoverStuckQueue(phone);

  let pending = await prisma.whatsAppInboundQueue
    .count({ where: { phone, status: "pending" } })
    .catch(() => 0);

  const processing = await prisma.whatsAppInboundQueue
    .count({ where: { phone, status: "processing" } })
    .catch(() => 0);

  // Ghost drain left rows in processing with nothing pending — unstick them.
  if (pending === 0 && processing > 0) {
    pending = await forceUnstickQueue(phone);
  }

  if (pending === 0) {
    console.warn(`[whatsapp-queue] no pending items for ${phone} after enqueue`);
    return "delegated";
  }

  let claim = await tryAcquireProcessorLock(phone);

  if (claim === "busy") {
    const lock = await prisma.whatsAppProcessingLock
      .findUnique({ where: { phone }, select: { startedAt: true } })
      .catch(() => null);
    const lockAge = lock ? Date.now() - lock.startedAt.getTime() : Infinity;
    const HEARTBEAT_MS = 20_000;

    if (lockAge < HEARTBEAT_MS) {
      console.log(`[whatsapp-queue] drain already running for ${phone}`);
      return "delegated";
    }

    console.warn(`[whatsapp-queue] stale lock — unstick ${phone}`);
    pending = await forceUnstickQueue(phone);
    if (pending === 0) return "delegated";
    claim = await tryAcquireProcessorLock(phone);
  }

  if (claim === "busy") {
    console.log(`[whatsapp-queue] drain already running for ${phone}`);
    return "delegated";
  }

  try {
    await drainQueue(phone, handler);
    return "drained";
  } finally {
    if (claim === "acquired") {
      await releaseProcessorLock(phone);
    }
    void pruneInboundQueue().catch(() => {});
  }
}

/** @deprecated Use ensureQueueProcessed */
export async function scheduleInboundDrain(
  phone: string,
  handler: (message: InboundMessage, queued: boolean) => Promise<void>
): Promise<void> {
  await ensureQueueProcessed(phone, handler);
}
