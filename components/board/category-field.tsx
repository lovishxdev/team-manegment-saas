"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { ui } from "@/components/ui/ui";

export type CategoryOption = {
  id: string;
  name: string;
};

/** Matches Select `md` trigger height (46px) for inline task-form controls. */
const rowControlH = "h-[46px]";
const rowControlHLg = "h-[52px]";

const rowIconBtn =
  `inline-flex ${rowControlH} w-[46px] shrink-0 items-center justify-center rounded-lg border border-line-strong bg-paper text-base font-medium text-ink-soft transition-colors hover:border-ink/20 hover:bg-white dark:hover:bg-card-high hover:text-ink hover:shadow-sm`;

export const categoryRowPrimaryBtn =
  `inline-flex ${rowControlH} shrink-0 items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60 min-w-[4.25rem] dark:text-on-accent dark:hover:bg-accent-bright`;

export function CategoryField({
  categories,
  value,
  onChange,
  onNewCategoryChange,
  name = "categoryId",
  allowCreate = true,
  className = "",
  size = "md",
  addonLayout = "inline",
  "aria-label": ariaLabel = "Task category",
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (categoryId: string) => void;
  onNewCategoryChange?: (name: string) => void;
  name?: string;
  allowCreate?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  addonLayout?: "inline" | "stack";
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

  const controlH = size === "lg" ? rowControlHLg : rowControlH;
  const iconBtn = `inline-flex ${controlH} ${size === "lg" ? "w-[52px]" : "w-[46px]"} shrink-0 items-center justify-center rounded-lg border border-line-strong bg-card text-base font-medium text-ink-soft transition-colors hover:border-ink/20 hover:bg-paper hover:text-ink hover:shadow-sm`;
  const textBtn = `inline-flex ${controlH} shrink-0 items-center justify-center rounded-lg border border-line-strong bg-card px-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink/20 hover:bg-paper hover:text-ink`;
  const stackAddBtn =
    "inline-flex items-center gap-1 self-start text-sm text-ink-soft transition-colors hover:text-ink";

  if (creating) {
    return (
      <div
        className={`flex min-w-0 gap-1.5 ${
          addonLayout === "stack" ? "flex-col items-stretch" : "items-center"
        } ${className}`}
      >
        <input type="hidden" name={name} value="" />
        <input
          name="newCategory"
          value={newCategory}
          onChange={(e) => updateNewCategory(e.target.value)}
          placeholder="New category"
          className={`${ui.input} ${controlH} min-w-0 flex-1 py-0 ${size === "lg" ? "text-base" : "text-sm"}`}
          aria-label="New category name"
          autoFocus
        />
        <button type="button" onClick={cancelCreate} className={textBtn}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-0 gap-1.5 ${
        addonLayout === "stack" ? "flex-col items-stretch" : "items-center"
      } ${className}`}
    >
      <Select
        name={name}
        value={value}
        onChange={onChange}
        options={options}
        size={size}
        className="min-w-0 w-full"
        aria-label={ariaLabel}
      />
      {allowCreate ? (
        addonLayout === "stack" ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={stackAddBtn}
            title="Add custom category"
          >
            <span aria-hidden>+</span>
            New category
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={iconBtn}
            title="Add custom category"
          >
            +
          </button>
        )
      ) : null}
    </div>
  );
}
