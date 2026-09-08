"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, MessageCircle, X } from "lucide-react";
import { formatTaskTitle } from "@/lib/format-task-title";
import { useClientMounted } from "@/lib/use-client-mounted";
import { ui } from "@/components/ui/ui";
import type { BoardTask } from "@/components/board/task-board";

const STATUS_ACTIONS: {
  status: BoardTask["status"];
  label: string;
}[] = [
  { status: "TODO", label: "Move to To-dos" },
  { status: "IN_PROGRESS", label: "Move to In progress" },
  { status: "DONE", label: "Move to Done" },
];

const STATUS_LABEL: Record<BoardTask["status"], string> = {
  TODO: "To-dos",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export function TaskCardActionsSheet({
  task,
  onClose,
  onOpen,
  onOpenUpdates,
  onMove,
}: {
  task: BoardTask;
  onClose: () => void;
  onOpen: () => void;
  onOpenUpdates: () => void;
  onMove: (status: BoardTask["status"]) => void;
}) {
  const mounted = useClientMounted();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="app-scope contents">
      <div
        className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        role="presentation"
      >
        <div
          className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card shadow-[0_-12px_48px_rgba(26,26,26,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-card-actions-title"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex items-start gap-3 border-b border-line px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] tabular-nums text-ink-faint">
                #{task.shortId} · {STATUS_LABEL[task.status]}
              </p>
              <h2
                id="task-card-actions-title"
                className="mt-0.5 text-base font-semibold leading-snug tracking-tight text-ink"
              >
                {formatTaskTitle(task.title)}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1.5 text-ink-faint transition hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </header>

          <div className="flex flex-col gap-2 p-3">
            <button
              type="button"
              onClick={onOpen}
              className={`w-full ${ui.btnPrimary}`}
            >
              Open task
            </button>

            <div className="rounded-xl border border-line bg-paper/60 p-1.5 dark:bg-white/[0.03]">
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Move
              </p>
              <div className="flex flex-col gap-1">
                {STATUS_ACTIONS.map(({ status, label }) => {
                  const isCurrent = task.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => onMove(status)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        isCurrent
                          ? "cursor-default bg-ink/[0.06] font-medium text-ink"
                          : "text-ink-soft hover:bg-white hover:text-ink dark:hover:bg-white/5"
                      }`}
                    >
                      <span>{isCurrent ? `In ${STATUS_LABEL[status]}` : label}</span>
                      {isCurrent ? (
                        <Check
                          className="h-4 w-4 shrink-0 text-ink"
                          strokeWidth={2}
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenUpdates}
              className={`w-full gap-2 ${ui.btnSecondary}`}
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Updates
              {task.updateCount > 0 ? (
                <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                  {task.updateCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg px-3.5 py-2.5 text-sm text-ink-faint transition hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
