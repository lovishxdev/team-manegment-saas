"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { WorkspaceToolbarPortal } from "@/components/workspace/workspace-toolbar-slot";
import { BoardContentSkeleton } from "@/components/ui/tab-content-skeleton";
import {
  TaskBoard,
  type BoardSort,
  type BoardTask,
} from "@/components/board/task-board";
import {
  rememberTaskReturnPath,
  taskNewPath,
} from "@/lib/task-navigation";

const SORT_LABELS: Record<BoardSort, string> = {
  default: "Sorting",
  title: "Title A–Z",
  due: "Due date",
};

export function BoardPageContent({
  workspaceId,
  tasks,
  categories,
  currentUserId,
}: {
  workspaceId: string;
  tasks: BoardTask[];
  categories: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [sortBy, setSortBy] = useState<BoardSort>("default");

  const filtersApplied = Boolean(categoryFilter || assigneeFilter || mineOnly);

  function cycleSort() {
    setSortBy((current) =>
      current === "default" ? "title" : current === "title" ? "due" : "default"
    );
  }

  function openCreateTask() {
    rememberTaskReturnPath(pathname);
    router.push(taskNewPath(workspaceId));
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
          onAddTaskClick={openCreateTask}
        />
      </WorkspaceToolbarPortal>

      <Suspense fallback={<BoardContentSkeleton />}>
        <TaskBoard
          workspaceId={workspaceId}
          tasks={tasks}
          categories={categories}
          currentUserId={currentUserId}
          filtersOpen={filtersOpen}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          mineOnly={mineOnly}
          onMineOnlyChange={setMineOnly}
          sortBy={sortBy}
        />
      </Suspense>
    </>
  );
}
