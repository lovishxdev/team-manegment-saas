"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
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
import { MessageCircle, Plus } from "lucide-react";
import {
  rememberTaskReturnPath,
  taskNewPath,
  taskPath,
} from "@/lib/task-navigation";
import { Select } from "@/components/ui/select";
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
  updateCount: number;
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
  emptyZone: string;
  dropRing: string;
  dropHint: string;
}[] = [
  {
    status: "TODO",
    label: "To-dos",
    columnClass: "kanban-column--todo",
    emptyZone:
      "border-rose-300/55 bg-white/25 hover:border-rose-400/70 hover:bg-white/40",
    dropRing: "ring-rose-400/35",
    dropHint: "border-rose-300/55 bg-white/30 text-rose-800/85",
  },
  {
    status: "IN_PROGRESS",
    label: "In progress",
    columnClass: "kanban-column--progress",
    emptyZone:
      "border-orange-300/55 bg-white/25 hover:border-orange-400/70 hover:bg-white/40",
    dropRing: "ring-orange-400/35",
    dropHint: "border-orange-300/55 bg-white/30 text-orange-900/85",
  },
  {
    status: "DONE",
    label: "Done",
    columnClass: "kanban-column--done",
    emptyZone:
      "border-violet-300/55 bg-white/25 hover:border-violet-400/70 hover:bg-white/40",
    dropRing: "ring-violet-400/35",
    dropHint: "border-violet-300/55 bg-white/30 text-violet-900/85",
  },
];

const COLUMN_STATUSES = new Set<BoardTask["status"]>([
  "TODO",
  "IN_PROGRESS",
  "DONE",
]);

/** Prefer column droppables so hover + drop work over cards, not just gaps. */
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  const columnPointer = pointerHits.find((hit) =>
    COLUMN_STATUSES.has(hit.id as BoardTask["status"])
  );
  if (columnPointer) return [columnPointer];

  const rectHits = rectIntersection(args);
  const columnRect = rectHits.find((hit) =>
    COLUMN_STATUSES.has(hit.id as BoardTask["status"])
  );
  if (columnRect) return [columnRect];

  return pointerHits.length > 0 ? pointerHits : rectHits;
};

function resolveDropColumn(
  overId: string | number | undefined,
  tasks: BoardTask[]
): BoardTask["status"] | null {
  if (
    overId === "TODO" ||
    overId === "IN_PROGRESS" ||
    overId === "DONE"
  ) {
    return overId;
  }
  if (overId == null) return null;
  return tasks.find((t) => t.id === String(overId))?.status ?? null;
}

const PRIORITY_STYLES: Record<BoardTask["priority"], string> = {
  HIGH: "bg-rose-50 text-rose-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-emerald-50 text-emerald-700",
};

/* Status chips: monospaced labels in low-opacity tints (Kinetic spec). */
const chipCls =
  "inline-flex h-[22px] items-center rounded px-2 font-mono text-[10px] font-medium leading-none tracking-wide";

const cardMetaCls =
  "inline-flex h-6 items-center gap-1 font-mono text-[11px] leading-none tabular-nums";

const cardMetaIconCls = "size-3.5 shrink-0";

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

