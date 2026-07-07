"use client";

import { useMemo, useState } from "react";
import type { AdminUserAnalytics, AdminUserUsage } from "@/lib/services/admin";
import { ui } from "@/components/ui/ui";

type SortKey =
  | "label"
  | "joinedAt"
  | "lastActiveAt"
  | "activity7d"
  | "workspaceCount"
  | "tasksCreated"
  | "taskUpdates"
  | "whatsappMessages"
  | "botActions";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return formatWhen(iso);
}

function compareUsers(a: AdminUserUsage, b: AdminUserUsage, key: SortKey): number {
  switch (key) {
    case "label":
      return (a.label ?? a.email ?? "").localeCompare(b.label ?? b.email ?? "");
    case "joinedAt":
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    case "lastActiveAt": {
      const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      return aTime - bTime;
    }
    case "activity7d":
      return a.activity7d - b.activity7d;
    case "workspaceCount":
      return a.workspaceCount - b.workspaceCount;
    case "tasksCreated":
      return a.tasksCreated - b.tasksCreated;
    case "taskUpdates":
      return a.taskUpdates - b.taskUpdates;
    case "whatsappMessages":
      return a.whatsappMessages - b.whatsappMessages;
    case "botActions":
      return a.botActions - b.botActions;
    default:
      return 0;
  }
}

function SortButton({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wide transition ${
        active ? "text-ink" : "text-ink-faint hover:text-ink-soft"
      }`}
    >
      {label}
      {active ? <span aria-hidden>{direction === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );
}

export function AdminUsersTable({ analytics }: { analytics: AdminUserAnalytics }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastActiveAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = analytics.users;

    if (q) {
      rows = rows.filter(
        (user) =>
          (user.label ?? "").toLowerCase().includes(q) ||
          (user.email ?? "").toLowerCase().includes(q) ||
          (user.phone ?? "").includes(q) ||
          user.id.toLowerCase().includes(q)
      );
    }

    return [...rows].sort((a, b) => {
      const result = compareUsers(a, b, sortKey);
      return sortDirection === "asc" ? result : -result;
    });
  }, [analytics.users, query, sortDirection, sortKey]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "label" ? "asc" : "desc");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ui.pageTitle}>Users</h1>
        <p className={ui.pageSubtitle}>
          Per-user usage across web and WhatsApp. Updated{" "}
          {formatWhen(analytics.generatedAt)}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total users", value: analytics.summary.totalUsers },
          { label: "Active (7d)", value: analytics.summary.active7d },
          { label: "Active (30d)", value: analytics.summary.active30d },
          { label: "WhatsApp", value: analytics.summary.whatsappUsers },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-line/70 bg-paper/90 px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="dashboard-panel">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={ui.mutedText}>
            <span className="font-medium text-ink">{filtered.length}</span> users
            shown
          </p>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, phone, id…"
            aria-label="Search users"
            className={`${ui.input} max-w-md text-sm`}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line/70 text-ink-faint">
                <th className="px-3 py-2 font-normal">
                  <SortButton
                    label="User"
                    sortKey="label"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-normal">
                  <SortButton
                    label="Last active"
                    sortKey="lastActiveAt"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-normal">
                  <SortButton
                    label="7d actions"
                    sortKey="activity7d"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-normal">
                  <SortButton
                    label="Workspaces"
                    sortKey="workspaceCount"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-normal">
                  <SortButton
                    label="Tasks"
                    sortKey="tasksCreated"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-normal">
                  <SortButton
                    label="Updates"
                    sortKey="taskUpdates"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-normal">
                  <SortButton
                    label="WhatsApp"
                    sortKey="whatsappMessages"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-normal">
                  <SortButton
                    label="Bot actions"
                    sortKey="botActions"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-normal">
                  <SortButton
                    label="Joined"
                    sortKey="joinedAt"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-ink-soft">
                    No users match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-line/50 last:border-0 hover:bg-paper-deep/40"
                  >
                    <td className="px-3 py-3 align-top">
                      <div className="min-w-[12rem]">
                        <p className="font-medium text-ink">
                          {user.label ?? "—"}
                        </p>
                        <p className="truncate text-xs text-ink-faint">
                          {user.email ?? user.id}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {user.whatsappConnected ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              WhatsApp
                            </span>
                          ) : null}
                          {user.activity7d === 0 ? (
                            <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-medium text-ink-faint">
                              Idle 7d
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top whitespace-nowrap text-ink-soft">
                      <span title={formatWhen(user.lastActiveAt)}>
                        {formatRelative(user.lastActiveAt)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top tabular-nums text-ink">
                      {user.activity7d}
                    </td>
                    <td className="px-3 py-3 align-top tabular-nums text-ink-soft">
                      {user.workspaceCount}
                    </td>
                    <td className="px-3 py-3 align-top tabular-nums text-ink-soft">
                      {user.tasksCreated}
                    </td>
                    <td className="px-3 py-3 align-top tabular-nums text-ink-soft">
                      {user.taskUpdates}
                    </td>
                    <td className="px-3 py-3 align-top tabular-nums text-ink-soft">
                      {user.whatsappMessages}
                    </td>
                    <td className="px-3 py-3 align-top tabular-nums text-ink-soft">
                      {user.botActions}
                    </td>
                    <td className="px-3 py-3 align-top whitespace-nowrap text-xs text-ink-faint">
                      {formatWhen(user.joinedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          7d actions = tasks created + updates + assets + links + WhatsApp
          messages + bot actions in the last 7 days. Last active uses the latest
          task, update, asset upload, or WhatsApp message.
        </p>
      </div>
    </div>
  );
}
