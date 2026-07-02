"use client";

export type KanbanTask = {
  id: string;
  chip: string;
  chipCls: string;
  title: string;
  assignee: { initial: string; cls: string };
  meta: string;
  priorityCls: string;
  priorityLabel: string;
};

type KanbanPanelProps = {
  workspaceName?: string;
  tasksByColumn: {
    todo: KanbanTask[];
    doing: KanbanTask[];
    done: KanbanTask[];
  };
  statusText?: string;
  pulse?: boolean;
  className?: string;
};

export function KanbanPanel({
  workspaceName = "weekend-hack-2026",
  tasksByColumn,
  statusText = "Live · real-time sync",
  pulse = false,
  className = "min-h-0 flex-1",
}: KanbanPanelProps) {
  return (
    <div
      className={`flex flex-col rounded-[clamp(1rem,2vw,1.75rem)] border border-[#e5e7eb] bg-white/90 p-[clamp(1rem,2vw,2rem)] shadow-[0_24px_80px_-32px_rgba(20,20,30,0.22)] backdrop-blur-md ${className}`}
    >
      <div className="mb-[clamp(0.75rem,2vh,1.5rem)] flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[clamp(0.65rem,1vw,0.8rem)] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
            Euclis workspace
          </p>
          <h2 className="mt-1 truncate text-[clamp(1.25rem,2.2vw,2rem)] font-semibold tracking-tight text-[#1a1a1a]">
            {workspaceName}
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#f8f8f8] px-4 py-2">
          {pulse ? (
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="mkt-pulse-dot absolute inset-0" />
            </span>
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
          )}
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            {statusText}
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-[clamp(0.5rem,1.2vw,1.25rem)]">
        <Column label="To Do" dot="bg-rose-500" tint="bg-rose-50/80">
          {tasksByColumn.todo.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </Column>
        <Column label="In Progress" dot="bg-orange-500" tint="bg-orange-50/80">
          {tasksByColumn.doing.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </Column>
        <Column label="Done" dot="bg-violet-500" tint="bg-violet-50/80">
          {tasksByColumn.done.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </Column>
      </div>
    </div>
  );
}

function Column({
  label,
  dot,
  tint,
  children,
}: {
  label: string;
  dot: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-h-0 flex-col rounded-xl p-4 ${tint}`}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1a1a1a]">
          {label}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.4rem,0.8vh,0.75rem)]">{children}</div>
    </div>
  );
}

function TaskCard({ task }: { task: KanbanTask }) {
  return (
    <div className="mkt-card-pop rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <span
          className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${task.chipCls}`}
        >
          {task.chip}
        </span>
        <span
          className={`ml-auto rounded-md px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide ${task.priorityCls}`}
        >
          {task.priorityLabel}
        </span>
      </div>
      <p className="mt-2 text-[clamp(0.85rem,1.2vw,1.05rem)] font-medium leading-snug text-[#1a1a1a]">
        {task.title}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold ${task.assignee.cls}`}
        >
          {task.assignee.initial}
        </span>
        <span className="font-mono text-[11px] text-[#9ca3af]">{task.meta}</span>
      </div>
    </div>
  );
}
