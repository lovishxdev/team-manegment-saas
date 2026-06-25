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
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { updateTaskAction } from "@/lib/actions/workspace";
import { formatTaskTitle } from "@/lib/format-task-title";
import { TaskDetailModal } from "@/components/task-detail-modal";
import { Select } from "@/components/select";
import { Avatar, tagColor } from "@/components/ui";

export type TaskAttachment = {
  id: string;
  url: string;
  fileType: string;
};

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
  tags: string[];
  assigneeId: string | null;
  /** Username (preferred) or email of the assignee. */
  assigneeLabel: string | null;
  attachments: TaskAttachment[];
};

export type BoardMember = {
  id: string;
  /** Username (preferred) or email. */
  label: string | null;
};

export type BoardSort = "default" | "title" | "due";

const COLUMNS: {
  status: BoardTask["status"];
  label: string;
  tint: string;
  dot: string;
  countBg: string;
  dropRing: string;
  dropActive: string;
}[] = [
  {
    status: "TODO",
    label: "To Do",
    tint: "bg-rose-100",
    dot: "bg-rose-500",
    countBg: "bg-white/70",
    dropRing: "ring-rose-400/55",
    dropActive: "border-rose-400 bg-rose-200/60 text-rose-800",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    tint: "bg-orange-100",
    dot: "bg-orange-500",
    countBg: "bg-white/70",
    dropRing: "ring-orange-400/55",
    dropActive: "border-orange-400 bg-orange-200/60 text-orange-900",
  },
  {
    status: "DONE",
    label: "Done",
    tint: "bg-violet-100",
    dot: "bg-violet-500",
    countBg: "bg-white/70",
    dropRing: "ring-violet-400/55",
    dropActive: "border-violet-400 bg-violet-200/60 text-violet-900",
  },
];

const SCOPE_STYLES: Record<BoardTask["scope"], string> = {
  FRONTEND: "bg-sky-50 text-sky-700",
  BACKEND: "bg-violet-50 text-violet-700",
  DESIGN: "bg-orange-50 text-orange-700",
  GENERAL: "bg-paper-deep text-ink-soft",
};

const PRIORITY_STYLES: Record<BoardTask["priority"], string> = {
  HIGH: "bg-rose-50 text-rose-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-emerald-50 text-emerald-700",
};

/* Status chips: monospaced labels in low-opacity tints (Kinetic spec). */
const chipCls = "rounded px-2 py-1 font-mono text-[10px] font-medium tracking-wide";

