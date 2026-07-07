import type { BoardTask } from "@/components/board/task-board";
import { displayUser } from "@/lib/username";

type TaskRow = {
  id: string;
  shortId: number;
  title: string;
  description: string | null;
  status: BoardTask["status"];
  categoryId: string;
  priority: BoardTask["priority"];
  dueDate: Date | null;
  tags: string[];
  category: { id: string; name: string };
  assignees: { user: { id: string; email: string | null; username: string } }[];
  attachments?: { id: string; url: string; fileType: string }[];
  _count?: { updates: number };
};

export function mapRowToBoardTask(task: TaskRow): BoardTask {
  return {
    id: task.id,
    shortId: task.shortId,
    title: task.title,
    description: task.description,
    status: task.status,
    categoryId: task.category.id,
    categoryName: task.category.name,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    tags: task.tags,
    assignees: task.assignees.map((a) => ({
      id: a.user.id,
      label: displayUser(a.user),
    })),
    attachments: task.attachments ?? [],
    updateCount: task._count?.updates ?? 0,
  };
}
