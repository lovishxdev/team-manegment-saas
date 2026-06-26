"use client";

import { useState, useTransition } from "react";
import { updateAssetTagsAction } from "@/lib/actions/workspace";
import { tagColor, ui } from "@/components/ui/ui";

export function AssetTagEditor({
  workspaceId,
  assetId,
  initialTags,
}: {
  workspaceId: string;
  assetId: string;
  initialTags: string[];
}) {
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function persist(next: string[]) {
    setError(null);
    const previous = tags;
    setTags(next);
    startTransition(async () => {
      const result = await updateAssetTagsAction(workspaceId, assetId, next);
      if (result.error) {
        setTags(previous);
        setError(result.error);
      }
    });
  }

  function addTag() {
    const tag = tagInput.trim().replace(/,+$/, "");
    setTagInput("");
    if (!tag) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    persist([...tags, tag]);
  }

  function removeTag(tag: string) {
    persist(tags.filter((t) => t !== tag));
  }

  return (
    <div className="mt-2">
      <div
        className={`flex flex-wrap items-center gap-1 rounded-md border border-line bg-paper px-2 py-1.5 transition ${ui.focusWithin} ${pending ? "opacity-70" : ""}`}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-0.5 rounded py-0.5 pl-1.5 pr-1 font-mono text-[9px] font-medium tracking-wide ${tagColor(tag)}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={pending}
              className="rounded px-0.5 leading-none opacity-60 transition hover:opacity-100 disabled:opacity-40"
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
            } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
              removeTag(tags[tags.length - 1]);
            }
          }}
          onBlur={addTag}
          disabled={pending}
          placeholder={tags.length === 0 ? "Add tag…" : "Add…"}
          maxLength={24}
          className="min-w-14 flex-1 bg-transparent py-0.5 text-[11px] text-ink outline-none placeholder:text-ink-faint"
          aria-label="Asset tags"
        />
      </div>
      {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
    </div>
  );
}
