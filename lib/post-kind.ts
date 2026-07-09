import type { PostKind } from "@/lib/generated/prisma/client";

export const POST_KINDS: PostKind[] = [
  "DISCUSSION",
  "QUESTION",
  "ANNOUNCEMENT",
  "PROPOSAL",
];

export const POST_KIND_LABELS: Record<PostKind, string> = {
  DISCUSSION: "Discussion",
  QUESTION: "Question",
  ANNOUNCEMENT: "Announcement",
  PROPOSAL: "Proposal",
};

export const POST_KIND_HINTS: Record<PostKind, string> = {
  DISCUSSION: "Open conversation for the team",
  QUESTION: "Ask something that needs an answer",
  ANNOUNCEMENT: "Share news or updates everyone should see",
  PROPOSAL: "Suggest a change or direction to discuss",
};

export const POST_KIND_STYLES: Record<
  PostKind,
  { badge: string; dot: string }
> = {
  DISCUSSION: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    dot: "bg-slate-400",
  },
  QUESTION: {
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
    dot: "bg-sky-500",
  },
  ANNOUNCEMENT: {
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
    dot: "bg-amber-500",
  },
  PROPOSAL: {
    badge: "bg-violet-50 text-violet-800 ring-violet-200",
    dot: "bg-violet-500",
  },
};

export function parsePostKind(value: unknown): PostKind | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (POST_KINDS.includes(normalized as PostKind)) {
    return normalized as PostKind;
  }
  return undefined;
}

export function postKindLabel(kind: PostKind): string {
  return POST_KIND_LABELS[kind];
}
