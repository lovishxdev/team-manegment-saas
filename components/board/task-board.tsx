"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  fetchWorkspaceMemberLabelsAction,
  updateTaskAction,
} from "@/lib/actions/workspace";
import { formatTaskTitle } from "@/lib/format-task-title";
import { markdownToPlainText } from "@/lib/markdown/parse";
import { TaskModal } from "@/components/board/task-modal";
import { Select } from "@/components/ui/select";
import { LoadingCenter } from "@/components/ui/loading";
import { tagColor } from "@/components/ui/ui";
import { MemberAvatarStack } from "@/components/members/member-avatar-stack";

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
  categoryId: string;
  categoryName: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  /** ISO string or null */
  dueDate: string | null;
  tags: string[];
  assignees: { id: string; label: string | null }[];
  attachments: TaskAttachment[];
};

export type BoardMember = {
  id: string;
  /** Username (preferred) or email. */
  label: string | null;
};

export type BoardCategory = {
  id: string;
  name: string;
};

export type BoardSort = "default" | "title" | "due";

const COLUMNS: {
  status: BoardTask["status"];
  label: string;
  columnClass: string;
  dot: string;
  countBg: string;
  dropRing: string;
  dropActive: string;
}[] = [
  {
    status: "TODO",
    label: "To Do",
    columnClass: "kanban-column kanban-column--todo",
    dot: "bg-rose-500",
    countBg: "bg-white/70",
    dropRing: "ring-rose-400/55",
    dropActive: "border-rose-400 bg-rose-200/60 text-rose-800",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    columnClass: "kanban-column kanban-column--progress",
    dot: "bg-orange-500",
    countBg: "bg-white/70",
    dropRing: "ring-orange-400/55",
    dropActive: "border-orange-400 bg-orange-200/60 text-orange-900",
  },
  {
    status: "DONE",
    label: "Done",
    columnClass: "kanban-column kanban-column--done",
    dot: "bg-violet-500",
    countBg: "bg-white/70",
    dropRing: "ring-violet-400/55",
    dropActive: "border-violet-400 bg-violet-200/60 text-violet-900",
  },
];

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

function TaskCardBody({ task }: { task: BoardTask }) {
  const due = task.dueDate ? formatDue(task.dueDate) : null;
  const isOverdue = due?.overdue && task.status !== "DONE";

  const imageAttachments = task.attachments.filter((a) =>
    a.fileType.startsWith("image/")
  );
  const fileCount = task.attachments.length - imageAttachments.length;
  const cover = imageAttachments[0];

  return (
    <>
      {/* Chips row: scope + priority + free-form tags + add affordance */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${chipCls} ${tagColor(task.categoryName)}`}>
          {task.categoryName}
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
          className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded bg-paper-deep text-ink-faint transition hover:bg-line hover:text-ink"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden>
            <path
              d="M6 2.5v7M2.5 6h7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="ml-auto font-mono text-[10px] font-medium text-ink-faint/70">
          #{task.shortId}
        </span>
      </div>

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
          {markdownToPlainText(task.description)}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center">
          {task.assignees.length > 0 ? (
            <MemberAvatarStack
              members={task.assignees}
              max={3}
              size="h-6 w-6 text-[10px]"
              ringClass="ring-card"
              overlap={8}
            />
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
    </>
  );
}

const taskCardSurface =
  "rounded-lg border border-line bg-card p-4 shadow-[0_1px_3px_rgba(26,26,26,0.05)]";

function TaskCard({
  task,
  onOpen,
}: {
  task: BoardTask;
  onOpen: (task: BoardTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style =
    !isDragging && transform
      ? { transform: CSS.Translate.toString(transform) }
      : undefined;

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-task-id={task.id}
      onClick={() => {
        if (!isDragging) onOpen(task);
      }}
      style={style}
      className={`${taskCardSurface} touch-none transition-[border-color,box-shadow,opacity] duration-150 hover:border-line-strong hover:shadow-[0_4px_12px_rgba(26,26,26,0.08)] active:cursor-grabbing ${
        isDragging
          ? "pointer-events-none opacity-0"
          : "cursor-grab"
      }`}
    >
      <TaskCardBody task={task} />
    </article>
  );
}

function TaskCardOverlay({ task }: { task: BoardTask }) {
  return (
    <article
      className={`${taskCardSurface} w-[min(100%,22rem)] cursor-grabbing border-ink/35 shadow-lg ring-1 ring-ink/10 rotate-2`}
    >
      <TaskCardBody task={task} />
    </article>
  );
}

/**
 * Ghost tile shown as a drop target while a task is being dragged.
 * Sized to match the dragged card so the drop feels 1:1.
 */
function DropPlaceholder({
  height,
  dropActive,
}: {
  height: number;
  dropActive: string;
}) {
  return (
    <div
      style={{ height }}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 transition-colors duration-200 ${dropActive}`}
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
        Release to move here
      </span>
    </div>
  );
}

/** Expands/collapses the drop slot while dragging over a column. */
function AnimatedDropSlot({
  open,
  height,
  dropActive,
}: {
  open: boolean;
  height: number | null;
  dropActive: string;
}) {
  const targetHeight = height ?? 112;

  return (
    <div
      aria-hidden={!open}
      className="overflow-hidden transition-[height,opacity] duration-300 ease-out"
      style={{
        height: open ? targetHeight : 0,
        opacity: open ? 1 : 0,
      }}
    >
      <DropPlaceholder height={targetHeight} dropActive={dropActive} />
    </div>
  );
}

