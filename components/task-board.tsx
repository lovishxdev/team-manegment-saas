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
import { TaskDetailModal } from "@/components/task-detail-modal";
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

const COLUMNS: {
  status: BoardTask["status"];
  label: string;
  tint: string;
  dot: string;
}[] = [
  {
    status: "TODO",
    label: "To Do",
    tint: "bg-paper-deep",
    dot: "bg-ink-faint",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    tint: "bg-paper-deep",
    dot: "bg-amber-300",
  },
  {
    status: "DONE",
    label: "Done",
    tint: "bg-paper-deep",
    dot: "bg-accent",
  },
];

const SCOPE_STYLES: Record<BoardTask["scope"], string> = {
  FRONTEND: "bg-sky-400/15 text-sky-300",
  BACKEND: "bg-violet-400/15 text-violet-300",
  DESIGN: "bg-orange-400/15 text-orange-300",
  GENERAL: "bg-white/[0.06] text-ink-soft",
};

const PRIORITY_STYLES: Record<BoardTask["priority"], string> = {
  HIGH: "bg-rose-400/15 text-rose-300",
  MEDIUM: "bg-amber-400/15 text-amber-300",
  LOW: "bg-emerald-400/15 text-emerald-300",
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
          ? // No transition while dragging: transform must track the pointer
            // 1:1, otherwise the card lags behind on every move.
            "z-10 border-accent/60 shadow-[0_0_24px_rgba(0,255,194,0.08)]"
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
          <span className={`${chipCls} bg-white/[0.06] text-ink-faint`}>
            +{task.tags.length - 3}
          </span>
        )}
        <span
          title="Add tag"
          className="inline-flex h-[22px] w-[22px] items-center justify-center rounded bg-white/[0.06] text-[13px] leading-none text-ink-faint transition hover:bg-white/[0.1] hover:text-ink"
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

      <p className="mt-3 text-[15px] font-medium leading-snug text-ink">
        {task.title}
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
}: {
  active: boolean;
  height: number | null;
}) {
  return (
    <div
      style={height ? { height } : undefined}
      className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 transition-all ${
        active
          ? "border-accent/60 bg-accent-soft text-accent"
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
  tasks,
  onOpen,
  dropHint,
  dragHeight,
}: {
  status: BoardTask["status"];
  label: string;
  tint: string;
  dot: string;
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
      className={`rounded-lg border p-3 transition ${tint} ${
        isOver ? "border-accent/50" : "border-line"
      }`}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink">
          {label}
        </h3>
        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-soft">
          {tasks.length}
        </span>
      </header>
      <div className="flex min-h-16 flex-col gap-2.5">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={onOpen} />
        ))}
        {dropHint && <DropPlaceholder active={isOver} height={dragHeight} />}
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
  /** Status of the task currently being dragged, if any. */
  const [dragSource, setDragSource] = useState<BoardTask["status"] | null>(
    null
  );
  const [dragHeight, setDragHeight] = useState<number | null>(null);

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
            filter: `workspaceId=eq.${workspaceId}`,
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

  const filterSelectCls =
    "rounded-md border border-line bg-card px-3 py-1.5 text-xs text-ink-soft outline-none transition focus:border-accent/60";

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
              {m.label ?? m.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setMineOnly((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-xs transition ${
            mineOnly
              ? "border-accent/60 bg-accent-soft text-accent"
              : "border-line bg-card text-ink-soft hover:border-line-strong"
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
            className="text-xs text-ink-faint hover:text-ink"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-faint">
          {visibleTasks.length} of {localTasks.length} tasks
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
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
