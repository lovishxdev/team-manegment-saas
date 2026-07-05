import { after } from "next/server";

/**
 * Fire-and-forget that survives serverless: `void promise` dies when Vercel
 * freezes the function after the response is sent, so background work
 * (memory capture, embedding indexing) silently never ran in production.
 * `after()` keeps the function alive until the task finishes.
 *
 * Falls back to a plain unawaited promise outside a request scope
 * (scripts, tests), where the process stays alive anyway.
 */
export function scheduleBackgroundTask(
  label: string,
  task: () => Promise<unknown>
): void {
  const run = () =>
    task().catch((err) => console.error(`[${label}] failed:`, err));

  try {
    after(run);
  } catch {
    void run();
  }
}
