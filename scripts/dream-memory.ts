import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { runDreamCycle } from "@/lib/memory/dream";

/**
 * Manual dream-cycle run (the scheduled path is /api/cron/memory-dream).
 *
 *   npm run dream:memory -- --workspace-name Euclis
 *   npm run dream:memory -- --workspace-id <uuid> --force
 *   npm run dream:memory -- --all
 */

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const force = process.argv.includes("--force");
  const all = process.argv.includes("--all");
  const workspaceId = arg("--workspace-id");
  const workspaceName = arg("--workspace-name");

  let targets: { id: string; name: string }[] = [];
  if (all) {
    targets = await prisma.workspace.findMany({
      select: { id: true, name: true },
    });
  } else if (workspaceId) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    if (!ws) throw new Error(`No workspace with id ${workspaceId}`);
    targets = [ws];
  } else if (workspaceName) {
    const ws = await prisma.workspace.findFirst({
      where: { name: { equals: workspaceName, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!ws) throw new Error(`No workspace named "${workspaceName}"`);
    targets = [ws];
  } else {
    console.log(
      "Usage: npm run dream:memory -- --workspace-name <name> | --workspace-id <uuid> | --all [--force]"
    );
    return;
  }

  for (const ws of targets) {
    console.log(`\nDreaming "${ws.name}" (${ws.id})...`);
    const report = await runDreamCycle({ workspaceId: ws.id, force });
    if (report.skipped) {
      console.log(`  skipped: ${report.skipped}`);
      continue;
    }
    console.log(
      `  reviewed ${report.reviewed} events → merged ${report.merged}, ` +
        `superseded ${report.superseded}, insights ${report.insights}, ` +
        `archived ${report.archived}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
