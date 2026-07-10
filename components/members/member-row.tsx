"use client";

import { useState, useTransition } from "react";
import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/lib/actions/workspace";
import { Select } from "@/components/ui/select";
import { Avatar, ui } from "@/components/ui/ui";
import { displayUser } from "@/lib/username";

type Role = "LEADER" | "SUB_LEADER" | "MEMBER" | "GUEST";

/** Roles selectable in the management dropdown (guests aren't promoted here). */
const ROLES: Role[] = ["LEADER", "SUB_LEADER", "MEMBER"];

const ROLE_LABELS: Record<Role, string> = {
  LEADER: "Leader",
  SUB_LEADER: "Sub leader",
  MEMBER: "Member",
  GUEST: "Guest",
};

const ROLE_STYLES: Record<Role, string> = {
  LEADER: "bg-amber-50 text-amber-800",
  SUB_LEADER: "bg-sky-50 text-sky-700",
  MEMBER: "bg-paper-deep text-ink-soft",
  GUEST: "bg-paper-deep text-ink-faint ring-1 ring-line",
};

const settingsRowCls =
  "rounded-xl border border-line bg-card px-4 py-3.5 shadow-[0_1px_3px_rgba(26,26,26,0.04)]";

const actionBtnCls = "min-h-[46px] px-3.5";

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
    <div className={`flex flex-col gap-2 ${settingsRowCls}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            seed={member.userId}
            label={displayName}
            size="h-9 w-9 text-xs"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-ink">
              {displayName}
              {isSelf ? (
                <span className="ml-1.5 text-sm font-normal text-ink-faint">
                  (you)
                </span>
              ) : null}
            </p>
            <p className="truncate text-sm text-ink-faint">
              {member.email ? `${member.email} · ` : ""}
              Joined {new Date(member.joinedAt).toLocaleDateString("en-GB")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {member.role === "GUEST" ? (
            <>
              <span
                className={`inline-flex min-h-[46px] items-center rounded-lg px-3 text-xs font-semibold uppercase tracking-wide ${ROLE_STYLES.GUEST}`}
              >
                Guest
              </span>
              {canManage && !isSelf ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className={`${ui.btnGhostDanger} ${actionBtnCls}`}
                >
                  Remove
                </button>
              ) : null}
            </>
          ) : canManage && !isSelf ? (
            <>
              <Select
                size="md"
                value={member.role}
                disabled={pending}
                onChange={(value) => changeRole(value as Role)}
                options={ROLES.map((role) => ({
                  value: role,
                  label: ROLE_LABELS[role],
                }))}
                className="w-[9.5rem]"
                aria-label="Member role"
              />
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className={`${ui.btnGhostDanger} ${actionBtnCls}`}
              >
                Remove
              </button>
            </>
          ) : (
            <span
              className={`inline-flex min-h-[46px] items-center rounded-lg px-3 text-xs font-semibold uppercase tracking-wide ${ROLE_STYLES[member.role]}`}
            >
              {ROLE_LABELS[member.role]}
            </span>
          )}
        </div>
      </div>

      {error ? <p className={ui.errorText}>{error}</p> : null}
    </div>
  );
}