function TaskCardBody({
  task,
  onOpenUpdates,
}: {
  task: BoardTask;
  onOpenUpdates: (task: BoardTask) => void;
}) {
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
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
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
        </div>
        <span className={`${chipCls} shrink-0 px-0 text-ink-faint/70`}>
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

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex h-6 shrink-0 items-center">
          {task.assignees.length > 0 ? (
            <MemberAvatarStack
              members={task.assignees}
              max={3}
              size="h-6 w-6 text-[10px]"
              ringClass="ring-card"
              overlap={8}
            />
          ) : (
            <span
              aria-hidden
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-faint"
            >
              <Plus className="h-3 w-3 shrink-0" strokeWidth={2} />
            </span>
          )}
        </div>
        <div className="flex h-6 shrink-0 items-center gap-2.5 text-ink-faint">
          <button
            type="button"
            title="Task updates"
            aria-label={
              task.updateCount > 0
                ? `${task.updateCount} updates`
                : "Open task updates"
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onOpenUpdates(task);
            }}
            className={`${cardMetaCls} shrink-0 rounded-md px-1 transition hover:bg-paper-deep hover:text-ink ${
              task.updateCount > 0 ? "text-ink-soft" : "text-ink-faint/80"
            }`}
          >
            <MessageCircle
              className={cardMetaIconCls}
              strokeWidth={1.75}
              aria-hidden
            />
            <span>{task.updateCount}</span>
          </button>
          {fileCount > 0 && (
            <span className={`${cardMetaCls} shrink-0`}>
              <svg
                viewBox="0 0 14 14"
                fill="none"
                className={cardMetaIconCls}
                stroke="currentColor"
                strokeWidth="1.2"
                aria-hidden
              >
                <path d="M9.5 4 5 8.5a1.4 1.4 0 0 0 2 2L11.5 6a2.8 2.8 0 1 0-4-4L3 6.5a4.2 4.2 0 0 0 6 6l3-3" />
              </svg>
              <span>{fileCount}</span>
            </span>
          )}
          {due && (
            <span
              className={`${cardMetaCls} shrink-0 ${
                isOverdue ? "font-semibold text-red-400" : ""
              }`}
            >
              <svg
                viewBox="0 0 14 14"
                fill="none"
                className={cardMetaIconCls}
                stroke="currentColor"
                strokeWidth="1.2"
                aria-hidden
              >
                <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" />
                <path d="M1.5 5.5h11M4.5 1.5v2M9.5 1.5v2" />
              </svg>
              <span>
                {isOverdue ? "overdue " : ""}
                {due.label}
              </span>
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
  onOpenUpdates,
}: {
  task: BoardTask;
  onOpen: (task: BoardTask) => void;
  onOpenUpdates: (task: BoardTask) => void;
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
      className={`${taskCardSurface} touch-none transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_4px_12px_rgba(26,26,26,0.08)] active:cursor-grabbing ${
        isDragging
          ? "pointer-events-none opacity-35"
          : "cursor-grab"
      }`}
    >
      <TaskCardBody task={task} onOpenUpdates={onOpenUpdates} />
    </article>
  );
}

function TaskCardOverlay({ task }: { task: BoardTask }) {
  return (
    <article
      className={`${taskCardSurface} w-[min(100%,22rem)] cursor-grabbing border-line-strong shadow-[0_8px_24px_rgba(26,26,26,0.12)]`}
    >
      <TaskCardBody task={task} onOpenUpdates={() => {}} />
    </article>
  );
}

function ColumnEmptyState({
  status,
  emptyZone,
  onCreate,
  isDropTarget = false,
}: {
  status: BoardTask["status"];
  emptyZone: string;
  onCreate: (status: BoardTask["status"]) => void;
  isDropTarget?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onCreate(status)}
      className={`group flex min-h-[7.5rem] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-3 py-7 text-center transition duration-150 ${emptyZone}`}
    >
      {!isDropTarget && (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/70 text-ink-faint shadow-sm transition group-hover:text-ink">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
      )}
      <span className="text-sm font-medium text-ink-soft transition group-hover:text-ink">
        {isDropTarget ? "Release to move here" : "Add task"}
      </span>
      {!isDropTarget && (
        <span className="text-xs text-ink-faint">or drag one here</span>
      )}
    </button>
  );
}

function ColumnAddTask({
  status,
  onCreate,
}: {
  status: BoardTask["status"];
  onCreate: (status: BoardTask["status"]) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCreate(status)}
      className="flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-ink-faint transition hover:bg-white/45 hover:text-ink"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      Add task
    </button>
  );
}

function ColumnDropHint({ hintClass }: { hintClass: string }) {
  return (
    <div
      className={`rounded-lg border border-dashed px-3 py-2.5 text-center text-xs font-medium ${hintClass}`}
    >
      Release to move here
    </div>
  );
}