function formatDue(iso: string): { label: string; overdue: boolean } {
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = due < today;
  // Explicit locale: server and browser locales can differ, and a mismatch
  // ("13 Jun" vs "Jun 13") breaks React hydration.
  const label = due.toLocaleDateString("en-GB", {
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
  const isOverdue = due?.overdue && task.status !== "DONE";

  const imageAttachments = task.attachments.filter((a) =>
    a.fileType.startsWith("image/")
  );
  const fileCount = task.attachments.length - imageAttachments.length;
  const cover = imageAttachments[0];

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-task-id={task.id}
      onClick={() => onOpen(task)}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px) rotate(2deg)` }
          : undefined
      }
      className={`cursor-grab rounded-lg border bg-card p-4 ${
        isDragging
          ? "z-10 border-ink/35 shadow-md ring-1 ring-ink/10"
          : "border-line transition-colors hover:border-line-strong"
      }`}
    >
      {/* Chips row: scope + priority + free-form tags + add affordance */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${chipCls} uppercase ${SCOPE_STYLES[task.scope]}`}>
          {task.scope.toLowerCase()}
        </span>
        {task.priority !== "MEDIUM" && (
          <span
            className={`${chipCls} uppercase ${PRIORITY_STYLES[task.priority]}`}
          >
            {task.priority.toLowerCase()}
          </span>
        )}
        {task.tags.slice(0, 3).map((tag) => (
          <span key={tag} className={`${chipCls} ${tagColor(tag)}`}>
            {tag}
          </span>
        ))}
        {task.tags.length > 3 && (
          <span className={`${chipCls} bg-paper-deep text-ink-faint`}>
            +{task.tags.length - 3}
          </span>
        )}
        <span
          title="Add tag"
          className="inline-flex h-[22px] w-[22px] items-center justify-center rounded bg-paper-deep text-[13px] leading-none text-ink-faint transition hover:bg-line hover:text-ink"
        >
          +
        </span>
        <span className="ml-auto font-mono text-[10px] font-medium text-ink-faint/70">
          #{task.shortId}
        </span>
      </div>

      {/* Image preview */}
      {cover && (
        <div className="relative mt-3 overflow-hidden rounded-md border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            alt=""
            draggable={false}
            className="h-32 w-full object-cover"
          />
          {imageAttachments.length > 1 && (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-paper-deep/80 px-2 py-1 font-mono text-[10px] font-medium text-ink-soft backdrop-blur-sm">
              <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.2">
                <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" />
                <circle cx="4.8" cy="5.6" r="1" />
                <path d="M1.5 9.5l3-2.5 2.6 2.2 2.6-1.8 2.8 2.1" />
              </svg>
              {imageAttachments.length - 1}+
            </span>
          )}
        </div>
      )}

      <p className="mt-3 text-lg font-medium leading-snug text-ink">
        {formatTaskTitle(task.title)}
      </p>
      {task.description && (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-faint">
          {task.description}
        </p>
      )}

      {/* Footer: assignee left, meta right */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center">
          {task.assigneeLabel ? (
            <span className="rounded-full ring-2 ring-card">
              <Avatar
                seed={task.assigneeId ?? task.assigneeLabel}
                label={task.assigneeLabel}
                size="h-6 w-6 text-[10px]"
              />
            </span>
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line-strong text-[11px] text-ink-faint">
              +
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 font-mono text-[10px] text-ink-faint">
          {fileCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.2">
                <path d="M9.5 4 5 8.5a1.4 1.4 0 0 0 2 2L11.5 6a2.8 2.8 0 1 0-4-4L3 6.5a4.2 4.2 0 0 0 6 6l3-3" />
              </svg>
              {fileCount}
            </span>
          )}
          {due && (
            <span
              className={`inline-flex items-center gap-1 ${
                isOverdue ? "font-semibold text-red-400" : ""
              }`}
            >
              <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.2">
                <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" />
                <path d="M1.5 5.5h11M4.5 1.5v2M9.5 1.5v2" />
              </svg>
              {isOverdue ? "overdue " : ""}
              {due.label}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Ghost tile shown as a drop target while a task is being dragged.
 * Sized to match the dragged card so the drop feels 1:1.
 */
function DropPlaceholder({
  active,
  height,
  dropActive,
}: {
  active: boolean;
  height: number | null;
  dropActive: string;
}) {
  return (
    <div
      style={height ? { height } : undefined}
      className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 transition-all ${
        active
          ? dropActive
          : "border-line-strong bg-card/40 text-ink-faint/80"
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className="h-6 w-6"
        stroke="currentColor"
        strokeWidth="1.3"
      >
        <rect x="6.5" y="3" width="10" height="12" rx="2" />
        <path d="M13.5 17.2a2 2 0 0 1-1.9 1.3H6a2.5 2.5 0 0 1-2.5-2.5V8.4A2 2 0 0 1 4.8 6.5" />
      </svg>
      <span className="font-mono text-[11px] font-medium tracking-wide">
        {active ? "Release to move here" : "Drop task here"}
      </span>
    </div>
  );
}

function Column({
  status,
  label,
  tint,
  dot,
  countBg,
  dropRing,
  dropActive,
  tasks,
  onOpen,
  dropHint,
  dragHeight,
}: {
  status: BoardTask["status"];
  label: string;
  tint: string;
  dot: string;
  countBg: string;
  dropRing: string;
  dropActive: string;
  tasks: BoardTask[];
  onOpen: (task: BoardTask) => void;
  /** True while a task from another column is being dragged. */
  dropHint: boolean;
  /** Height of the card being dragged, to size the placeholder 1:1. */
  dragHeight: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`rounded-xl p-3 transition ${tint} ${
        isOver ? `ring-2 ${dropRing} ring-offset-2 ring-offset-shell` : ""
      }`}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink">
          {label}
        </h3>
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-soft ${countBg}`}
        >
          {tasks.length}
        </span>
      </header>
      <div className="flex min-h-16 flex-col gap-2.5">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={onOpen} />
        ))}
        {dropHint && (
          <DropPlaceholder
            active={isOver}
            height={dragHeight}
            dropActive={dropActive}
          />
        )}
        {!dropHint && tasks.length === 0 && (
          <p className="rounded-md border border-dashed border-line-strong px-3 py-7 text-center text-xs text-ink-faint">
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
  filtersOpen = true,
  scopeFilter,
  onScopeFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  mineOnly,
  onMineOnlyChange,
  sortBy = "default",
}: {
  workspaceId: string;
  tasks: BoardTask[];
  members: BoardMember[];
  currentUserId: string;
  /** When false, filter controls are hidden (toggled from the header). */
  filtersOpen?: boolean;
  scopeFilter: string;
  onScopeFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  mineOnly: boolean;
  onMineOnlyChange: (value: boolean) => void;
  sortBy?: BoardSort;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<BoardTask | null>(null);
  /** Status of the task currently being dragged, if any. */
  const [dragSource, setDragSource] = useState<BoardTask["status"] | null>(
    null
  );
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  // Local copy so drags update instantly; server state flows back via props.
  const [localTasks, setLocalTasks] = useState(tasks);
  useEffect(() => setLocalTasks(tasks), [tasks]);

  // Distance threshold keeps plain clicks working (opens the modal).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function connect() {
      // Events are filtered per-user through RLS, so the realtime socket
      // must carry the user's JWT -- without it Supabase silently delivers
      // zero events.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`board-${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Task",
            filter: `workspaceId=eq."${workspaceId}"`,
          },
          () => router.refresh()
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.log("[realtime] board subscription active");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(`[realtime] ${status}`, err?.message ?? "");
          }
        });
    }

    connect();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [workspaceId, router]);

  const visibleTasks = useMemo(() => {
    const filtered = localTasks.filter((t) => {
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
    });

    if (sortBy === "title") {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === "due") {
      return [...filtered].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    }
    return filtered;
  }, [
    localTasks,
    scopeFilter,
    assigneeFilter,
    mineOnly,
    currentUserId,
    sortBy,
  ]);

  function handleDragStart(event: DragStartEvent) {
    const taskId = String(event.active.id);
    const task = localTasks.find((t) => t.id === taskId);
    setDragSource(task?.status ?? null);

    // dnd-kit's measured rect (active.rect.current.initial) is not reliably
    // populated yet inside onDragStart -- for tall cards (image previews) it
    // lagged behind. Measure the DOM node directly instead.
    const node = document.querySelector(`[data-task-id="${taskId}"]`);
    setDragHeight(
      node ? node.getBoundingClientRect().height : null
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragSource(null);
    setDragHeight(null);
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

  const scopeOptions = [
    { value: "", label: "All scopes" },
    { value: "GENERAL", label: "General" },
    { value: "FRONTEND", label: "Frontend" },
    { value: "BACKEND", label: "Backend" },
    { value: "DESIGN", label: "Design" },
  ];

  const assigneeOptions = [
    { value: "", label: "All assignees" },
    { value: "unassigned", label: "Unassigned" },
    ...members.map((m) => ({
      value: m.id,
      label: m.label ?? m.id.slice(0, 8),
    })),
  ];

  return (
    <div>
      {filtersOpen && (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          value={scopeFilter}
          onChange={onScopeFilterChange}
          options={scopeOptions}
          className="w-[140px]"
          aria-label="Filter by scope"
        />
        <Select
          size="sm"
          value={assigneeFilter}
          onChange={onAssigneeFilterChange}
          options={assigneeOptions}
          className="min-w-[160px] max-w-[220px]"
          aria-label="Filter by assignee"
        />
        <button
          onClick={() => onMineOnlyChange(!mineOnly)}
          className={`rounded-md border px-3 py-1.5 text-xs transition ${
            mineOnly
              ? "border-ink/30 bg-ink/[0.06] font-medium text-ink"
              : "border-line bg-card text-ink-soft hover:border-line-strong"
          }`}
        >
          My tasks
        </button>
        {(scopeFilter || assigneeFilter || mineOnly) && (
          <button
            onClick={() => {
              onScopeFilterChange("");
              onAssigneeFilterChange("");
              onMineOnlyChange(false);
            }}
            className="text-xs text-ink-faint hover:text-ink"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-faint">
          {visibleTasks.length} of {localTasks.length} tasks
        </span>
      </div>
      )}

      {error && (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Stable id: dnd-kit otherwise autogenerates one that differs between
          server and client render, causing a hydration mismatch. */}
      <DndContext
        id={`board-dnd-${workspaceId}`}
        sensors={sensors}
        // Vertical-only autoscroll: long columns stay reachable mid-drag,
        // but no horizontal drift (threshold.x = 0 disables that axis).
        autoScroll={{ threshold: { x: 0, y: 0.2 } }}
        modifiers={[restrictToWindowEdges]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDragSource(null);
          setDragHeight(null);
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <Column
              key={col.status}
              status={col.status}
              label={col.label}
              tint={col.tint}
              dot={col.dot}
              countBg={col.countBg}
              dropRing={col.dropRing}
              dropActive={col.dropActive}
              tasks={visibleTasks.filter((t) => t.status === col.status)}
              onOpen={setOpenTask}
              dropHint={dragSource !== null && dragSource !== col.status}
              dragHeight={dragHeight}
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
