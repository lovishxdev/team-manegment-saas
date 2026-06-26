import Link from "next/link";
import {
  MemberAvatarStack,
  type MemberAvatar,
} from "@/components/member-avatar-stack";
import type { WorkspaceDashboardStats } from "@/lib/services/workspace";

export function WorkspaceCard({
  id,
  name,
  role,
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

  return (
    <Link
      href={`/w/${id}`}
      className="group flex flex-col rounded-xl border border-line/80 bg-shell p-5 transition hover:border-line-strong hover:bg-paper-deep/40"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-paper text-base font-semibold text-ink shadow-sm">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="rounded-full bg-paper px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft shadow-sm">
          {role.replace("_", " ")}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-base font-semibold text-ink">
          {name}
        </h3>
        {openTasks > 0 ? (
          <span className="inline-flex shrink-0 items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
            {openTasks} open
          </span>
        ) : (
          <span className="shrink-0 text-xs text-ink-faint">All caught up</span>
        )}
      </div>

      {assignedToYou > 0 ? (
        <p className="mt-2">
          <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
            {assignedToYou} assigned to you
          </span>
        </p>
      ) : null}

      <div className="mt-auto flex items-center gap-2.5 pt-4">
        <MemberAvatarStack
          members={members}
          max={4}
          size="h-7 w-7 text-[10px]"
          ringClass="ring-shell"
          overlap={8}
        />
        <span className="text-xs text-ink-faint">
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}
