"use client";

import { useState, useTransition } from "react";
import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/lib/actions/workspace";

type Role = "LEADER" | "SUB_LEADER" | "MEMBER";

const ROLES: Role[] = ["LEADER", "SUB_LEADER", "MEMBER"];

export function MemberRow({
  workspaceId,
  member,
  canManage,
  isSelf,
}: {
  workspaceId: string;
  member: { userId: string; email: string | null; role: Role; joinedAt: string };
  canManage: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeRole(role: Role) {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberRoleAction(
        workspaceId,
        member.userId,
        role
      );
      if (result.error) setError(result.error);
    });
  }

  function remove() {
    if (!window.confirm(`Remove ${member.email ?? "this member"} from the workspace?`))
      return;
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(workspaceId, member.userId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm">
            {member.email ?? member.userId.slice(0, 8)}
            {isSelf && <span className="ml-1.5 text-xs text-zinc-500">(you)</span>}
          </p>
          <p className="text-xs text-zinc-500">
            Joined {new Date(member.joinedAt).toLocaleDateString("en-GB")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage && !isSelf ? (
            <>
              <select
                value={member.role}
                disabled={pending}
                onChange={(e) => changeRole(e.target.value as Role)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none focus:border-indigo-500"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ")}
                  </option>
                ))}
              </select>
              <button
                onClick={remove}
                disabled={pending}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-60"
              >
                Remove
              </button>
            </>
          ) : (
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
              {member.role.replace("_", " ")}
            </span>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
