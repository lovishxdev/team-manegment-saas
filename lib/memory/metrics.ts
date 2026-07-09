import { prisma } from "@/lib/prisma";

/**
 * Fire-and-forget counters for the memory pipeline, read by the local admin
 * dashboard (/admin/memory). Answers "is the capture funnel healthy?" and
 * "how many tokens does a context pull actually serve?" without any
 * external analytics dependency. A failed bump must never break the
 * pipeline that emitted it.
 */

export type MemoryMetricName =
  /** Session judge invoked (sum = transcript chars sent). */
  | "judge_run"
  /** Event committed, by capture source. */
  | "event_created_agent"
  | "event_created_thread"
  | "event_created_post"
  | "event_created_explicit"
  /** Near-duplicate caught by the deterministic guard. */
  | "event_skipped_duplicate"
  /** Confirm-only resolution ask surfaced (WhatsApp or in-editor). */
  | "resolution_ask"
  /** Blocker/dependency actually resolved (always human-confirmed). */
  | "resolution_confirmed"
  /** recall_memory tool served (sum = response chars). */
  | "recall_query"
  /** get_project_context tool served (sum = response chars). */
  | "context_pull"
  /** Ambient brief built for hooks (sum = brief chars). */
  | "brief_built";

function utcDay(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export function bumpMemoryMetric(
  workspaceId: string,
  metric: MemoryMetricName,
  opts?: { count?: number; sum?: number }
): void {
  const count = opts?.count ?? 1;
  const sum = opts?.sum ?? 0;
  const day = utcDay();
  void prisma.memoryMetric
    .upsert({
      where: {
        day_workspaceId_metric: { day, workspaceId, metric },
      },
      update: { count: { increment: count }, sum: { increment: sum } },
      create: { day, workspaceId, metric, count, sum },
    })
    .catch((err) => {
      console.error(`[memory-metrics] bump ${metric} failed:`, err);
    });
}
