import { prisma } from "@/lib/prisma";

/** Same window as conversation history — stale cache must not hijack follow-ups. */
export const WHATSAPP_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

const MAX_UPDATE_BODY = 400;
const MAX_BLOCKER_SUMMARY = 200;

export type WhatsAppCacheTaskRef = {
  shortId: number;
  title: string;
};

export type WhatsAppCacheUpdate = {
  taskShortId: number;
  taskTitle: string;
  body: string;
  at: Date;
};

export type WhatsAppCacheBlocker = {
  eventId: string;
  summary: string;
};

/** Persisted WhatsApp session cache loaded at the start of each message. */
export type WhatsAppUserCache = {
  workspaceId: string | null;
  workspaceName: string | null;
  lastDiscussedTask: WhatsAppCacheTaskRef | null;
  lastCreatedTask: WhatsAppCacheTaskRef | null;
  lastUpdate: WhatsAppCacheUpdate | null;
  lastBlocker: WhatsAppCacheBlocker | null;
  updatedAt: Date | null;
};

export type WhatsAppCachePatch = {
  workspaceId?: string | null;
  workspaceName?: string | null;
  lastDiscussedTask?: WhatsAppCacheTaskRef | null;
  lastCreatedTask?: WhatsAppCacheTaskRef | null;
  lastUpdate?: WhatsAppCacheUpdate | null;
  lastBlocker?: WhatsAppCacheBlocker | null;
  clearBlocker?: boolean;
};

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function isFresh(updatedAt: Date | null | undefined): boolean {
  if (!updatedAt) return false;
  return updatedAt.getTime() >= Date.now() - WHATSAPP_CACHE_TTL_MS;
}

function rowToCache(row: {
  workspaceId: string | null;
  workspaceName: string | null;
  lastTaskShortId: number | null;
  lastTaskTitle: string | null;
  lastCreatedTaskShortId: number | null;
  lastCreatedTaskTitle: string | null;
  lastUpdateTaskShortId: number | null;
  lastUpdateTaskTitle: string | null;
  lastUpdateBody: string | null;
  lastUpdateAt: Date | null;
  lastBlockerEventId: string | null;
  lastBlockerSummary: string | null;
  updatedAt: Date;
}): WhatsAppUserCache | null {
  if (!isFresh(row.updatedAt)) return null;

  return {
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    lastDiscussedTask:
      row.lastTaskShortId != null
        ? {
            shortId: row.lastTaskShortId,
            title: row.lastTaskTitle?.trim() || `task #${row.lastTaskShortId}`,
          }
        : null,
    lastCreatedTask:
      row.lastCreatedTaskShortId != null
        ? {
            shortId: row.lastCreatedTaskShortId,
            title:
              row.lastCreatedTaskTitle?.trim() ||
              `task #${row.lastCreatedTaskShortId}`,
          }
        : null,
    lastUpdate:
      row.lastUpdateTaskShortId != null &&
      row.lastUpdateBody &&
      row.lastUpdateAt
        ? {
            taskShortId: row.lastUpdateTaskShortId,
            taskTitle:
              row.lastUpdateTaskTitle?.trim() ||
              `task #${row.lastUpdateTaskShortId}`,
            body: row.lastUpdateBody,
            at: row.lastUpdateAt,
          }
        : null,
    lastBlocker:
      row.lastBlockerEventId && row.lastBlockerSummary
        ? { eventId: row.lastBlockerEventId, summary: row.lastBlockerSummary }
        : null,
    updatedAt: row.updatedAt,
  };
}

export async function loadWhatsAppCache(
  userId: string
): Promise<WhatsAppUserCache | null> {
  const row = await prisma.whatsAppChatState.findUnique({ where: { userId } });
  if (!row) return null;
  return rowToCache(row);
}

