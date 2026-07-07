import {
  matchWorkspaceMember,
  normalizeMemberRef,
  type MemberUser,
  type MembershipRow,
} from "@/lib/services/member-resolve";
import { displayUser } from "@/lib/username";

/** @handle tokens in update text (lowercase username / display handle). */
const MENTION_REF_PATTERN = /@([a-z0-9_]{3,24})/gi;

export type WorkspaceMemberRef = MembershipRow & { role?: string };

export function extractMentionRefs(body: string): string[] {
  const refs = new Set<string>();
  for (const match of body.matchAll(MENTION_REF_PATTERN)) {
    refs.add(match[1].toLowerCase());
  }
  return [...refs];
}

/** Resolve @handles in text to workspace member user ids. */
export function resolveMentionUserIds(
  memberships: WorkspaceMemberRef[],
  body: string
): string[] {
  return resolveMentionUserIdsFromRefs(memberships, extractMentionRefs(body));
}
export function resolveMentionUserIdsFromRefs(
  memberships: WorkspaceMemberRef[],
  refs: string[]
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const raw of refs) {
    const ref = normalizeMemberRef(raw);
    if (!ref) continue;
    const matched = matchWorkspaceMember(memberships, ref);
    if (matched.kind !== "one") continue;
    const userId = matched.member.user.id;
    if (seen.has(userId)) continue;
    seen.add(userId);
    ids.push(userId);
  }

  return ids;
}

/** Merge @tokens in body with explicit handles from the agent (WhatsApp NL tagging). */
export function resolveAllMentionUserIds(
  memberships: WorkspaceMemberRef[],
  body: string,
  explicitRefs?: string[]
): string[] {
  const ids = new Set<string>([
    ...resolveMentionUserIds(memberships, body),
    ...resolveMentionUserIdsFromRefs(memberships, explicitRefs ?? []),
  ]);
  return [...ids];
}

/** Display labels for mentioned users (for UI chips). */
export function mentionLabelsForUsers(
  memberships: WorkspaceMemberRef[],
  userIds: string[]
): string[] {
  const byId = new Map(memberships.map((m) => [m.user.id, displayUser(m.user)]));
  return userIds
    .map((id) => byId.get(id))
    .filter((label): label is string => Boolean(label));
}

export type MentionMember = {
  id: string;
  label: string;
};

/** Members eligible for @mention autocomplete (display handle + user id). */
export function mentionMembersFromRows(
  memberships: { user: MemberUser }[]
): MentionMember[] {
  return memberships.map((m) => ({
    id: m.user.id,
    label: displayUser(m.user),
  }));
}

export type MentionTextPart =
  | { type: "text"; value: string }
  | { type: "mention"; handle: string; label: string };

/** Split update body into plain text and recognized @mentions for rendering. */
export function parseMentionText(
  body: string,
  members: MentionMember[]
): MentionTextPart[] {
  const labels = new Map(
    members.map((m) => [m.label.toLowerCase(), m.label] as const)
  );
  const parts: MentionTextPart[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(MENTION_REF_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: body.slice(lastIndex, index) });
    }

    const handle = match[1].toLowerCase();
    const label = labels.get(handle);
    if (label) {
      parts.push({ type: "mention", handle, label });
    } else {
      parts.push({ type: "text", value: match[0] });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push({ type: "text", value: body.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: body }];
}

export type MentionComposeState = {
  open: boolean;
  query: string;
  start: number;
  end: number;
};

/** Detect an active @mention query at the textarea cursor. */
export function mentionComposeState(
  text: string,
  cursor: number
): MentionComposeState | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;

  const prev = at > 0 ? before[at - 1] : "";
  if (prev && !/[\s(,]/.test(prev)) return null;

  const query = before.slice(at + 1);
  if (/\s/.test(query)) return null;
  if (query.length > 24) return null;

  return { open: true, query, start: at, end: cursor };
}

export function filterMentionMembers(
  members: MentionMember[],
  query: string
): MentionMember[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return members;
  return members.filter((m) => m.label.toLowerCase().includes(needle));
}

/** Teammates the current user can @mention (never includes self). */
export function mentionableMembers(
  members: MentionMember[],
  currentUserId: string
): MentionMember[] {
  return members.filter((member) => member.id !== currentUserId);
}

export function applyMentionSelection(
  text: string,
  state: MentionComposeState,
  label: string
): { next: string; cursor: number } {
  const next =
    text.slice(0, state.start) + `@${label} ` + text.slice(state.end);
  const cursor = state.start + label.length + 2;
  return { next, cursor };
}
