import Link from "next/link";
import { ChevronRight, GripVertical } from "lucide-react";
import {
  MemberAvatarStack,
  type MemberAvatar,
} from "@/components/members/member-avatar-stack";
import type { WorkspaceDashboardStats } from "@/lib/services/workspace";

function activityLabel(openTasks: number, assignedToYou: number): string | null {
  const parts: string[] = [];
  if (openTasks > 0) {
    parts.push(`${openTasks} open`);
  }
  if (assignedToYou > 0) {
    parts.push(`${assignedToYou} yours`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function WorkspaceCard({
  id,
  name,
  memberCount,
  members,
  stats,
}: {
  id: string;
  name: string;
  role: string;
  memberCount: number;
  members: MemberAvatar[];
  stats: WorkspaceDashboardStats;
}) {
  const { openTasks, assignedToYou } = stats;
  const activity = activityLabel(openTasks, assignedToYou);
  const showAvatars = memberCount > 1 && members.length > 0;

  return (
    <li>
      <Link
        href={`/w/${id}`}
        className="group flex items-center gap-3 rounded-lg border border-line/70 bg-paper px-3 py-3 transition hover:border-line-strong hover:bg-white dark:hover:bg-card-high hover:shadow-sm sm:px-4"
      >
        <GripVertical
          className="h-4 w-4 shrink-0 text-ink-faint/50"
          strokeWidth={1.75}
          aria-hidden
        />

        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
          {name}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {activity ? (
            <span className="truncate font-mono text-[11px] text-ink-soft max-w-[6.5rem] sm:max-w-none">
              {activity}
            </span>
          ) : null}

          {showAvatars ? (
            <MemberAvatarStack
              members={members}
              max={3}
              size="h-6 w-6 text-[9px]"
              ringClass="ring-paper"
              overlap={6}
            />
          ) : null}

          <ChevronRight
            className="h-4 w-4 shrink-0 text-ink-faint/70 transition group-hover:text-ink-soft"
            strokeWidth={1.75}
            aria-hidden
          />
        </span>
      </Link>
    </li>
  );
}
