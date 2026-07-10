import { prisma } from "@/lib/prisma";
import { ServiceError, touchLastActiveWorkspace } from "@/lib/services/project";
import { sendWhatsAppText } from "@/lib/whatsapp";
import {
  sendWhatsAppList,
  WHATSAPP_LIST_MAX_ROWS,
} from "@/lib/whatsapp-messages";

const WS_PICK_PREFIX = "ws_pick_";
const LIST_ROW_TITLE_MAX = 24;
const LIST_PICK_SUFFIX = /^use this workspace$/i;

function cleanPickToken(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u2060\u202F\u00A0]/g, "")
    .trim();
}

export function workspacePickId(workspaceId: string): string {
  return `${WS_PICK_PREFIX}${workspaceId}`;
}

export function parseWorkspacePickId(buttonId: string): string | null {
  const raw = cleanPickToken(buttonId);
  if (raw.startsWith(WS_PICK_PREFIX)) {
    const id = raw.slice(WS_PICK_PREFIX.length);
    return id.length > 0 ? id : null;
  }
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      raw
    )
  ) {
    return raw;
  }
  return null;
}

/** Multiple memberships and no pinned active workspace — ask before acting. */
export async function shouldPromptWorkspacePick(
  userId: string
): Promise<boolean> {
  const [count, user] = await Promise.all([
    prisma.workspaceMembership.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveWorkspaceId: true },
    }),
  ]);
  return count > 1 && !user?.lastActiveWorkspaceId;
}

export async function listWorkspacePickerOptions(userId: string) {
  return prisma.workspaceMembership.findMany({
    where: { userId },
    select: { workspace: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
  });
}

export async function userHasAnyWorkspace(userId: string): Promise<boolean> {
  const count = await prisma.workspaceMembership.count({ where: { userId } });
  return count > 0;
}

export function formatNoWorkspaceWhatsAppReply(dashboardUrl: string): string {
  const url = `${dashboardUrl.replace(/\/$/, "")}/dashboard`;
  return [
    "You don't have a workspace yet.",
    "",
    'Say: *create a workspace called My Team*',
    "",
    `Or set one up in the app: ${url}`,
  ].join("\n");
}

function chunkWorkspaces<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

async function sendWorkspacePickerTextFallback(
  to: string,
  workspaces: { id: string; name: string }[],
  body: string
): Promise<boolean> {
  const lines = workspaces
    .map((w, i) => `${i + 1}. *${w.name.trim()}*`)
    .join("\n");
  return sendWhatsAppText(
    to,
    `${body}\n\n${lines}\n\nReply with the workspace name to switch.`
  );
}

export async function sendWorkspacePicker(
  to: string,
  workspaces: { id: string; name: string }[],
  body = "You belong to multiple workspaces. Which one should I use for this request?"
): Promise<boolean> {
  const valid = workspaces.filter((w) => w.id && w.name?.trim());
  if (valid.length === 0) return false;

  const pages = chunkWorkspaces(valid, WHATSAPP_LIST_MAX_ROWS);
  const totalPages = pages.length;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageNum = i + 1;
    const isFirst = pageNum === 1;
    const isLast = pageNum === totalPages;

    const listBody = isFirst
      ? totalPages > 1
        ? `${body}\n\nTap a workspace below. ${totalPages} lists in total.`
        : body
      : `More workspaces (${pageNum} of ${totalPages}):`;

    const sent = await sendWhatsAppList(
      to,
      listBody,
      totalPages === 1 ? "Pick workspace" : `Page ${pageNum}`,
      [
        {
          title:
            totalPages === 1
              ? "Your workspaces"
              : `Workspaces ${pageNum}/${totalPages}`,
          rows: page.map((w) => ({
            id: workspacePickId(w.id),
            title: w.name.trim().slice(0, 24),
            description: "Use this workspace",
          })),
        },
      ],
      {
        header: isFirst ? "Euclis" : "More workspaces",
        footer: isLast ? "You can switch anytime" : undefined,
      }
    );

    if (!sent) {
      return sendWorkspacePickerTextFallback(to, valid, body);
    }
  }

  return true;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip list-row description when user copies "Name\nUse this workspace". */
export function normalizeWorkspacePickReply(text: string): string {
  const trimmed = cleanPickToken(text);
  if (!trimmed) return "";

  const singleLine = trimmed.replace(/\s+use this workspace\s*$/i, "").trim();
  if (singleLine !== trimmed) return singleLine;

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2 && LIST_PICK_SUFFIX.test(lines[lines.length - 1])) {
    return lines[0];
  }

  return lines[0] ?? "";
}

