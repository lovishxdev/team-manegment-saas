"use client";

import { useActionState } from "react";
import { updateMcpScopeAction, type SettingsState } from "@/lib/actions/settings";
import { ui } from "@/components/ui/ui";

const initialState: SettingsState = {};

const OPTIONS = [
  {
    value: "context",
    title: "Context (recommended for coding agents)",
    description:
      "Read the board, use project memory (recall decisions, blockers), post task updates. No deletes or member management.",
  },
  {
    value: "full",
    title: "Full",
    description:
      "Everything — create/delete tasks, manage members, workspaces, files. For chat-style management (e.g. Claude app).",
  },
] as const;

export function McpScopeForm({ currentScope }: { currentScope: string }) {
  const [state, formAction, pending] = useActionState(
    updateMcpScopeAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-4 py-3 text-sm transition-colors hover:bg-paper-deep/40"
          >
            <input
              type="radio"
              name="scope"
              value={opt.value}
              defaultChecked={currentScope === opt.value}
              disabled={pending}
              className="mt-0.5 accent-ink"
            />
            <span>
              <span className="block font-medium text-ink">{opt.title}</span>
              <span className="mt-0.5 block text-xs text-ink-faint">
                {opt.description}
              </span>
            </span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`${ui.btnPrimary} ${ui.btnShrink} self-start`}
      >
        Save
      </button>
      {state.error && <p className={ui.errorText}>{state.error}</p>}
      {state.message && <p className={ui.successText}>{state.message}</p>}
    </form>
  );
}
