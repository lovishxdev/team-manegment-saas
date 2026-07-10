"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { TaskLinkedDiscussions } from "@/components/discussion/task-linked-discussions";
import { TaskMemorySection } from "@/components/board/task-memory-section";
import { MarkdownEditor } from "@/components/markdown/markdown-editor";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Avatar, ui, tagColor } from "@/components/ui/ui";
import {
  SHELL_CONTENT_MAX,
} from "@/components/layout/app-shell-shared";
import {
  consumeTaskReturnPath,
  taskPath,
} from "@/lib/task-navigation";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

type TaskSection = "main" | "updates" | "memory";

const SECTION_IDS: Record<TaskSection, string> = {
  main: "task-section-main",
  updates: "task-section-updates",
  memory: "task-section-memory",
};

const NAV_ITEMS: {
  id: TaskSection;
  label: string;
}[] = [
  { id: "main", label: "Main" },
  { id: "updates", label: "Updates" },
  { id: "memory", label: "Memory" },
];

const labelCls = ui.label;
const inputCls = ui.input;
const titleInputCls = ui.inputLg;
const fieldPanelCls =
  "overflow-hidden rounded-xl border border-line bg-card shadow-[0_1px_3px_rgba(26,26,26,0.04)]";

function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type TaskPageBase = {
  workspaceId: string;
  workspaceName: string;
  categories: CategoryOption[];
  currentUserId: string;
};

type TaskPageCreateProps = TaskPageBase & {
  mode: "create";
  members?: BoardMember[];
  defaultCategoryId?: string;
  defaultStatus?: BoardTask["status"];
};

type TaskPageEditProps = TaskPageBase & {
  mode: "edit";
  task: BoardTask;
  members: BoardMember[];
  initialSection?: TaskSection;
};

export type TaskPageProps = TaskPageCreateProps | TaskPageEditProps;

function TaskPageNav({
  active,
  onSelect,
  showSecondary,
}: {
  active: TaskSection;
  onSelect: (section: TaskSection) => void;
  showSecondary: boolean;
}) {
  const tabs = showSecondary
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.id === "main");

  return (
    <nav
      className="sticky top-0 z-10 -mx-1 flex shrink-0 gap-x-0.5 overflow-x-auto border-b border-line bg-shell/95 px-1 backdrop-blur-sm"
      aria-label="Task sections"
    >
      {tabs.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`${ui.tabItem} !shrink-0 ${isActive ? ui.tabItemActive : ""}`}
            aria-current={isActive ? "true" : undefined}
          >
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
    <aside
      className={`${ui.contentPanel} flex w-full shrink-0 flex-col gap-5 !bg-card lg:mt-7 lg:pt-0 lg:sticky lg:top-24 lg:self-start`}
    >
      <div>
        <label className={`${labelCls} lg:hidden`}>Status</label>
        <Select
          size="lg"
          value={status}
          onChange={(v) => onStatusChange(v as BoardTask["status"])}
          options={STATUSES.map((s) => ({
            value: s,
            label: formatEnumLabel(s),
          }))}
          disabled={disabled}
          aria-label="Status"
        />
      </div>
      <div>
        <label className={labelCls}>Priority</label>
        <Select
          value={priority}
          onChange={(v) => onPriorityChange(v as BoardTask["priority"])}
          options={PRIORITIES.map((p) => ({
            value: p,
            label: formatEnumLabel(p),
          }))}
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
          addonLayout="stack"
        />
      </div>
      <div>
        <label className={labelCls}>Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => onDueDateChange(event.target.value)}
          disabled={disabled}
          className={`${inputCls} h-[46px] text-ink [color-scheme:light]`}
        />
      </div>
    </aside>
  );
}