function listRowTitle(name: string): string {
  return name.trim().slice(0, LIST_ROW_TITLE_MAX).toLowerCase();
}

/** Match a workspace from picker text or list row title (exported for tests). */
export function matchWorkspaceByPickReply(
  workspaces: { id: string; name: string }[],
  text: string
): { id: string; name: string } | null {
  const pickReply = normalizeWorkspacePickReply(text);
  if (!pickReply) return null;
  return matchWorkspaceByName(workspaces, pickReply);
}

export function matchWorkspaceByName(
  workspaces: { id: string; name: string }[],
  needle: string
): { id: string; name: string } | null {
  const n = cleanPickToken(needle).toLowerCase();
  if (!n) return null;

  const exact = workspaces.filter(
    (w) => w.name.trim().toLowerCase() === n
  );
  if (exact.length === 1) return exact[0];

  const byListTitle = workspaces.filter(
    (w) => listRowTitle(w.name) === n
  );
  if (byListTitle.length === 1) return byListTitle[0];

  const partial = workspaces.filter((w) => {
    const name = w.name.trim().toLowerCase();
    if (name === n) return true;
    if (name.startsWith(n) && n.length >= 3) return true;
    if (n.startsWith(name) && name.length >= 3) return true;
    return false;
  });
  if (partial.length === 1) return partial[0];

  return null;
}

/**
 * Find a workspace the user named in free text ("add this to euclis tasks",
 * "in Euclis", "for Landing Page Site"). Longer names win so "My Teams"
 * beats "My Team". Returns null when zero or multiple distinct hits.
 */
export function findWorkspaceMentionedInMessage(
  workspaces: { id: string; name: string }[],
  text: string
): { id: string; name: string } | null {
  const lower = cleanPickToken(text).toLowerCase();
  if (!lower) return null;

  const sorted = [...workspaces].sort(
    (a, b) => b.name.trim().length - a.name.trim().length
  );

  const hits: { id: string; name: string }[] = [];
  for (const w of sorted) {
    const name = w.name.trim().toLowerCase();
    if (name.length < 2) continue;

    // Treat the workspace name as a phrase bounded by non-alphanumeric chars
    // so "euclis" matches inside "to euclis tasks" but not "euclisian".
    const re = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegex(name)}(?=$|[^\\p{L}\\p{N}])`,
      "iu"
    );
    if (!re.test(lower)) continue;

    const coveredByLonger = hits.some((h) => {
      const longer = h.name.trim().toLowerCase();
      return longer.length > name.length && longer.includes(name);
    });
    if (!coveredByLonger) hits.push(w);
  }

  const unique = [...new Map(hits.map((h) => [h.id, h])).values()];
  return unique.length === 1 ? unique[0] : null;
}

/**
 * Activate a workspace named in the message — picker reply, or a workspace
 * name spoken in plain language ("add this to euclis tasks").
 * Returns null when ambiguous or no match.
 */
export async function tryActivateWorkspaceFromText(
  userId: string,
  text: string
): Promise<{ workspaceId: string; workspaceName: string } | null> {
  const memberships = await listWorkspacePickerOptions(userId);
  if (memberships.length === 0) return null;

  const workspaces = memberships.map((m) => m.workspace);
  if (memberships.length === 1) {
    return activateWorkspace(userId, workspaces[0].id);
  }

  const direct = matchWorkspaceByPickReply(workspaces, text);
  if (direct) return activateWorkspace(userId, direct.id);

  const mentioned = findWorkspaceMentionedInMessage(workspaces, text);
  if (mentioned) return activateWorkspace(userId, mentioned.id);

  return null;
}

export async function activateWorkspace(
  userId: string,
  workspaceId: string
): Promise<{ workspaceId: string; workspaceName: string }> {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!membership) {
    throw new ServiceError(
      "That workspace is not in your account",
      "NOT_FOUND"
    );
  }
  await touchLastActiveWorkspace(userId, workspaceId);
  return {
    workspaceId: membership.workspace.id,
    workspaceName: membership.workspace.name,
  };
}
