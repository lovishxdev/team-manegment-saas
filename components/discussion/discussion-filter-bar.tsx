"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { PostKind } from "@/lib/generated/prisma/client";
import type { DiscussionTagView } from "@/lib/actions/discussion";
import type { PostFeedView } from "@/lib/actions/discussion";
import { POST_KIND_LABELS, POST_KINDS } from "@/lib/post-kind";
import { ui } from "@/components/ui/ui";

const fieldPanelCls =
  "overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_3px_rgba(26,26,26,0.04)]";

/** Matches task board / form segmented controls — not the old rounded-full chips. */
export function discussionFilterPillCls(selected: boolean) {
  return `rounded-md border px-3 py-1.5 text-xs transition ${
    selected
      ? "border-ink/30 bg-ink/[0.06] font-medium text-ink"
      : "border-line bg-card text-ink-soft hover:border-line-strong hover:text-ink"
  }`;
}

const addTagRowBtn =
  "inline-flex h-[38px] shrink-0 items-center justify-center rounded-lg border border-line-strong bg-white px-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink/20 hover:bg-paper hover:text-ink";
const addTagPrimaryBtn =
  "inline-flex h-[38px] shrink-0 items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60 min-w-[4.25rem]";

export type DiscussionFilter =
  | { type: "ALL" }
  | { type: "KIND"; kind: PostKind }
  | { type: "TAG"; slug: string };

export function filterDiscussionPosts(
  posts: PostFeedView[],
  filter: DiscussionFilter
): PostFeedView[] {
  if (filter.type === "ALL") return posts;
  if (filter.type === "KIND") {
    return posts.filter((post) => post.kind === filter.kind);
  }
  return posts.filter((post) => post.tags.includes(filter.slug));
}

export function filterEmptyLabel(filter: DiscussionFilter): string {
  if (filter.type === "KIND") {
    return `No ${POST_KIND_LABELS[filter.kind].toLowerCase()}s yet`;
  }
  if (filter.type === "TAG") {
    return "No discussions with this tag";
  }
  return "No discussions yet";
}

function filtersEqual(a: DiscussionFilter, b: DiscussionFilter): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "KIND" && b.type === "KIND") return a.kind === b.kind;
  if (a.type === "TAG" && b.type === "TAG") return a.slug === b.slug;
  return true;
}

export function DiscussionFilterBar({
  active,
  customTags,
  onChange,
  onAddTag,
  adding,
}: {
  active: DiscussionFilter;
  customTags: DiscussionTagView[];
  onChange: (filter: DiscussionFilter) => void;
  onAddTag: (name: string) => Promise<boolean>;
  adding?: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAdd) inputRef.current?.focus();
  }, [showAdd]);

  function isActiveKind(kind: PostKind) {
    return active.type === "KIND" && active.kind === kind;
  }

  function isActiveTag(slug: string) {
    return active.type === "TAG" && active.slug === slug;
  }

  async function submitTag() {
    const name = draft.trim();
    if (!name || adding) return;
    const ok = await onAddTag(name);
    if (!ok) return;
    setDraft("");
    setShowAdd(false);
  }

  function selectFilter(next: DiscussionFilter) {
    if (filtersEqual(active, next)) return;
    onChange(next);
  }

  return (
    <div className={`${fieldPanelCls} space-y-4 px-4 py-4 sm:px-5`}>
      <div>
        <span className={ui.label}>Type</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectFilter({ type: "ALL" })}
            className={discussionFilterPillCls(active.type === "ALL")}
          >
            All
          </button>
          {POST_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => selectFilter({ type: "KIND", kind })}
              className={discussionFilterPillCls(isActiveKind(kind))}
            >
              {POST_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={ui.label}>Tags</span>
        <div className="flex flex-wrap items-center gap-2">
          {customTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => selectFilter({ type: "TAG", slug: tag.slug })}
              className={discussionFilterPillCls(isActiveTag(tag.slug))}
            >
              {tag.name}
            </button>
          ))}
          {showAdd ? (
            <form
              className="flex min-w-0 flex-1 basis-full items-center gap-1.5 sm:basis-auto"
              onSubmit={(event) => {
                event.preventDefault();
                void submitTag();
              }}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowAdd(false);
                    setDraft("");
                  }
                }}
                placeholder="New tag"
                maxLength={24}
                className={`${ui.input} h-[38px] min-w-0 flex-1 py-0 text-sm sm:max-w-[10rem]`}
              />
              <button
                type="submit"
                disabled={adding || !draft.trim()}
                className={addTagPrimaryBtn}
              >
                {adding ? "…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setDraft("");
                }}
                className={addTagRowBtn}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              title="Add a workspace tag"
              className="inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              New tag
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