export function TaskPage(props: TaskPageProps) {
  const { workspaceId, workspaceName, categories, mode } = props;
  const router = useRouter();
  const isCreate = mode === "create";
  const task = mode === "edit" ? props.task : null;

  const defaultCategoryId =
    props.mode === "create"
      ? props.defaultCategoryId ??
        categories.find((c) => c.name === "General")?.id ??
        categories[0]?.id ??
        ""
      : task!.categoryId;

  const [activeSection, setActiveSection] = useState<TaskSection>(
    mode === "edit" ? props.initialSection ?? "main" : "main"
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<BoardMember[]>(
    props.mode === "edit" ? props.members : props.members ?? []
  );

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<BoardTask["status"]>(
    task?.status ??
      (props.mode === "create" ? props.defaultStatus ?? "TODO" : "TODO")
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
  const scrollSpyPaused = useRef(false);
  const scrollToUpdatesOnReady = useRef(
    !isCreate && mode === "edit" && props.initialSection === "updates"
  );

  const goBack = useCallback(() => {
    router.push(consumeTaskReturnPath(workspaceId));
  }, [router, workspaceId]);

  const selectSection = useCallback((section: TaskSection) => {
    setActiveSection(section);
    if (section === "memory") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    scrollSpyPaused.current = true;
    const el = document.getElementById(SECTION_IDS[section]);
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    window.setTimeout(() => {
      scrollSpyPaused.current = false;
    }, 600);
  }, []);

  const initialSection =
    props.mode === "edit" ? props.initialSection : undefined;

  useEffect(() => {
    if (
      isCreate ||
      !initialSection ||
      initialSection === "main" ||
      initialSection === "updates"
    ) {
      return;
    }

    const id = window.setTimeout(() => {
      selectSection(initialSection);
    }, 0);

    return () => window.clearTimeout(id);
  }, [isCreate, initialSection, selectSection]);

  useEffect(() => {
    if (isCreate || activeSection === "memory") return;

    const sections: TaskSection[] = ["main", "updates"];
    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollSpyPaused.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const match = sections.find((s) => SECTION_IDS[s] === visible.target.id);
        if (match) setActiveSection(match);
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: [0, 0.2, 0.5, 0.8] }
    );

    for (const section of sections) {
      const el = document.getElementById(SECTION_IDS[section]);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [isCreate, activeSection]);

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
      pendingTag &&
      !tags.some((t) => t.toLowerCase() === pendingTag.toLowerCase())
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
      selectSection("main");
      return;
    }
    setError(null);
    const edit = buildEdit();

    startTransition(async () => {
      if (isCreate) {
        const result = await createTaskFromModalAction(workspaceId, edit);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.shortId != null) {
          router.push(taskPath(workspaceId, result.shortId));
          router.refresh();
        } else {
          goBack();
        }
        return;
      }

      const result = await updateTaskAction(workspaceId, task!.id, edit);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!task) return;
    if (!window.confirm(`Delete task #${task.shortId} "${task.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteTaskAction(workspaceId, task.id);
      if (result.error) setError(result.error);
      else goBack();
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
    else router.refresh();
  }

  const pageTitle = isCreate ? (
    "Create task"
  ) : (
    <>
      {title || task!.title}{" "}
      <span className="font-mono text-[0.82em] font-normal text-ink-faint">
        #{task!.shortId}
      </span>
    </>
  );

  return (
    <div className={`${SHELL_CONTENT_MAX} pb-28`}>
        <header className="mb-6">
          <button
            type="button"
            onClick={goBack}
            className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Back
          </button>

          <nav aria-label="Breadcrumb" className={ui.breadcrumbNav}>
            <Link href="/dashboard" className={ui.breadcrumbLink}>
              Workspaces
            </Link>
            <span>/</span>
            <Link
              href={`/w/${workspaceId}`}
              className={`${ui.breadcrumbLink} truncate normal-case`}
            >
              {workspaceName}
            </Link>
            <span>/</span>
            <span className={ui.breadcrumbCurrent}>
              {isCreate ? "New task" : `Task #${task!.shortId}`}
            </span>
          </nav>

          <h1 className={`mt-4 ${ui.workspaceTitle}`}>{pageTitle}</h1>
          {isCreate ? (
            <p className={ui.pageSubtitle}>
              Add details, assign teammates, and set metadata.
            </p>
          ) : null}
        </header>

        <div className="mb-4">
          <TaskPageNav
            active={activeSection}
            onSelect={selectSection}
            showSecondary={!isCreate}
          />
        </div>

        {activeSection === "memory" && !isCreate && task ? (
          <div className="py-4 sm:py-5">
            <TaskMemorySection
              workspaceId={workspaceId}
              taskId={task.id}
              taskShortId={task.shortId}
            />
          </div>
        ) : (
          <div className="mt-4">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-x-8">
              <section
                id={SECTION_IDS.main}
                className="scroll-mt-24 min-w-0 space-y-6"
              >
              <div>
                <label className={labelCls}>Title</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What needs to be done?"
                  className={titleInputCls}
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
                <div
                  className={`${fieldPanelCls} max-h-56 overflow-y-auto p-1.5`}
                >
                  {members.length === 0 ? (
                    <p className="px-2.5 py-3 text-sm text-ink-faint">
                      Loading members…
                    </p>
                  ) : (
                    members.map((member) => {
                      const checked = assigneeIds.includes(member.id);
                      return (
                        <Checkbox
                          key={member.id}
                          checked={checked}
                          onChange={() => {
                            setAssigneeIds((current) =>
                              checked
                                ? current.filter((id) => id !== member.id)
                                : [...current, member.id]
                            );
                          }}
                          label={
                            <span className="flex items-center gap-2.5">
                              <Avatar
                                seed={member.id}
                                label={member.label}
                                size="h-7 w-7 text-xs"
                              />
                              {member.label ?? member.id.slice(0, 8)}
                            </span>
                          }
                        />
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className={labelCls}>Tags</label>
                <div
                  className={`flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 shadow-[0_1px_3px_rgba(26,26,26,0.04)] transition ${ui.focusWithin}`}
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 rounded-md py-1 pl-2.5 pr-1 font-mono text-xs font-medium tracking-wide ${tagColor(tag)}`}
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
                      className="min-w-24 flex-1 bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-ink-faint"
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
              </section>

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

            {!isCreate && task ? (
              <section
                id={SECTION_IDS.updates}
                className="scroll-mt-24 mt-8 space-y-8"
              >
                <TaskUpdatesSection
                  workspaceId={workspaceId}
                  taskId={task.id}
                  taskShortId={task.shortId}
                  currentUserId={props.currentUserId}
                  members={members.map((member) => ({
                    id: member.id,
                    label: member.label ?? member.id.slice(0, 8),
                  }))}
                  onReady={() => {
                    if (!scrollToUpdatesOnReady.current) return;
                    scrollToUpdatesOnReady.current = false;
                    selectSection("updates");
                  }}
                />
                <TaskLinkedDiscussions
                  workspaceId={workspaceId}
                  taskId={task.id}
                  taskShortId={task.shortId}
                />
              </section>
            ) : null}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
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
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={goBack}
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
    </div>
  );
}
