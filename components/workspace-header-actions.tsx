"use client";

import { Avatar } from "@/components/ui";
import { InviteButton } from "@/components/invite-button";

export type HeaderMember = {
  id: string;
  label: string | null;
};

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

function MemberAvatarStack({
  members,
  max = 4,
}: {
  members: HeaderMember[];
  max?: number;
}) {
  const shown = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <div className="flex items-center pr-1">
      {shown.map((member, index) => (
        <span
          key={member.id}
          className="relative rounded-full ring-2 ring-paper"
          style={{
            marginLeft: index === 0 ? 0 : -10,
            zIndex: shown.length - index,
          }}
        >
          <Avatar
            seed={member.id}
            label={member.label}
            size="h-9 w-9 text-xs"
          />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-medium text-ink-soft ring-2 ring-paper"
          style={{ marginLeft: shown.length > 0 ? -10 : 0, zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
    </div>
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
  members: HeaderMember[];
  workspaceId: string;
  canInvite: boolean;
  showFilter?: boolean;
  onFilterClick?: () => void;
  filterActive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {members.length > 0 && <MemberAvatarStack members={members} />}
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
