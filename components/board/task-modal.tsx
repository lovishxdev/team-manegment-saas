"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FileText, MessageSquare, Sparkles } from "lucide-react";
import {
  createTaskFromModalAction,
  deleteTaskAction,
  fetchWorkspaceMemberLabelsAction,
  updateTaskAction,
  uploadAssetAction,
  type TaskEdit,
} from "@/lib/actions/workspace";
import type { BoardMember, BoardTask } from "@/components/board/task-board";
import {
  CategoryField,
  type CategoryOption,
} from "@/components/board/category-field";
import { TaskUpdatesSection } from "@/components/board/task-updates-section";
import { TaskMemorySection } from "@/components/board/task-memory-section";
import { MarkdownEditor } from "@/components/markdown/markdown-editor";
import { AppModal } from "@/components/ui/app-modal";
import { Select } from "@/components/ui/select";
import { ui, tagColor } from "@/components/ui/ui";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

type TaskModalTab = "main" | "updates" | "memory";

const TAB_META: {
  id: TaskModalTab;
  label: string;
  icon: typeof FileText;
}[] = [
  { id: "main", label: "Main", icon: FileText },
  { id: "updates", label: "Updates", icon: MessageSquare },
  { id: "memory", label: "Memory", icon: Sparkles },
];

const labelCls = ui.label;
const inputCls = ui.input;

type TaskModalBase = {
  workspaceId: string;
  categories: CategoryOption[];
  onClose: () => void;
};

type TaskModalCreateProps = TaskModalBase & {
  mode: "create";
  members?: BoardMember[];
  defaultCategoryId?: string;
};

type TaskModalEditProps = TaskModalBase & {
  mode: "edit";
  task: BoardTask;
  members: BoardMember[];
};

export type TaskModalProps = TaskModalCreateProps | TaskModalEditProps;