export async function persistWhatsAppCache(
  userId: string,
  patch: WhatsAppCachePatch
): Promise<void> {
  const existing = await prisma.whatsAppChatState.findUnique({
    where: { userId },
  });

  const workspaceId =
    patch.workspaceId !== undefined
      ? patch.workspaceId
      : (existing?.workspaceId ?? null);
  const workspaceName =
    patch.workspaceName !== undefined
      ? patch.workspaceName
      : (existing?.workspaceName ?? null);

  const discussed =
    patch.lastDiscussedTask !== undefined
      ? patch.lastDiscussedTask
      : existing?.lastTaskShortId != null
        ? {
            shortId: existing.lastTaskShortId,
            title:
              existing.lastTaskTitle?.trim() ||
              `task #${existing.lastTaskShortId}`,
          }
        : null;

  const created =
    patch.lastCreatedTask !== undefined
      ? patch.lastCreatedTask
      : existing?.lastCreatedTaskShortId != null
        ? {
            shortId: existing.lastCreatedTaskShortId,
            title:
              existing.lastCreatedTaskTitle?.trim() ||
              `task #${existing.lastCreatedTaskShortId}`,
          }
        : null;

  const update =
    patch.lastUpdate !== undefined
      ? patch.lastUpdate
      : existing?.lastUpdateTaskShortId != null &&
          existing.lastUpdateBody &&
          existing.lastUpdateAt
        ? {
            taskShortId: existing.lastUpdateTaskShortId,
            taskTitle:
              existing.lastUpdateTaskTitle?.trim() ||
              `task #${existing.lastUpdateTaskShortId}`,
            body: existing.lastUpdateBody,
            at: existing.lastUpdateAt,
          }
        : null;

  let blocker: WhatsAppCacheBlocker | null =
    patch.clearBlocker === true
      ? null
      : patch.lastBlocker !== undefined
        ? patch.lastBlocker
        : existing?.lastBlockerEventId && existing.lastBlockerSummary
          ? {
              eventId: existing.lastBlockerEventId,
              summary: existing.lastBlockerSummary,
            }
          : null;

  await prisma.whatsAppChatState.upsert({
    where: { userId },
    create: {
      userId,
      workspaceId,
      workspaceName,
      lastTaskShortId: discussed?.shortId ?? null,
      lastTaskTitle: discussed?.title ?? null,
      lastCreatedTaskShortId: created?.shortId ?? null,
      lastCreatedTaskTitle: created?.title ?? null,
      lastUpdateTaskShortId: update?.taskShortId ?? null,
      lastUpdateTaskTitle: update?.taskTitle ?? null,
      lastUpdateBody: update ? truncate(update.body, MAX_UPDATE_BODY) : null,
      lastUpdateAt: update?.at ?? null,
      lastBlockerEventId: blocker?.eventId ?? null,
      lastBlockerSummary: blocker
        ? truncate(blocker.summary, MAX_BLOCKER_SUMMARY)
        : null,
    },
    update: {
      workspaceId,
      workspaceName,
      lastTaskShortId: discussed?.shortId ?? null,
      lastTaskTitle: discussed?.title ?? null,
      lastCreatedTaskShortId: created?.shortId ?? null,
      lastCreatedTaskTitle: created?.title ?? null,
      lastUpdateTaskShortId: update?.taskShortId ?? null,
      lastUpdateTaskTitle: update?.taskTitle ?? null,
      lastUpdateBody: update ? truncate(update.body, MAX_UPDATE_BODY) : null,
      lastUpdateAt: update?.at ?? null,
      lastBlockerEventId: blocker?.eventId ?? null,
      lastBlockerSummary: blocker
        ? truncate(blocker.summary, MAX_BLOCKER_SUMMARY)
        : null,
    },
  });
}

/** Compact cache block injected into the WhatsApp agent system prompt. */
export function formatWhatsAppCacheForPrompt(
  cache: WhatsAppUserCache | null
): string {
  if (!cache) return "";

  const lines: string[] = [
    "WhatsApp session cache (code-owned — prefer this over chat history for 'that task' / 'post on it' / 'the blocker'):",
  ];

  if (cache.workspaceName) {
    lines.push(`- Active workspace: *${cache.workspaceName}*`);
  }
  if (cache.lastCreatedTask) {
    lines.push(
      `- Last task created: *${cache.lastCreatedTask.title}* (#${cache.lastCreatedTask.shortId})`
    );
  }
  if (cache.lastDiscussedTask) {
    lines.push(
      `- Last task discussed: *${cache.lastDiscussedTask.title}* (#${cache.lastDiscussedTask.shortId})`
    );
  }
  if (cache.lastUpdate) {
    lines.push(
      `- Last update posted: on *${cache.lastUpdate.taskTitle}* — "${truncate(cache.lastUpdate.body, 120)}"`
    );
  }
  if (cache.lastBlocker) {
    lines.push(
      `- Latest blocker noted: "${truncate(cache.lastBlocker.summary, 120)}" (event ${cache.lastBlocker.eventId})`
    );
  }

  if (lines.length === 1) return "";
  return lines.join("\n");
}

