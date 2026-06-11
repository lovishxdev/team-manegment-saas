"use client";

import { useState, useTransition } from "react";
import {
  deleteTaskAction,
  updateTaskAction,
  type TaskEdit,
} from "@/lib/actions/workspace";
import type { BoardMember, BoardTask } from "@/components/task-board";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const SCOPES = ["GENERAL", "FRONTEND", "BACKEND", "DESIGN"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500";
const labelCls = "mb-1 block text-xs font-medium text-zinc-400";

export function TaskDetailModal({
  workspaceId,
  task,
  members,
  onClose,
}: {
  workspaceId: string;
  task: BoardTask;
  members: BoardMember[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status);
  const [scope, setScope] = useState(task.scope);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(
    task.dueDate ? task.dueDate.slice(0, 10) : ""
  );
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");

  function save() {
    if (!title.trim()) {
      setError("Title can't be empty");
      return;
    }
    setError(null);
    const edit: TaskEdit = {
      title,
      description: description || null,
      status,
      scope,
      priority,
      dueDate: dueDate || null,
      assignee: assigneeId || null,
    };
    startTransition(async () => {
      const result = await updateTaskAction(workspaceId, task.id, edit);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  function remove() {
    if (!window.confirm(`Delete task #${task.shortId} "${task.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteTaskAction(workspaceId, task.id);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-sm font-medium text-zinc-400">
            Task <span className="text-zinc-200">#{task.shortId}</span>
          </h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 text-lg leading-none text-zinc-500 hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add details..."
              className={`${inputCls} resize-y`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BoardTask["status"])}
                className={inputCls}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as BoardTask["scope"])}
                className={inputCls}
              >
                {SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as BoardTask["priority"])
                }
                className={inputCls}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className={inputCls}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email ?? m.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="mt-1 flex items-center justify-between">
            <button
              onClick={remove}
              disabled={pending}
              className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm text-zinc-400 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-60"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={pending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {pending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
