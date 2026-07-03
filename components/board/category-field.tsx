"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { ui } from "@/components/ui/ui";

export type CategoryOption = {
  id: string;
  name: string;
};

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
          className={`${ui.input} min-w-0 flex-1`}
          aria-label="New category name"
          autoFocus
        />
        <button
          type="button"
          onClick={cancelCreate}
          className={`${ui.btnSecondary} shrink-0 px-2.5 py-2 text-xs`}
        >
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
          className={`${ui.btnSecondary} shrink-0 px-2.5 py-2 text-xs`}
          title="Add custom category"
        >
          +
        </button>
      ) : null}
    </div>
  );
}
