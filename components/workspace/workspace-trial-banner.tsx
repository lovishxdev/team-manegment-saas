import Link from "next/link";
import { getWorkspaceTrialStatus } from "@/lib/billing/entitlements";
import { ui } from "@/components/ui/ui";

/**
 * Slim in-app banner shown while a workspace is on a Team trial.
 * Emphasized (amber) when ≤ 3 days remain. Renders nothing otherwise.
 */
export async function WorkspaceTrialBanner({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const status = await getWorkspaceTrialStatus(workspaceId);
  if (!status.onTrial) return null;

  const dayLabel = `${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"}`;
  const emphasize = status.expiringSoon;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-[0_1px_3px_rgba(26,26,26,0.04)] ${
        emphasize ? "border-amber-300" : "border-line"
      }`}
    >
      <span className="flex items-center gap-2.5 text-ink-soft">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            emphasize ? "bg-amber-500" : "bg-ink/25"
          }`}
          aria-hidden
        />
        <span>
          <span className="font-medium text-ink">{dayLabel} left</span> in your
          Team trial.
          {emphasize ? " Upgrade to keep Team features." : ""}
        </span>
      </span>
      <Link href="/pricing" className={`${ui.btnSecondary} shrink-0`}>
        View plans →
      </Link>
    </div>
  );
}
