"use client";

import type { PostKind } from "@/lib/generated/prisma/client";
import { POST_KIND_LABELS, POST_KIND_STYLES } from "@/lib/post-kind";

export function PostKindBadge({
  kind,
  className = "",
}: {
  kind: PostKind;
  className?: string;
}) {
  const style = POST_KIND_STYLES[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {POST_KIND_LABELS[kind]}
    </span>
  );
}
