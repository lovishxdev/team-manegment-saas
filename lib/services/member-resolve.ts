import { displayUser } from "@/lib/username";

export type MemberUser = {
  id: string;
  email: string | null;
  username: string | null;
};

export type MembershipRow = {
  user: MemberUser;
};

/** Strip @ prefix and normalize for workspace member / assignee lookup. */
export function normalizeMemberRef(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export type MemberMatchResult<T extends MembershipRow> =
  | { kind: "one"; member: T }
  | { kind: "ambiguous"; members: T[] }
  | { kind: "none" };

/**
 * Match a workspace member by id, @username, display handle, or email fragment.
 * Uses the same labels shown in list_workspace_members (@displayUser).
 */
export function matchWorkspaceMember<T extends MembershipRow>(
  memberships: T[],
  identifier: string
): MemberMatchResult<T> {
  const trimmed = identifier.trim();
  if (!trimmed) return { kind: "none" };

  const byId = memberships.find((m) => m.user.id === trimmed);
  if (byId) return { kind: "one", member: byId };

  const needle = normalizeMemberRef(identifier);
  if (!needle) return { kind: "none" };

  const byUsername = memberships.find(
    (m) => m.user.username?.toLowerCase() === needle
  );
  if (byUsername) return { kind: "one", member: byUsername };

  const byDisplay = memberships.find(
    (m) => displayUser(m.user).toLowerCase() === needle
  );
  if (byDisplay) return { kind: "one", member: byDisplay };

  const matches = memberships.filter(
    (m) =>
      m.user.email?.toLowerCase().includes(needle) ||
      m.user.username?.toLowerCase().includes(needle) ||
      displayUser(m.user).toLowerCase().includes(needle)
  );

  if (matches.length === 1) return { kind: "one", member: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous", members: matches };
  return { kind: "none" };
}
