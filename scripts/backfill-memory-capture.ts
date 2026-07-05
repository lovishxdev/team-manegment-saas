/**
 * Backfill decision memory from existing TaskUpdate history.
 *
 * Runs the capture classifier over past updates in chronological order so a
 * project that adopts the memory layer late still gets its decisions and
 * blockers as structured records — with their original timestamps. Blockers
 * whose resolution is visible later in the thread are recorded RESOLVED
 * (no suggestion pings for months-old activity).
 *
 * Usage:
 *   npm run backfill:memory                  # all workspaces
 *   npm run backfill:memory <workspaceId>    # one workspace
 *
 * Requires ANTHROPIC_API_KEY. Re-running is safe: updates that already
 * produced a memory event are skipped, and the classifier is told about
 * existing events so it won't duplicate ones extracted from other updates.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { captureFromTaskUpdate, memoryCaptureEnabled } from "../lib/memory/capture";

const PAUSE_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!memoryCaptureEnabled()) {
    console.error("Set ANTHROPIC_API_KEY to run memory capture.");
    process.exit(1);
  }

  const workspaceId = process.argv[2]?.trim();
  const workspaces = workspaceId
    ? await prisma.workspace.findMany({
        where: { id: workspaceId },
        select: { id: true, name: true },
      })
    : await prisma.workspace.findMany({
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      });

  if (workspaces.length === 0) {
    console.log("No workspaces found.");
    return;
  }

  for (const ws of workspaces) {
    const updates = await prisma.taskUpdate.findMany({
      where: { workspaceId: ws.id },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    // Resumability: skip updates that already produced or resolved an event.
    const touched = await prisma.memoryEvent.findMany({
      where: { workspaceId: ws.id },
      select: { sourceUpdateId: true, resolvedByUpdateId: true },
    });
    const done = new Set(
      touched.flatMap((e) =>
        [e.sourceUpdateId, e.resolvedByUpdateId].filter(Boolean)
      )
    );

    const pending = updates.filter((u) => !done.has(u.id));
    console.log(
      `"${ws.name}": ${updates.length} updates, ${pending.length} to scan`
    );

    let scanned = 0;
    for (const update of pending) {
      try {
        await captureFromTaskUpdate(update.id, "backfill");
      } catch (err) {
        console.error(`  update ${update.id} failed:`, err);
      }
      scanned++;
      if (scanned % 25 === 0) {
        console.log(`  …${scanned}/${pending.length}`);
      }
      await sleep(PAUSE_MS);
    }

    const total = await prisma.memoryEvent.count({
      where: { workspaceId: ws.id },
    });
    console.log(`  done — ${total} memory events in "${ws.name}"`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
