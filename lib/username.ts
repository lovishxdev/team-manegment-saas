export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsernameFormat(username: string): void {
  if (!USERNAME_REGEX.test(username)) {
    throw new Error(
      "Username must be 3-24 characters: lowercase letters, digits, underscores"
    );
  }
}

/**
 * Default handle for users without one: initials from dotted email local parts,
 * otherwise the start of the local part (padded to meet min length).
 */
export function deriveUsernameFromEmail(email: string): string {
  const local =
    email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "") ?? "";
  const segments = local.split(/[._-]+/).filter(Boolean);

  let base =
    segments.length >= 2
      ? segments.map((s) => s[0]).join("")
      : (segments[0] ?? "user");

  base = base.replace(/[^a-z0-9]/g, "");

  if (base.length < 3 && segments[0]) {
    base = (base + segments[0].replace(/[^a-z0-9]/g, "")).slice(0, 24);
  }
  if (base.length < 3) base = "usr";

  return base.slice(0, 24);
}

function sanitizeUsernameCandidate(raw: string): string {
  return normalizeUsername(raw)
    .replace(/-/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function deriveUsernameFromDisplayName(name: string): string {
  const segments = name.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (segments.length >= 2) {
    let base = segments.map((s) => s[0]).join("").replace(/[^a-z0-9]/g, "");
    if (base.length < 3 && segments[0]) {
      base = (base + segments[0].replace(/[^a-z0-9]/g, "")).slice(0, 24);
    }
    if (base.length >= 3) return base.slice(0, 24);
  }

  const single = sanitizeUsernameCandidate(segments[0] ?? "user");
  return single.length >= 3 ? single : "usr";
}

/**
 * Provider handle when available (GitHub login, etc.), otherwise initials from
 * the OAuth display name. Returns null when metadata has nothing usable.
 */
export function deriveUsernameFromOAuthMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;

  for (const key of [
    "preferred_username",
    "user_name",
    "username",
    "login",
  ] as const) {
    const raw = metadata[key];
    if (typeof raw !== "string") continue;
    const candidate = sanitizeUsernameCandidate(raw);
    if (USERNAME_REGEX.test(candidate)) return candidate;
  }

  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null;
  if (name) return deriveUsernameFromDisplayName(name);

  return null;
}

/** Preferred base handle for a brand-new account. */
export function deriveInitialUsername(opts: {
  email?: string | null;
  metadata?: Record<string, unknown> | null;
  userId?: string;
}): string {
  const oauth = deriveUsernameFromOAuthMetadata(opts.metadata);
  if (oauth) return oauth;
  if (opts.email) return deriveUsernameFromEmail(opts.email);
  const id = opts.userId?.replace(/-/g, "") ?? "user";
  return `user_${id.slice(0, 8)}`;
}

type UserLike = {
  username?: string | null;
  email?: string | null;
  id?: string;
};

/** Primary label shown in the UI (boards, avatars, member lists). */
export function displayUser(user: UserLike): string {
  if (user.username) return user.username;
  if (user.email) return deriveUsernameFromEmail(user.email);
  return user.id?.slice(0, 8) ?? "user";
}