function Column({
  status,
  label,
  columnClass,
  emptyZone,
  dropRing,
  dropHint,
  tasks,
  onOpen,
  onOpenUpdates,
  onCreate,
  dragSource,
  overColumn,
}: {
  status: BoardTask["status"];
  label: string;
  columnClass: string;
  emptyZone: string;
  dropRing: string;
  dropHint: string;
  tasks: BoardTask[];
  onOpen: (task: BoardTask) => void;
  onOpenUpdates: (task: BoardTask) => void;
  onCreate: (status: BoardTask["status"]) => void;
  dragSource: BoardTask["status"] | null;
  overColumn: BoardTask["status"] | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const isDragging = dragSource !== null;
  const isDropTarget =
    isDragging &&
    dragSource !== status &&
    (isOver || overColumn === status);
  const isSourceColumn = isDragging && dragSource === status;

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column ${columnClass} flex min-h-[18rem] flex-col transition-[box-shadow,opacity] duration-150 ${
        isDropTarget
          ? `ring-1 ${dropRing} ring-offset-1 ring-offset-shell`
          : ""
      } ${isSourceColumn ? "opacity-75" : ""}`}
    >
      <header className="mb-3.5 flex items-baseline gap-2 px-0.5">
        <h3 className="text-[15px] font-medium leading-none tracking-tight text-ink">
          {label}
        </h3>
        <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-md bg-black/[0.06] px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink-soft">
          {tasks.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2.5">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={onOpen}
            onOpenUpdates={onOpenUpdates}
          />
        ))}
        {tasks.length === 0 && (
          <ColumnEmptyState
            status={status}
            emptyZone={
              isDropTarget
                ? `${emptyZone} !border-solid ring-1 ${dropRing}`
                : emptyZone
            }
            onCreate={onCreate}
            isDropTarget={isDropTarget}
          />
        )}
        {isDropTarget && tasks.length > 0 && (
          <ColumnDropHint hintClass={dropHint} />
        )}
        {tasks.length > 0 && <ColumnAddTask status={status} onCreate={onCreate} />}
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
  const [overColumn, setOverColumn] = useState<BoardTask["status"] | null>(
    null
  );
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
    rememberTaskReturnPath(pathname);
    router.replace(taskPath(workspaceId, pendingTaskShortId));
  }, [pendingTaskShortId, workspaceId, pathname, router]);

  useEffect(() => {
    if (!filtersOpen || membersLoaded) return;

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
  }, [workspaceId, filtersOpen, membersLoaded]);

  function openTask(task: BoardTask) {
    rememberTaskReturnPath(pathname);
    router.push(taskPath(workspaceId, task.shortId));
  }

  function openTaskUpdates(task: BoardTask) {
    rememberTaskReturnPath(pathname);
    router.push(taskPath(workspaceId, task.shortId, { tab: "updates" }));
  }

  function createTaskInColumn(columnStatus: BoardTask["status"]) {
    rememberTaskReturnPath(pathname);
    router.push(taskNewPath(workspaceId, { status: columnStatus }));
  }

  // Distance threshold keeps plain clicks working (opens the task page).
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
    setOverColumn(null);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverColumn(resolveDropColumn(event.over?.id, localTasks));
  }

  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const target = resolveDropColumn(event.over?.id, localTasks);
    const task = localTasks.find((t) => t.id === taskId);

    if (target && task && task.status !== target) {
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

    setDragSource(null);
    setActiveTask(null);
    setOverColumn(null);
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
        collisionDetection={boardCollisionDetection}
        // Vertical-only autoscroll: long columns stay reachable mid-drag,
        // but no horizontal drift (threshold.x = 0 disables that axis).
        autoScroll={{ threshold: { x: 0, y: 0.2 } }}
        modifiers={[restrictToWindowEdges]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDragSource(null);
          setActiveTask(null);
          setOverColumn(null);
        }}
      >
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <Column
              key={col.status}
              status={col.status}
              label={col.label}
              columnClass={col.columnClass}
              emptyZone={col.emptyZone}
              dropRing={col.dropRing}
              dropHint={col.dropHint}
              tasks={visibleTasks.filter((t) => t.status === col.status)}
              onOpen={openTask}
              onOpenUpdates={openTaskUpdates}
              onCreate={createTaskInColumn}
              dragSource={dragSource}
              overColumn={overColumn}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
