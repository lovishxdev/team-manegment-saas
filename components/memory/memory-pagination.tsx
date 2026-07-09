import Link from "next/link";
import { ui } from "@/components/ui/ui";

export const MEMORY_TIMELINE_PAGE_SIZE = 20;

export function memoryTimelinePageHref(
  workspaceId: string,
  page: number
): string {
  const base = `/w/${workspaceId}/memory`;
  return page <= 1 ? base : `${base}?page=${page}`;
}

export function MemoryPagination({
  workspaceId,
  page,
  pageSize,
  total,
}: {
  workspaceId: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <p className="text-sm text-ink-soft">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={memoryTimelinePageHref(workspaceId, page - 1)}
            className={ui.btnSecondary}
          >
            Previous
          </Link>
        ) : null}
        <span className="px-1 font-mono text-xs text-ink-faint">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={memoryTimelinePageHref(workspaceId, page + 1)}
            className={ui.btnSecondary}
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