export function cachePatchFromSession(session: {
  workspaceId: string | null;
  workspaceName: string | null;
  lastDiscussedTaskShortId: number | null;
  lastDiscussedTaskTitle: string | null;
  lastCreatedTask: { shortId: number; title: string } | null;
  lastPostedUpdate: WhatsAppCacheUpdate | null;
  lastNotedBlocker: WhatsAppCacheBlocker | null;
  clearedBlocker: boolean;
}): WhatsAppCachePatch {
  return {
    workspaceId: session.workspaceId,
    workspaceName: session.workspaceName,
    lastDiscussedTask: session.lastDiscussedTaskShortId
      ? {
          shortId: session.lastDiscussedTaskShortId,
          title:
            session.lastDiscussedTaskTitle?.trim() ||
            `task #${session.lastDiscussedTaskShortId}`,
        }
      : null,
    lastCreatedTask: session.lastCreatedTask,
    lastUpdate: session.lastPostedUpdate,
    lastBlocker: session.lastNotedBlocker,
    clearBlocker: session.clearedBlocker || undefined,
  };
}

export function applyWhatsAppCacheToSession(
  cache: WhatsAppUserCache | null,
  session: {
    workspaceId: string | null;
    workspaceName: string | null;
    lastDiscussedTaskShortId: number | null;
    lastDiscussedTaskTitle: string | null;
    lastCreatedTask: { shortId: number; workspaceId: string; title: string } | null;
    lastPostedUpdate: WhatsAppCacheUpdate | null;
    lastNotedBlocker: WhatsAppCacheBlocker | null;
  },
  activeWorkspaceId: string | null
): void {
  if (!cache) return;
  if (cache.workspaceId && cache.workspaceId === activeWorkspaceId) {
    session.workspaceName = session.workspaceName ?? cache.workspaceName;
  }
  if (
    cache.lastDiscussedTask &&
    cache.workspaceId === activeWorkspaceId &&
    !session.lastDiscussedTaskShortId
  ) {
    session.lastDiscussedTaskShortId = cache.lastDiscussedTask.shortId;
    session.lastDiscussedTaskTitle = cache.lastDiscussedTask.title;
  }
  if (
    cache.lastCreatedTask &&
    cache.workspaceId === activeWorkspaceId &&
    !session.lastCreatedTask
  ) {
    session.lastCreatedTask = {
      shortId: cache.lastCreatedTask.shortId,
      workspaceId: cache.workspaceId ?? "",
      title: cache.lastCreatedTask.title,
    };
  }
  if (cache.lastUpdate && cache.workspaceId === activeWorkspaceId) {
    session.lastPostedUpdate = cache.lastUpdate;
  }
  if (cache.lastBlocker && cache.workspaceId === activeWorkspaceId) {
    session.lastNotedBlocker = cache.lastBlocker;
  }
}

export function noteDiscussedTask(
  session: {
    lastDiscussedTaskShortId: number | null;
    lastDiscussedTaskTitle: string | null;
  },
  shortId: number,
  title: string
): void {
  session.lastDiscussedTaskShortId = shortId;
  session.lastDiscussedTaskTitle = title;
}

export function notePostedUpdate(
  session: { lastPostedUpdate: WhatsAppCacheUpdate | null },
  taskShortId: number,
  taskTitle: string,
  body: string
): void {
  session.lastPostedUpdate = {
    taskShortId,
    taskTitle,
    body: truncate(body, MAX_UPDATE_BODY),
    at: new Date(),
  };
}

export function noteBlocker(
  session: { lastNotedBlocker: WhatsAppCacheBlocker | null },
  eventId: string,
  summary: string
): void {
  session.lastNotedBlocker = {
    eventId,
    summary: truncate(summary, MAX_BLOCKER_SUMMARY),
  };
}

export function clearNotedBlocker(session: { clearedBlocker: boolean }): void {
  session.clearedBlocker = true;
  if ("lastNotedBlocker" in session) {
    (session as { lastNotedBlocker: WhatsAppCacheBlocker | null }).lastNotedBlocker =
      null;
  }
}
