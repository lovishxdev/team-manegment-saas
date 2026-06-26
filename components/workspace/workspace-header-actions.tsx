"use client";

import { InviteButton } from "@/components/members/invite-button";
import {
  MemberAvatarStack,
  type MemberAvatar,
} from "@/components/members/member-avatar-stack";

export type { MemberAvatar as HeaderMember };

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M2 4.5h9M2 8h6M2 11.5h3" strokeLinecap="round" />
    </svg>
  );
}

const iconBtnCls =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-ink-soft shadow-sm transition hover:border-line-strong hover:text-ink";

export function WorkspaceHeaderActions({
  members,
  workspaceId,
  canInvite,
  showFilter,
  onFilterClick,
  filterActive,
}: {
  members: MemberAvatar[];
  workspaceId: string;
  canInvite: boolean;
  showFilter?: boolean;
  onFilterClick?: () => void;
  filterActive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {members.length > 0 && (
        <div className="pr-1">
          <MemberAvatarStack members={members} />
        </div>
      )}
      {canInvite && <InviteButton workspaceId={workspaceId} variant="pill" />}
      {showFilter && onFilterClick && (
        <button
          type="button"
          onClick={onFilterClick}
          aria-label="Toggle board filters"
          aria-pressed={filterActive}
          className={`${iconBtnCls} ${
            filterActive ? "border-ink/30 bg-ink/[0.04] text-ink" : ""
          }`}
        >
          <FilterIcon />
        </button>
      )}
    </div>
  );
}
