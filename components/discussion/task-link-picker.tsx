"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { TaskStatus } from "@/lib/generated/prisma/client";
import {
  searchWorkspaceTasksAction,
  type TaskLinkOption,
} from "@/lib/actions/workspace";
import { taskPath } from "@/lib/task-navigation";
import { ui } from "@/components/ui/ui";

function formatStatus(status: TaskStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function TaskLinkPicker({
  workspaceId,
  value,
  selectedTitle,
  onChange,
  disabled,
  className = "",
}: {
  workspaceId: string;
  value: number | null;
  selectedTitle?: string | null;
  onChange: (shortId: number | null, title: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<TaskLinkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [title, setTitle] = useState(selectedTitle ?? null);

  useEffect(() => {
    setTitle(selectedTitle ?? null);
  }, [selectedTitle, value]);

  const loadOptions = useCallback(
    async (nextQuery: string) => {
      setLoading(true);
      const result = await searchWorkspaceTasksAction(workspaceId, nextQuery);
      setLoading(false);
      if (!result.error) {
        setOptions(result.tasks);
        setActiveIndex(0);
      }
    },
    [workspaceId]
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void loadOptions(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, query, loadOptions]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectTask(task: TaskLinkOption) {
    setTitle(task.title);
    setQuery("");
    setOpen(false);
    onChange(task.shortId, task.title);
  }

  function clearSelection() {
    setTitle(null);
    setQuery("");
    setOpen(false);
    onChange(null, null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (value !== null) {
    return (
      <div
        className={`flex min-h-[46px] items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 shadow-[0_1px_3px_rgba(26,26,26,0.04)] ${className}`}
      >
        <Link
          href={taskPath(workspaceId, value)}
          className="min-w-0 flex-1 truncate text-sm text-ink transition hover:text-ink/80"
        >
          <span className="font-mono text-ink-faint">#{value}</span>
          {title ? ` ${title}` : null}
        </Link>
        <button
          type="button"
          onClick={clearSelection}
          disabled={disabled}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-faint transition hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Remove linked task"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        Search tasks to link
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          ref={inputRef}
          id={inputId}
          value={query}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!open) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) =>
                options.length === 0 ? 0 : (current + 1) % options.length
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) =>
                options.length === 0
                  ? 0
                  : (current - 1 + options.length) % options.length
              );
            } else if (event.key === "Enter" && options[activeIndex]) {
              event.preventDefault();
              selectTask(options[activeIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search tasks to link…"
          className={`${ui.input} h-[46px] py-0 pl-10 text-sm`}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-listbox`}
          aria-autocomplete="list"
        />
      </div>

      {open ? (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-30 overflow-hidden rounded-lg border border-line bg-card shadow-[0_8px_24px_rgba(26,26,26,0.12)]"
        >
          {loading ? (
            <p className="px-3 py-2.5 text-sm text-ink-faint">Searching…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-ink-faint">
              {query.trim() ? "No matching tasks" : "No tasks in this workspace"}
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto p-1">
              {options.map((task, index) => {
                const active = index === activeIndex;
                return (
                  <li key={task.shortId} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectTask(task);
                      }}
                      className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                        active
                          ? "bg-ink/[0.06] text-ink"
                          : "text-ink-soft hover:bg-ink/[0.04] hover:text-ink"
                      }`}
                    >
                      <span className="shrink-0 font-mono text-xs text-ink-faint">
                        #{task.shortId}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {task.title}
                      </span>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {formatStatus(task.status)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
