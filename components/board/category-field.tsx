"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { ui } from "@/components/ui/ui";

export type CategoryOption = {
  id: string;
  name: string;
};

/** Matches Select `md` trigger height (42px) for inline task-form controls. */
const rowControlH = "h-[42px]";

const rowIconBtn =
  `inline-flex ${rowControlH} w-[42px] shrink-0 items-center justify-center rounded-lg border border-line-strong bg-paper text-sm font-medium text-ink-soft transition-colors hover:border-ink/20 hover:text-ink`;

const rowTextBtn =
  `inline-flex ${rowControlH} shrink-0 items-center justify-center rounded-lg border border-line-strong bg-paper px-3 text-xs font-medium text-ink-soft transition-colors hover:border-ink/20 hover:text-ink`;

export const categoryRowPrimaryBtn =
  `inline-flex ${rowControlH} shrink-0 items-center justify-center rounded-lg bg-ink px-4 text-xs font-medium text-white transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60 min-w-[4.25rem]`;

export function CategoryField({
  categories,
  value,
  onChange,
  onNewCategoryChange,
  name = "categoryId",
  allowCreate = true,
  className = "",
  size = "md",
  "aria-label": ariaLabel = "Task category",
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (categoryId: string) => void;
  onNewCategoryChange?: (name: string) => void;
  name?: string;
  allowCreate?: boolean;
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  function cancelCreate() {
    setCreating(false);
    setNewCategory("");
    onNewCategoryChange?.("");
  }

  function updateNewCategory(next: string) {
    setNewCategory(next);
    onNewCategoryChange?.(next);
  }

  const options = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  if (creating) {
    return (
      <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
        <input type="hidden" name={name} value="" />
        <input
          name="newCategory"
          value={newCategory}
          onChange={(e) => updateNewCategory(e.target.value)}
          placeholder="New category"
          className={`${ui.input} ${rowControlH} min-w-0 flex-1 py-0 text-sm`}
          aria-label="New category name"
          autoFocus
        />
        <button type="button" onClick={cancelCreate} className={rowTextBtn}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <Select
        name={name}
        value={value}
        onChange={onChange}
        options={options}
        size={size}
        className="min-w-0 flex-1"
        aria-label={ariaLabel}
      />
      {allowCreate ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={rowIconBtn}
          title="Add custom category"
        >
          +
        </button>
      ) : null}
    </div>
  );
}