function Column({
  status,
  label,
  columnClass,
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
  columnClass: string;
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
      className={`transition-[box-shadow] duration-300 ease-out ${columnClass} ${
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
          <AnimatedDropSlot
            open={isOver}
            height={dragHeight}
            dropActive={dropActive}
          />
        )}
        {tasks.length === 0 && !(dropHint && isOver) && (
          <p className="rounded-md border border-dashed border-line-strong px-3 py-7 text-center text-xs text-ink-faint">
            Drop tasks here
          </p>
        )}
      </div>
    </section>
  );
}

function seedMembersFromTasks(tasks: BoardTask[]): BoardMember[] {
  const map = new Map<string, BoardMember>();
  for (const task of tasks) {
    for (const assignee of task.assignees) {
      if (!map.has(assignee.id)) {
        map.set(assignee.id, assignee);
      }
    }
  }
  return [...map.values()];
}

export function TaskBoard({
  workspaceId,
  tasks,
  categories,
  currentUserId,
  filtersOpen = true,
  categoryFilter,
  onCategoryFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  mineOnly,
  onMineOnlyChange,
  sortBy = "default",
}: {
  workspaceId: string;
  tasks: BoardTask[];
  categories: BoardCategory[];
  currentUserId: string;
  /** When false, filter controls are hidden (toggled from the header). */
  filtersOpen?: boolean;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  mineOnly: boolean;
  onMineOnlyChange: (value: boolean) => void;
  sortBy?: BoardSort;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<BoardTask | null>(null);
  const pendingTaskShortId = useMemo(() => {
    const raw = searchParams.get("task");
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);
  /** Status of the task currently being dragged, if any. */
  const [dragSource, setDragSource] = useState<BoardTask["status"] | null>(
    null
  );
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [members, setMembers] = useState<BoardMember[]>(() =>
    seedMembersFromTasks(tasks)
  );
  const [membersLoaded, setMembersLoaded] = useState(false);

  // Local copy so drags update instantly; server state flows back via props.
  const [localTasks, setLocalTasks] = useState(tasks);
  useEffect(() => setLocalTasks(tasks), [tasks]);
  useEffect(() => setMembers(seedMembersFromTasks(tasks)), [tasks]);

  useEffect(() => {
    if (pendingTaskShortId === null) return;
    const match = localTasks.find((t) => t.shortId === pendingTaskShortId);
    if (!match) return;
    setOpenTask(match);
    router.replace(pathname, { scroll: false });
  }, [pendingTaskShortId, localTasks, pathname, router]);

  useEffect(() => {
    if (pendingTaskShortId === null || openTask) return;
    const match = localTasks.find((t) => t.shortId === pendingTaskShortId);
    if (match) return;

    const timer = window.setTimeout(() => {
      router.replace(pathname, { scroll: false });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [pendingTaskShortId, openTask, localTasks, pathname, router]);

  useEffect(() => {
    if ((!filtersOpen && !openTask) || membersLoaded) return;

    let cancelled = false;
    fetchWorkspaceMemberLabelsAction(workspaceId).then((loaded) => {
      if (!cancelled) {
        setMembers(loaded);
        setMembersLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, filtersOpen, openTask, membersLoaded]);

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
      if (categoryFilter && t.categoryId !== categoryFilter) return false;
      if (assigneeFilter === "unassigned" && t.assignees.length > 0) return false;
      if (
        assigneeFilter &&
        assigneeFilter !== "unassigned" &&
        !t.assignees.some((a) => a.id === assigneeFilter)
      )
        return false;
      if (mineOnly && !t.assignees.some((a) => a.id === currentUserId)) return false;
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
    categoryFilter,
    assigneeFilter,
    mineOnly,
    currentUserId,
    sortBy,
  ]);

  function handleDragStart(event: DragStartEvent) {
    const taskId = String(event.active.id);
    const task = localTasks.find((t) => t.id === taskId);
    setDragSource(task?.status ?? null);
    setActiveTask(task ?? null);

    const node = document.querySelector(`[data-task-id="${taskId}"]`);
    setDragHeight(
      node ? node.getBoundingClientRect().height : null
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragSource(null);
    setActiveTask(null);
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

  const categoryOptions = [
    { value: "", label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
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
      {pendingTaskShortId !== null && !openTask ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
          <div className="rounded-2xl border border-line bg-card px-8 py-6 shadow-lg">
            <LoadingCenter label="Opening task…" className="min-h-0" />
          </div>
        </div>
      ) : null}
      {filtersOpen && (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          value={categoryFilter}
          onChange={onCategoryFilterChange}
          options={categoryOptions}
          className="w-[160px]"
          aria-label="Filter by category"
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
        {(categoryFilter || assigneeFilter || mineOnly) && (
          <button
            onClick={() => {
              onCategoryFilterChange("");
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
          setActiveTask(null);
          setDragHeight(null);
        }}
      >
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <Column
              key={col.status}
              status={col.status}
              label={col.label}
              columnClass={col.columnClass}
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
        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {openTask && (
        <TaskModal
          mode="edit"
          workspaceId={workspaceId}
          task={openTask}
          members={members}
          categories={categories}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  );
}
