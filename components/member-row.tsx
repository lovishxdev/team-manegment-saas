"use client";

import { useState, useTransition } from "react";
import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/lib/actions/workspace";
import { Select } from "@/components/select";
import { Avatar } from "@/components/ui";
import { displayUser } from "@/lib/username";

type Role = "LEADER" | "SUB_LEADER" | "MEMBER";

const ROLES: Role[] = ["LEADER", "SUB_LEADER", "MEMBER"];

const ROLE_STYLES: Record<Role, string> = {
  LEADER: "bg-amber-400/15 text-amber-300",
  SUB_LEADER: "bg-sky-400/15 text-sky-300",
  MEMBER: "bg-white/[0.06] text-ink-soft",
};

export function MemberRow({
  workspaceId,
  member,
  canManage,
  isSelf,
}: {
  workspaceId: string;
  member: {
    userId: string;
    email: string | null;
    username: string | null;
    role: Role;
    joinedAt: string;
  };
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

  const displayName = displayUser(member);

  function remove() {
    if (!window.confirm(`Remove ${displayName} from the workspace?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(workspaceId, member.userId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            seed={member.userId}
            label={displayName}
            size="h-8 w-8 text-xs"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {displayName}
              {isSelf && (
                <span className="ml-1.5 text-xs font-normal text-ink-faint">
                  (you)
                </span>
              )}
            </p>
            <p className="truncate font-mono text-[11px] text-ink-faint">
              {member.email ? `${member.email} · ` : ""}
              Joined {new Date(member.joinedAt).toLocaleDateString("en-GB")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage && !isSelf ? (
            <>
              <Select
                size="sm"
                value={member.role}
                disabled={pending}
                onChange={(value) => changeRole(value as Role)}
                options={ROLES.map((r) => ({
                  value: r,
                  label: r.replace("_", " "),
                }))}
                className="w-[128px]"
                aria-label="Member role"
              />
              <button
                onClick={remove}
                disabled={pending}
                className="rounded-md border border-line-strong px-2.5 py-1 text-xs text-ink-soft transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-60"
              >
                Remove
              </button>
            </>
          ) : (
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_STYLES[member.role]}`}
            >
              {member.role.replace("_", " ")}
            </span>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
