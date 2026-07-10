"use client";

import { useState, useTransition } from "react";
import { setWorkspacePlanAction } from "@/lib/actions/admin";
import type { AdminWorkspacePlan } from "@/lib/services/admin";
import type { PlanTier } from "@/lib/generated/prisma/client";

const TIERS: PlanTier[] = ["HOBBY", "TEAM", "BUSINESS"];

const tierBadge: Record<PlanTier, string> = {
  HOBBY: "bg-paper-deep text-ink-soft ring-1 ring-line",
  TEAM: "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/20",
  BUSINESS: "bg-ink text-white dark:text-on-accent",
};

function PlanRow({ workspace }: { workspace: AdminWorkspacePlan }) {
  const [tier, setTier] = useState<PlanTier>(workspace.planTier);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: PlanTier) {
    const previous = tier;
    setTier(next);
    setError(null);
    startTransition(async () => {
      const result = await setWorkspacePlanAction(workspace.id, next);
      if (result.error) {
        setTier(previous);
        setError(result.error);
      }
    });
  }

  return (
    <tr className="border-b border-line/60">
      <td className="px-3 py-2.5">
        <div className="font-medium text-ink">{workspace.name}</div>
        <div className="font-mono text-[11px] text-ink-faint">{workspace.id}</div>
        {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
      </td>
      <td className="px-3 py-2.5 text-center text-sm text-ink-soft">
        {workspace.memberCount}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tierBadge[tier]}`}
        >
          {tier}
        </span>
        <span className="ml-2 text-[11px] text-ink-faint">
          ({workspace.planSource})
        </span>
      </td>
      <td className="px-3 py-2.5">
        <select
          value={tier}
          disabled={pending}
          onChange={(event) => change(event.target.value as PlanTier)}
          className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
        >
          {TIERS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export function AdminWorkspacePlans({
  workspaces,
}: {
  workspaces: AdminWorkspacePlan[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? workspaces.filter(
        (w) =>
          w.name.toLowerCase().includes(needle) || w.id.includes(needle)
      )
    : workspaces;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">Workspace plans</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Set a workspace&apos;s billing tier. Changes are marked as{" "}
          <code>admin</code> and take effect immediately (stub billing).
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or id…"
        className="mb-4 w-full max-w-sm rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-ink/30"
      />

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-deep/50 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Workspace</th>
              <th className="px-3 py-2 text-center font-medium">Members</th>
              <th className="px-3 py-2 font-medium">Current</th>
              <th className="px-3 py-2 font-medium">Set tier</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((workspace) => (
              <PlanRow key={workspace.id} workspace={workspace} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
