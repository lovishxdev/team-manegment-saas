"use client";

import { useRef, useState, useTransition } from "react";
import {
  deleteTaskAction,
  updateTaskAction,
  uploadAssetAction,
  type TaskEdit,
} from "@/lib/actions/workspace";
import type { BoardMember, BoardTask } from "@/components/task-board";
import { Select } from "@/components/select";
import { ui, tagColor } from "@/components/ui";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const SCOPES = ["GENERAL", "FRONTEND", "BACKEND", "DESIGN"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const inputCls = ui.input;
const labelCls = ui.label;

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
  const [tags, setTags] = useState<string[]>(task.tags);
  const [tagInput, setTagInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function addTag() {
    const tag = tagInput.trim().replace(/,+$/, "");
    setTagInput("");
    if (!tag) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    setTags([...tags, tag]);
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function attachFile(file: File) {
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("taskId", task.id);
    const result = await uploadAssetAction(workspaceId, {}, formData);
    setUploading(false);
    if (result.error) setError(result.error);
    // New attachment arrives via revalidation; close so the fresh data shows.
    else onClose();
  }

  function save() {
    if (!title.trim()) {
      setError("Title can't be empty");
      return;
    }
    setError(null);
    // Fold in a tag the user typed but never committed with Enter.
    const pending = tagInput.trim().replace(/,+$/, "");
    const finalTags =
      pending && !tags.some((t) => t.toLowerCase() === pending.toLowerCase())
        ? [...tags, pending]
        : tags;
    const edit: TaskEdit = {
      title,
      description: description || null,
      status,
      scope,
      priority,
      dueDate: dueDate || null,
      tags: finalTags,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-line bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-base font-semibold text-ink">
            Task{" "}
            <span className="font-mono text-sm text-ink-faint">
              #{task.shortId}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 text-lg leading-none text-ink-faint hover:text-ink"
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
              <Select
                value={status}
                onChange={(v) => setStatus(v as BoardTask["status"])}
                options={STATUSES.map((s) => ({
                  value: s,
                  label: s.replace("_", " "),
                }))}
              />
            </div>
            <div>
              <label className={labelCls}>Scope</label>
              <Select
                value={scope}
                onChange={(v) => setScope(v as BoardTask["scope"])}
                options={SCOPES.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <Select
                value={priority}
                onChange={(v) => setPriority(v as BoardTask["priority"])}
                options={PRIORITIES.map((p) => ({ value: p, label: p }))}
              />
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
              <Select
                value={assigneeId}
                onChange={setAssigneeId}
                options={[
                  { value: "", label: "Unassigned" },
                  ...members.map((m) => ({
                    value: m.id,
                    label: m.label ?? m.id.slice(0, 8),
                  })),
                ]}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Tags</label>
            <div className={`flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-2 transition ${ui.focusWithin}`}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 rounded py-1 pl-2 pr-1 font-mono text-[10px] font-medium tracking-wide ${tagColor(tag)}`}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded px-0.5 leading-none opacity-60 transition hover:opacity-100"
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  } else if (
                    e.key === "Backspace" &&
                    !tagInput &&
                    tags.length > 0
                  ) {
                    removeTag(tags[tags.length - 1]);
                  }
                }}
                onBlur={addTag}
                placeholder={tags.length === 0 ? "Add a tag and press Enter" : "Add..."}
                maxLength={24}
                className="min-w-20 flex-1 bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Attachments ({task.attachments.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {task.attachments.map((att) =>
                att.fileType.startsWith("image/") ? (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-md border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.url}
                      alt="attachment"
                      className="h-16 w-16 object-cover transition hover:opacity-80"
                    />
                  </a>
                ) : (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-16 w-16 items-center justify-center rounded-md border border-line bg-paper-deep text-xl transition hover:border-line-strong"
                  >
                    📄
                  </a>
                )
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-line-strong text-lg text-ink-faint transition hover:border-ink/30 hover:text-ink disabled:opacity-60"
                title="Attach image or file"
              >
                {uploading ? "…" : "+"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) attachFile(file);
                }}
              />
            </div>
          </div>

          {error && <p className={ui.errorText}>{error}</p>}

          <div className="mt-1 flex items-center justify-between">
            <button
              onClick={remove}
              disabled={pending}
              className={ui.btnGhostDanger}
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className={ui.btnSecondary}>
                Cancel
              </button>
              <button
                onClick={save}
                disabled={pending}
                className={ui.btnPrimary}
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
