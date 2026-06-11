"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { updateTaskAction } from "@/lib/actions/workspace";
import { TaskDetailModal } from "@/components/task-detail-modal";

export type BoardTask = {
  id: string;
  shortId: number;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  scope: "FRONTEND" | "BACKEND" | "DESIGN" | "GENERAL";
  priority: "LOW" | "MEDIUM" | "HIGH";
  /** ISO string or null */
  dueDate: string | null;
  assigneeId: string | null;
  assigneeEmail: string | null;
};

export type BoardMember = {
  id: string;
  email: string | null;
};

const COLUMNS: { status: BoardTask["status"]; label: string }[] = [
  { status: "TODO", label: "To Do" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
];

const SCOPE_STYLES: Record<BoardTask["scope"], string> = {
  FRONTEND: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  BACKEND: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  DESIGN: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30",
  GENERAL: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
};

const PRIORITY_STYLES: Record<BoardTask["priority"], string> = {
  HIGH: "bg-red-500/10 text-red-300 border-red-500/30",
  MEDIUM: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  LOW: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

function formatDue(iso: string): { label: string; overdue: boolean } {
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = due < today;
  const label = due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { label, overdue };
}

function TaskCard({
  task,
  onOpen,
}: {
  task: BoardTask;
  onOpen: (task: BoardTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const due = task.dueDate ? formatDue(task.dueDate) : null;

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task)}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      className={`cursor-grab rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition-colors hover:border-zinc-600 ${
        isDragging ? "z-10 opacity-80 shadow-2xl" : ""
      }`}
    >
      <p className="text-sm leading-snug">
        <span className="mr-1.5 text-zinc-500">#{task.shortId}</span>
        {task.title}
      </p>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
          {task.description}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${SCOPE_STYLES[task.scope]}`}
        >
          {task.scope}
        </span>
        {task.priority !== "MEDIUM" && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${PRIORITY_STYLES[task.priority]}`}
          >
            {task.priority}
          </span>
        )}
        {due && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] tracking-wide ${
              due.overdue && task.status !== "DONE"
                ? "border-red-500/40 bg-red-500/10 text-red-300"
                : "border-zinc-700 text-zinc-400"
            }`}
          >
            {due.overdue && task.status !== "DONE" ? "overdue " : "due "}
            {due.label}
          </span>
        )}
        {task.assigneeEmail && (
          <span className="ml-auto max-w-[40%] truncate text-[10px] text-zinc-500">
            {task.assigneeEmail.split("@")[0]}
          </span>
        )}
      </div>
    </article>
  );
}

function Column({
  status,
  label,
  tasks,
  onOpen,
}: {
  status: BoardTask["status"];
  label: string;
  tasks: BoardTask[];
  onOpen: (task: BoardTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`rounded-2xl border p-3 transition-colors ${
        isOver
          ? "border-indigo-500/60 bg-indigo-500/5"
          : "border-zinc-800 bg-zinc-900/40"
      }`}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-zinc-300">{label}</h3>
        <span className="text-xs text-zinc-500">{tasks.length}</span>
      </header>
      <div className="flex min-h-16 flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={onOpen} />
        ))}
        {tasks.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-600">
            Drop tasks here
          </p>
        )}
      </div>
    </section>
  );
}

export function TaskBoard({
  workspaceId,
  tasks,
  members,
  currentUserId,
}: {
  workspaceId: string;
  tasks: BoardTask[];
  members: BoardMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<BoardTask | null>(null);

  // Local copy so drags update instantly; server state flows back via props.
  const [localTasks, setLocalTasks] = useState(tasks);
  useEffect(() => setLocalTasks(tasks), [tasks]);

  // Filters
  const [scopeFilter, setScopeFilter] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(false);

  // Distance threshold keeps plain clicks working (opens the modal).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const channel = supabase
      .channel(`board-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Task",
          filter: `workspaceId=eq.${workspaceId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, router]);

  const visibleTasks = useMemo(
    () =>
      localTasks.filter((t) => {
        if (scopeFilter && t.scope !== scopeFilter) return false;
        if (assigneeFilter === "unassigned" && t.assigneeId) return false;
        if (
          assigneeFilter &&
          assigneeFilter !== "unassigned" &&
          t.assigneeId !== assigneeFilter
        )
          return false;
        if (mineOnly && t.assigneeId !== currentUserId) return false;
        return true;
      }),
    [localTasks, scopeFilter, assigneeFilter, mineOnly, currentUserId]
  );

  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const target = event.over?.id as BoardTask["status"] | undefined;
    if (!target) return;

    const task = localTasks.find((t) => t.id === taskId);
    if (!task || task.status === target) return;

    setError(null);
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: target } : t))
    );
    startTransition(async () => {
      const result = await updateTaskAction(workspaceId, taskId, {
        status: target,
      });
      if (result.error) {
        setError(result.error);
        setLocalTasks(tasks); // roll back
      }
    });
  }

  const filterSelectCls =
    "rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className={filterSelectCls}
        >
          <option value="">All scopes</option>
          <option value="GENERAL">General</option>
          <option value="FRONTEND">Frontend</option>
          <option value="BACKEND">Backend</option>
          <option value="DESIGN">Design</option>
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className={filterSelectCls}
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.email ?? m.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setMineOnly((v) => !v)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
            mineOnly
              ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
          }`}
        >
          My tasks
        </button>
        {(scopeFilter || assigneeFilter || mineOnly) && (
          <button
            onClick={() => {
              setScopeFilter("");
              setAssigneeFilter("");
              setMineOnly(false);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-zinc-600">
          {visibleTasks.length} of {localTasks.length} tasks
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <Column
              key={col.status}
              status={col.status}
              label={col.label}
              tasks={visibleTasks.filter((t) => t.status === col.status)}
              onOpen={setOpenTask}
            />
          ))}
        </div>
      </DndContext>

      {openTask && (
        <TaskDetailModal
          workspaceId={workspaceId}
          task={openTask}
          members={members}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  );
}
