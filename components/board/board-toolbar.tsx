"use client";

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path
        d="M2 3.5h12M4.5 8h7M6.5 12.5h3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M2 4.5h9M2 8h6M2 11.5h3" strokeLinecap="round" />
    </svg>
  );
}

const actionBtnCls =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-paper px-3.5 text-sm text-ink-soft shadow-sm transition-colors hover:border-line-strong hover:text-ink";

export function BoardToolbar({
  filtersApplied,
  filtersOpen,
  onFilterClick,
  sortLabel,
  onSortClick,
  onAddTaskClick,
  className = "",
}: {
  filtersApplied: boolean;
  filtersOpen: boolean;
  onFilterClick: () => void;
  sortLabel: string;
  onSortClick: () => void;
  onAddTaskClick: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
      <button
        type="button"
        onClick={onFilterClick}
        aria-pressed={filtersOpen}
        className={`${actionBtnCls} ${
          filtersApplied ? "border-ink/30 text-ink" : ""
        }`}
      >
        <FilterIcon />
        Filter: {filtersApplied ? "Applied" : "Not Applied"}
      </button>

      <button
        type="button"
        onClick={onSortClick}
        className={actionBtnCls}
      >
        <SortIcon />
        {sortLabel}
      </button>

      <button
        type="button"
        onClick={onAddTaskClick}
        className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-ink px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ink/90 dark:text-on-accent dark:hover:bg-accent-bright"
      >
        + Add Task
      </button>
    </div>
  );
}
