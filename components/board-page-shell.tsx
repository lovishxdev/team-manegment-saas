"use client";

import { useRef, useState } from "react";
import { BoardToolbar } from "@/components/board-toolbar";
import { NewTaskForm } from "@/components/new-task-form";
import {
  TaskBoard,
  type BoardSort,
  type BoardTask,
} from "@/components/task-board";
import { WorkspacePageHeader } from "@/components/workspace-page-header";

const SORT_LABELS: Record<BoardSort, string> = {
  default: "Sorting",
  title: "Title A–Z",
  due: "Due date",
};

export function BoardPageShell({
  workspaceId,
  workspaceName,
  tasks,
  currentUserId,
  canInvite,
}: {
  workspaceId: string;
  workspaceName: string;
  tasks: BoardTask[];
  currentUserId: string;
  canInvite: boolean;
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
    <main className="mx-auto w-full max-w-6xl">
      <WorkspacePageHeader
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        activeTab="board"
        breadcrumbLeaf="Overview"
        members={[]}
        canInvite={canInvite}
        tabBarEnd={
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
        }
      />

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
    </main>
  );
}
