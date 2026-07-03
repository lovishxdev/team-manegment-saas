"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createTaskAction, type ActionState } from "@/lib/actions/workspace";
import {
  CategoryField,
  categoryRowPrimaryBtn,
  type CategoryOption,
} from "@/components/board/category-field";
import { ui } from "@/components/ui/ui";

const initialState: ActionState = {};

export function NewTaskForm({
  workspaceId,
  categories,
}: {
  workspaceId: string;
  categories: CategoryOption[];
}) {
  const action = useMemo(
    () => createTaskAction.bind(null, workspaceId),
    [workspaceId]
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const defaultCategoryId =
    categories.find((c) => c.name === "General")?.id ?? categories[0]?.id ?? "";
  const [categoryId, setCategoryId] = useState(defaultCategoryId);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
      setCategoryId(defaultCategoryId);
    }
  }, [pending, state, defaultCategoryId]);

  return (
    <form ref={formRef} action={formAction} className={`${ui.inputRow} items-center`}>
      <div className={ui.inputRowField}>
        <input
          name="title"
          required
          disabled={pending}
          placeholder="Add a task..."
          className={ui.input}
        />
        {state.error && (
          <p className="mt-1 text-xs text-red-300">{state.error}</p>
        )}
      </div>
      <CategoryField
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        className="w-[min(100%,220px)] shrink-0"
      />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={categoryRowPrimaryBtn}
      >
        Add
      </button>
    </form>
  );
}