function TaskModalTabs({
  active,
  onChange,
  showSecondary,
}: {
  active: TaskModalTab;
  onChange: (tab: TaskModalTab) => void;
  showSecondary: boolean;
}) {
  const tabs = showSecondary ? TAB_META : TAB_META.filter((t) => t.id === "main");

  return (
    <nav
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-4 py-2 sm:px-5"
      aria-label="Task sections"
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              isActive
                ? "bg-paper font-medium text-ink shadow-[0_1px_3px_rgba(26,26,26,0.06),0_0_0_1px_rgba(26,26,26,0.04)]"
                : "text-ink-soft hover:bg-paper/70 hover:text-ink"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function MetadataRail({
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  categoryId,
  onCategoryChange,
  onNewCategoryChange,
  categories,
  dueDate,
  onDueDateChange,
  disabled,
}: {
  status: BoardTask["status"];
  onStatusChange: (value: BoardTask["status"]) => void;
  priority: BoardTask["priority"];
  onPriorityChange: (value: BoardTask["priority"]) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  onNewCategoryChange: (value: string) => void;
  categories: CategoryOption[];
  dueDate: string;
  onDueDateChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-t border-line bg-paper-deep/20 p-4 sm:w-56 sm:border-l sm:border-t-0 lg:w-60">
      <div>
        <label className={labelCls}>Status</label>
        <Select
          value={status}
          onChange={(v) => onStatusChange(v as BoardTask["status"])}
          options={STATUSES.map((s) => ({
            value: s,
            label: s.replace("_", " "),
          }))}
          disabled={disabled}
        />
      </div>
      <div>
        <label className={labelCls}>Priority</label>
        <Select
          value={priority}
          onChange={(v) => onPriorityChange(v as BoardTask["priority"])}
          options={PRIORITIES.map((p) => ({ value: p, label: p }))}
          disabled={disabled}
        />
      </div>
      <div>
        <label className={labelCls}>Category</label>
        <CategoryField
          categories={categories}
          value={categoryId}
          onChange={onCategoryChange}
          onNewCategoryChange={onNewCategoryChange}
          allowCreate
        />
      </div>
      <div>
        <label className={labelCls}>Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => onDueDateChange(event.target.value)}
          disabled={disabled}
          className={inputCls}
        />
      </div>
    </aside>
  );
}

export function TaskModal(props: TaskModalProps) {
  const { workspaceId, categories, onClose, mode } = props;
  const isCreate = mode === "create";
  const task = mode === "edit" ? props.task : null;

  const defaultCategoryId =
    props.mode === "create"
      ? props.defaultCategoryId ??
        categories.find((c) => c.name === "General")?.id ??
        categories[0]?.id ??
        ""
      : task!.categoryId;

  const [tab, setTab] = useState<TaskModalTab>("main");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<BoardMember[]>(
    props.mode === "edit" ? props.members : props.members ?? []
  );

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<BoardTask["status"]>(
    task?.status ?? "TODO"
  );
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [newCategory, setNewCategory] = useState("");
  const [priority, setPriority] = useState<BoardTask["priority"]>(
    task?.priority ?? "MEDIUM"
  );
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 10) : ""
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assignees.map((a) => a.id) ?? []
  );
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (mode !== "create" || members.length > 0) return;
    let cancelled = false;
    fetchWorkspaceMemberLabelsAction(workspaceId).then((loaded) => {
      if (!cancelled) setMembers(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, mode, members.length]);

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

  function buildEdit(): TaskEdit & { title: string } {
    const pendingTag = tagInput.trim().replace(/,+$/, "");
    const finalTags =
      pendingTag && !tags.some((t) => t.toLowerCase() === pendingTag.toLowerCase())
        ? [...tags, pendingTag]
        : tags;

    return {
      title: title.trim(),
      description: description.trim() || null,
      status,
      categoryId,
      newCategory: newCategory.trim() || undefined,
      priority,
      dueDate: dueDate || null,
      tags: finalTags,
      assigneeIds,
    };
  }

  function save() {
    if (!title.trim()) {
      setError("Title can't be empty");
      return;
    }
    setError(null);
    const edit = buildEdit();

    startTransition(async () => {
      const result = isCreate
        ? await createTaskFromModalAction(workspaceId, edit)
        : await updateTaskAction(workspaceId, task!.id, edit);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  function remove() {
    if (!task) return;
    if (!window.confirm(`Delete task #${task.shortId} "${task.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteTaskAction(workspaceId, task.id);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  async function attachFile(file: File) {
    if (!task) return;
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("taskId", task.id);
    const result = await uploadAssetAction(workspaceId, {}, formData);
    setUploading(false);
    if (result.error) setError(result.error);
    else onClose();
  }

  const modalTitle = isCreate ? (
    "Create task"
  ) : (
    <>
      {title || task!.title}{" "}
      <span className="font-mono text-sm font-normal text-ink-faint">
        #{task!.shortId}
      </span>
    </>
  );

  const modalSubtitle = isCreate
    ? "Add details, assign teammates, and set metadata."
    : undefined;

  return (
    <AppModal
      size="xl"
      title={modalTitle}
      subtitle={modalSubtitle}
      labelledBy="task-modal-title"
      onClose={onClose}
      bodyClassName="min-h-0"
      footer={
        <div className="flex items-center justify-between gap-3">
          {!isCreate ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className={ui.btnGhostDanger}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className={ui.btnSecondary}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              aria-busy={pending}
              className={ui.btnPrimary}
            >
              {isCreate
                ? pending
                  ? "Creating…"
                  : "Create task"
                : pending
                  ? "Saving…"
                  : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <TaskModalTabs
        active={tab}
        onChange={setTab}
        showSecondary={!isCreate}
      />

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {tab === "main" ? (
              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelCls}>Title</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="What needs to be done?"
                    className={inputCls}
                    autoFocus={isCreate}
                  />
                </div>

                <div>
                  <label className={labelCls}>Description</label>
                  <MarkdownEditor
                    value={description}
                    onChange={setDescription}
                    disabled={pending}
                  />
                </div>

                <div>
                  <label className={labelCls}>Assignees</label>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-line bg-paper p-2.5">
                    {members.length === 0 ? (
                      <p className="text-xs text-ink-faint">Loading members…</p>
                    ) : (
                      members.map((member) => {
                        const checked = assigneeIds.includes(member.id);
                        return (
                          <label
                            key={member.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-ink-soft hover:bg-ink/[0.03]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setAssigneeIds((current) =>
                                  checked
                                    ? current.filter((id) => id !== member.id)
                                    : [...current, member.id]
                                );
                              }}
                              className="rounded border-line"
                            />
                            <span>{member.label ?? member.id.slice(0, 8)}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Tags</label>
                  <div
                    className={`flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-2 transition ${ui.focusWithin}`}
                  >
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
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          addTag();
                        } else if (
                          event.key === "Backspace" &&
                          !tagInput &&
                          tags.length > 0
                        ) {
                          removeTag(tags[tags.length - 1]);
                        }
                      }}
                      onBlur={addTag}
                      placeholder={
                        tags.length === 0 ? "Add a tag and press Enter" : "Add…"
                      }
                      maxLength={24}
                      className="min-w-20 flex-1 bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-ink-faint"
                    />
                  </div>
                </div>

                {!isCreate && task ? (
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
                        aria-busy={uploading}
                        className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-line-strong text-lg text-ink-faint transition-colors hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        title="Attach image or file"
                      >
                        +
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void attachFile(file);
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {error ? <p className={ui.errorText}>{error}</p> : null}
              </div>
            ) : null}

            {!isCreate && task && tab === "updates" ? (
              <div className="flex min-h-[16rem] flex-1 flex-col">
                <TaskUpdatesSection
                  workspaceId={workspaceId}
                  taskId={task.id}
                  taskShortId={task.shortId}
                />
              </div>
            ) : null}

            {!isCreate && task && tab === "memory" ? (
              <TaskMemorySection
                workspaceId={workspaceId}
                taskId={task.id}
                taskShortId={task.shortId}
              />
            ) : null}
          </div>
        </div>

        <MetadataRail
          status={status}
          onStatusChange={setStatus}
          priority={priority}
          onPriorityChange={setPriority}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          onNewCategoryChange={setNewCategory}
          categories={categories}
          dueDate={dueDate}
          onDueDateChange={setDueDate}
          disabled={pending}
        />
      </div>
    </AppModal>
  );
}
