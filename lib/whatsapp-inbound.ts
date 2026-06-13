import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const LOCK_STALE_MS = 60_000;
/** Lock row id while a phone's queue drain loop is running. */
export const PROCESSOR_LOCK_ID = "__processor__";

type DedupDelegate = {
  create: (args: { data: { messageId: string } }) => Promise<unknown>;
  deleteMany: (args: { where: { createdAt: { lt: Date } } }) => Promise<unknown>;
};

type LockDelegate = {
  create: (args: {
    data: { phone: string; messageId: string };
  }) => Promise<unknown>;
  findUnique: (args: {
    where: { phone: string };
    select: { messageId: true; startedAt: true };
  }) => Promise<{ messageId: string; startedAt: Date } | null>;
  update: (args: {
    where: { phone: string };
    data: { messageId: string; startedAt: Date };
  }) => Promise<unknown>;
  deleteMany: (args: { where: { phone: string } }) => Promise<unknown>;
};

function dedupDelegate(): DedupDelegate | null {
  const delegate = (prisma as unknown as { whatsAppInboundDedup?: DedupDelegate })
    .whatsAppInboundDedup;
  return delegate?.create ? delegate : null;
}

function lockDelegate(): LockDelegate | null {
  const delegate = (prisma as unknown as { whatsAppProcessingLock?: LockDelegate })
    .whatsAppProcessingLock;
  return delegate?.create ? delegate : null;
}

export async function claimInboundMessage(messageId: string): Promise<boolean> {
  const dedup = dedupDelegate();
  if (!dedup) {
    console.warn(
      "WhatsAppInboundDedup client unavailable — restart the dev server after prisma generate/migrate"
    );
    return true;
  }

  try {
    await dedup.create({ data: { messageId } });
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return false;
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2021" || err.code === "P2022")
    ) {
      console.warn(
        "WhatsAppInboundDedup table missing — run `npx prisma migrate deploy`"
      );
      return true;
    }
    throw err;
  }
}

export type ProcessorClaim = "acquired" | "busy" | "unavailable";

/** Ensures only one queue drain loop runs per phone at a time. */
export async function tryAcquireProcessorLock(
  phone: string
): Promise<ProcessorClaim> {
  const lock = lockDelegate();
  if (!lock) return "unavailable";

  const staleBefore = new Date(Date.now() - LOCK_STALE_MS);

  try {
    await lock.create({ data: { phone, messageId: PROCESSOR_LOCK_ID } });
    return "acquired";
  } catch (err) {
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== "P2002"
    ) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2021" || err.code === "P2022")
      ) {
        return "unavailable";
      }
      throw err;
    }

    const existing = await lock.findUnique({
      where: { phone },
      select: { messageId: true, startedAt: true },
    });
    if (!existing) return "acquired";

    if (existing.startedAt < staleBefore) {
      await lock.update({
        where: { phone },
        data: { messageId: PROCESSOR_LOCK_ID, startedAt: new Date() },
      });
      return "acquired";
    }

    return "busy";
  }
}

export async function releaseProcessorLock(phone: string): Promise<void> {
  const lock = lockDelegate();
  if (!lock) return;
  await lock.deleteMany({ where: { phone } }).catch(() => {});
}

export async function pruneInboundDedup(): Promise<void> {
  const dedup = dedupDelegate();
  if (!dedup) return;

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await dedup.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}
