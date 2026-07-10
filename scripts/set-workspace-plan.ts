/**
 * Set a workspace's billing tier for manual entitlement testing.
 * (Interim tool — the real admin setter is a later step.)
 *
 * Usage:
 *   npm run set:plan -- --list
 *   npm run set:plan -- --workspace-name Euclis --tier TEAM
 *   npm run set:plan -- --workspace-id <uuid> --tier BUSINESS
 *   npm run set:plan -- --workspace-id <uuid> --tier HOBBY
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import type { PlanTier } from "../lib/generated/prisma/client";

const VALID_TIERS: PlanTier[] = ["HOBBY", "TEAM", "BUSINESS"];

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (process.argv.includes("--list")) {
    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        planTier: true,
        planSource: true,
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    for (const w of workspaces) {
      console.log(
        `${w.id}  ${w.planTier.padEnd(9)} members=${w._count.memberships}  (${w.planSource})  ${w.name}`
      );
    }
    return;
  }

  const tierArg = arg("--tier")?.toUpperCase();
  if (!tierArg || !VALID_TIERS.includes(tierArg as PlanTier)) {
    throw new Error(`--tier must be one of: ${VALID_TIERS.join(", ")}`);
  }
  const tier = tierArg as PlanTier;

  const workspaceId = arg("--workspace-id");
  const workspaceName = arg("--workspace-name");
  if (!workspaceId && !workspaceName) {
    throw new Error("Provide --workspace-id or --workspace-name (or --list).");
  }

  const workspace = workspaceId
    ? await prisma.workspace.findUnique({ where: { id: workspaceId } })
    : await prisma.workspace.findFirst({
        where: { name: { equals: workspaceName!, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
      });

  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const updated = await prisma.workspace.update({
    where: { id: workspace.id },
    data: { planTier: tier, planSource: "admin", planExpiresAt: null },
    select: { id: true, name: true, planTier: true },
  });

  console.log(
    `Set "${updated.name}" (${updated.id}) → ${updated.planTier}`
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
