import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  runDreamCycle,
  lastDreamAt,
  DREAM_COOLDOWN_DAYS,
  type DreamReport,
} from "@/lib/memory/dream";

/**
 * Scheduled entry point for the dream cycle (vercel.json cron, daily).
 * Each run dreams a handful of workspaces that (a) have recent activity,
 * (b) haven't dreamed within the cooldown — so the daily schedule works out
 * to roughly weekly per active workspace, spread across days.
 */

export const maxDuration = 300;

/** Keep a single cron invocation well under the function time limit. */
const MAX_WORKSPACES_PER_RUN = 5;
const ACTIVITY_WINDOW_DAYS = 7;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    return req.headers.get("authorization") === `Bearer ${secret}`;
  }
  // Without a configured secret only allow local development runs.
  return process.env.NODE_ENV !== "production";
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const activeSince = new Date(
    Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 3600 * 1000
  );
  const candidates = await prisma.workspace.findMany({
    where: {
      memoryEvents: { some: { createdAt: { gte: activeSince } } },
    },
    select: { id: true, name: true },
  });

  const cooldownMs = DREAM_COOLDOWN_DAYS * 24 * 3600 * 1000;
  const due: { id: string; name: string }[] = [];
  for (const ws of candidates) {
    const last = await lastDreamAt(ws.id);
    if (!last || Date.now() - last.getTime() >= cooldownMs) {
      due.push(ws);
      if (due.length >= MAX_WORKSPACES_PER_RUN) break;
    }
  }

  const reports: DreamReport[] = [];
  for (const ws of due) {
    try {
      const report = await runDreamCycle({ workspaceId: ws.id });
      reports.push(report);
      console.log(
        `[memory-dream] ${ws.name}: reviewed=${report.reviewed} merged=${report.merged} superseded=${report.superseded} insights=${report.insights} archived=${report.archived}${report.skipped ? ` skipped(${report.skipped})` : ""}`
      );
    } catch (err) {
      console.error(`[memory-dream] ${ws.name} failed:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    dreamed: reports.length,
    reports,
  });
}
