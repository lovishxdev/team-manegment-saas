"use client";

import { useRef, useState } from "react";
import { BoardToolbar } from "@/components/board-toolbar";
import { NewTaskForm } from "@/components/new-task-form";
import { WorkspaceToolbarPortal } from "@/components/workspace-toolbar-slot";
import {
  TaskBoard,
  type BoardSort,
  type BoardTask,
} from "@/components/task-board";

const SORT_LABELS: Record<BoardSort, string> = {
  default: "Sorting",
  title: "Title A–Z",
  due: "Due date",
};

export function BoardPageContent({
  workspaceId,
  tasks,
  currentUserId,
}: {
  workspaceId: string;
  tasks: BoardTask[];
  currentUserId: string;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scopeFilter, setScopeFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [sortBy, setSortBy] = useState<BoardSort>("default");
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const addTaskRef = useRef<HTMLDivElement>(null);

  const filtersApplied = Boolean(scopeFilter || assigneeFilter || mineOnly);

  function cycleSort() {
    setSortBy((current) =>
      current === "default" ? "title" : current === "title" ? "due" : "default"
    );
  }

  function openAddTask() {
    setAddTaskOpen(true);
    requestAnimationFrame(() => {
      addTaskRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    });
  }

  return (
    <>
      <WorkspaceToolbarPortal>
        <BoardToolbar
          filtersApplied={filtersApplied}
          filtersOpen={filtersOpen}
          onFilterClick={() => setFiltersOpen((open) => !open)}
          sortLabel={SORT_LABELS[sortBy]}
          onSortClick={cycleSort}
          onAddTaskClick={() =>
            addTaskOpen ? setAddTaskOpen(false) : openAddTask()
          }
          addTaskOpen={addTaskOpen}
        />
      </WorkspaceToolbarPortal>

      {addTaskOpen && (
        <div ref={addTaskRef} className="mb-6 max-w-2xl">
          <NewTaskForm workspaceId={workspaceId} />
        </div>
      )}

      <TaskBoard
        workspaceId={workspaceId}
        tasks={tasks}
        currentUserId={currentUserId}
        filtersOpen={filtersOpen}
        scopeFilter={scopeFilter}
        onScopeFilterChange={setScopeFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={setAssigneeFilter}
        mineOnly={mineOnly}
        onMineOnlyChange={setMineOnly}
        sortBy={sortBy}
      />
    </>
  );
}
