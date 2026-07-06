"use client";

import { Search, X } from "lucide-react";
import type { DashboardSearchTask } from "@/lib/services/workspace";
import { DashboardTaskRow } from "@/components/dashboard/dashboard-task-row";
import { ui } from "@/components/ui/ui";

export function DashboardSearch({
  query,
  onQueryChange,
  results,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  results: DashboardSearchTask[];
}) {
  const searching = query.trim().length > 0;

  return (
    <section className="mb-6">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search tasks, assignees, status…"
          aria-label="Search dashboard"
          className={`${ui.input} pl-10 pr-10 text-base`}
        />
        {searching ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1.5 text-ink-faint transition hover:bg-paper-deep/80 hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      {searching ? (
        <div className="mt-3">
          {results.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {results.map((task) => (
                <li key={task.id}>
                  <DashboardTaskRow task={task} showAssignees />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-line/70 bg-paper/80 px-3 py-2.5 text-sm text-ink-soft">
              No tasks match &ldquo;{query.trim()}&rdquo;
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
