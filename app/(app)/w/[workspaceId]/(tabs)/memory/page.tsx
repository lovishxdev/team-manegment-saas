import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError, getActorMembership } from "@/lib/services/project";
import { listMemoryEventsPaginated } from "@/lib/services/memory";
import type { MemoryEventView } from "@/lib/actions/workspace";
import { displayUser } from "@/lib/username";
import { MemoryEventCard } from "@/components/memory/memory-event-card";
import { MemoryPagination } from "@/components/memory/memory-pagination";
import { MemoryContentSkeleton } from "@/components/ui/tab-content-skeleton";
import { ui } from "@/components/ui/ui";
import {
  listMemoryDocuments,
} from "@/lib/memory/documents";
import {
  MemoryDocumentLibrary,
  type MemoryDocumentView,
} from "@/components/memory/memory-document-library";
import {
  getWorkspaceMemoryAnalytics,
  type WorkspaceMemoryAnalytics,
} from "@/lib/services/workspace-analytics";
import { WorkspaceMemoryInsights } from "@/components/workspace/workspace-memory-insights";
import {
  listArchivedMemoryEvents,
  listPendingMemoryCandidates,
} from "@/lib/services/memory-candidates";
import {
  MemoryCandidateReview,
  type MemoryCandidateViewModel,
} from "@/components/memory/memory-candidate-review";
import {
  ArchivedMemoryReview,
  type ArchivedMemoryView,
} from "@/components/memory/archived-memory-review";

const MEMORY_TIMELINE_PAGE_SIZE = 8;

function SeedChecklist({ workspaceId }: { workspaceId: string }) {
  return (
    <div className={`${ui.contentPanel} text-center`}>
      <p className="text-base font-medium text-ink">No project memory yet</p>
      <p className={`${ui.fieldHint} mx-auto mt-2 max-w-2xl`}>
        Project memory builds automatically as your team and connected coding
        agents work. Decisions, blockers, documents and important context will
        appear here when they become relevant.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/settings" className={`${ui.btnPrimary} text-sm`}>
          Connect coding agent
        </Link>
        <Link
          href={`/w/${workspaceId}/tasks/new`}
          className={`${ui.btnSecondary} text-sm`}
        >
          Create first task
        </Link>
      </div>
    </div>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${ui.contentPanel} border-dashed py-8 text-center text-sm text-ink-soft`}
    >
      {children}
    </div>
  );
}

function DisclosureSection({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-line bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 marker:hidden">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-paper-deep text-lg leading-none text-ink-soft transition-transform group-open:rotate-90">
          ›
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
            {description}
          </span>
        </span>
        {typeof count === "number" ? (
          <span className="shrink-0 rounded-full bg-paper-deep px-2.5 py-1 font-mono text-[10px] font-medium text-ink-soft">
            {count}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-line px-5 py-5">{children}</div>
    </details>
  );
}

async function MemoryData({
  workspaceId,
  page,
}: {
  workspaceId: string;
  page: number;
}) {
  const user = await requireUser();
  const membership = await getActorMembership(user.id, workspaceId);
  if (!membership) notFound();
  const canCurate =
    membership.role === "LEADER" || membership.role === "SUB_LEADER";

  let openEvents;
  let timelineEvents;
  let timelineTotal;
  let documents: MemoryDocumentView[] = [];
  let analytics: WorkspaceMemoryAnalytics | null = null;
  let showAnalyticsUpgrade = false;
  let pendingCandidates: MemoryCandidateViewModel[] = [];
  let archivedEvents: ArchivedMemoryView[] = [];
  try {
    const [
      openResult,
      timelineResult,
      documentRows,
      candidateRows,
      archivedRows,
    ] =
      await Promise.all([
      listMemoryEventsPaginated({
        workspaceId,
        userId: user.id,
        status: "OPEN",
        limit: 100,
      }),
      listMemoryEventsPaginated({
        workspaceId,
        userId: user.id,
        statusNot: "OPEN",
        limit: MEMORY_TIMELINE_PAGE_SIZE,
        offset: (page - 1) * MEMORY_TIMELINE_PAGE_SIZE,
      }),
      listMemoryDocuments({
        workspaceId,
        userId: user.id,
        limit: 100,
      }),
      canCurate
        ? listPendingMemoryCandidates({
            workspaceId,
            userId: user.id,
            limit: 20,
          })
        : Promise.resolve([]),
      canCurate
        ? listArchivedMemoryEvents({
            workspaceId,
            userId: user.id,
            limit: 20,
          })
        : Promise.resolve([]),
    ]);
    openEvents = openResult.events;
    timelineEvents = timelineResult.events;
    timelineTotal = timelineResult.total;
    documents = documentRows.map((document) => ({
      id: document.id,
      path: document.path,
      title: document.title,
      tags: document.tags,
      updatedAt: document.updatedAt.toISOString(),
      authorLabel: document.author ? displayUser(document.author) : null,
      eventCount: document.eventCount,
    }));
    pendingCandidates = candidateRows.map((candidate) => ({
      id: candidate.id,
      kind: candidate.kind,
      scope: candidate.scope,
      authority: candidate.authority,
      summary: candidate.summary,
      reasoning: candidate.reasoning,
      evidenceQuote: candidate.evidenceQuote,
      tags: candidate.tags,
      durabilityScore: candidate.durabilityScore,
      coordinationScore: candidate.coordinationScore,
      criticReason: candidate.criticReason,
      createdAt: candidate.createdAt.toISOString(),
      task: candidate.task,
      sourceDocument: candidate.sourceDocument,
    }));
    archivedEvents = archivedRows.map((event) => ({
      id: event.id,
      kind: event.kind,
      summary: event.summary,
      archiveReason: event.archiveReason,
      archivedAt: event.archivedAt?.toISOString() ?? null,
    }));
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  try {
    analytics = await getWorkspaceMemoryAnalytics(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError && err.code === "UPGRADE_REQUIRED") {
      showAnalyticsUpgrade = true;
    } else if (!(err instanceof ServiceError && err.code === "FORBIDDEN")) {
      throw err;
    }
  }

  const toView = (e: (typeof openEvents)[number]): MemoryEventView => ({
    id: e.id,
    kind: e.kind,
    status: e.status,
    summary: e.summary,
    reasoning: e.reasoning,
    tags: e.tags,
    createdAt: e.createdAt.toISOString(),
    resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
    authorLabel: e.author ? displayUser(e.author) : null,
    task: e.task,
    sourceDocumentPath: e.sourceDocumentPath,
    sourceDocument: e.sourceDocument
      ? {
          id: e.sourceDocument.id,
          path: e.sourceDocument.path,
          title: e.sourceDocument.title,
          tags: e.sourceDocument.tags,
          updatedAt: e.sourceDocument.updatedAt.toISOString(),
          currentVersion:
            e.sourceDocumentHash !== null &&
            e.sourceDocument.contentHash === e.sourceDocumentHash,
        }
      : null,
    reviewed: e.dreamedAt !== null,
  });

  const open = openEvents.map(toView);
  const timeline = timelineEvents.map(toView);
  const hasAnyMemory =
    open.length > 0 || timelineTotal > 0 || documents.length > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 max-w-3xl">
        <h2 className={ui.settingsSectionTitle}>Project memory</h2>
        <p className={ui.fieldHint}>
          The decisions and open work your team — and its agents — need now.
          Everything else stays available below when you need it.
        </p>
      </header>

      {hasAnyMemory ? (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Open blockers", open.length],
            ["Recorded events", timelineTotal],
            ["Sources", documents.length],
            ["Needs review", pendingCandidates.length],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-line bg-card px-4 py-3 shadow-sm"
            >
              <p className="text-xl font-semibold tabular-nums text-ink">
                {value}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!hasAnyMemory ? (
        <div className="mb-8">
          <SeedChecklist workspaceId={workspaceId} />
        </div>
      ) : null}

      {pendingCandidates.length > 0 ? (
        <section className="mb-8">
          <div className="mb-4">
            <h2 className={ui.settingsSectionTitle}>
              Needs your review{" "}
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                {pendingCandidates.length}
              </span>
            </h2>
            <p className={ui.fieldHint}>
              Confirm agent-inferred context before it becomes project memory.
            </p>
          </div>
          <MemoryCandidateReview candidates={pendingCandidates} />
        </section>
      ) : null}

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className={ui.settingsSectionTitle}>Open work</h2>
            <p className={ui.fieldHint}>
              Blockers and dependencies that still need attention.
            </p>
          </div>
          {open.length > 0 ? (
            <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 font-mono text-[10px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
              {open.length} open
            </span>
          ) : null}
        </div>
        {open.length === 0 ? (
          <EmptyPanel>Nothing is blocked right now.</EmptyPanel>
        ) : (
          <div className="flex flex-col gap-3">
            {open.slice(0, 6).map((event) => (
              <MemoryEventCard
                key={event.id}
                workspaceId={workspaceId}
                event={event}
                canCurate={canCurate}
              />
            ))}
            {open.length > 6 ? (
              <details className="group rounded-xl border border-line bg-card">
                <summary className="cursor-pointer list-none px-4 py-3 text-center text-sm font-medium text-ink-soft marker:hidden hover:text-ink">
                  Show {open.length - 6} more open items
                </summary>
                <div className="flex flex-col gap-3 border-t border-line p-3">
                  {open.slice(6).map((event) => (
                    <MemoryEventCard
                      key={event.id}
                      workspaceId={workspaceId}
                      event={event}
                      canCurate={canCurate}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-4">
          <h2 className={ui.settingsSectionTitle}>Recent memory</h2>
          <p className={ui.fieldHint}>
            Decisions, milestones and resolved work, newest first.
          </p>
        </div>
        {timelineTotal === 0 ? (
          <EmptyPanel>
            Decisions and milestones will appear here as they&apos;re captured.
          </EmptyPanel>
        ) : timeline.length === 0 ? (
          <EmptyPanel>
            No events on this page.{" "}
            <Link
              href={`/w/${workspaceId}/memory`}
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              Go to first page
            </Link>
            .
          </EmptyPanel>
        ) : (
          <div className="flex flex-col gap-3">
            {timeline.map((event) => (
              <MemoryEventCard
                key={event.id}
                workspaceId={workspaceId}
                event={event}
                canCurate={canCurate}
              />
            ))}
            <MemoryPagination
              workspaceId={workspaceId}
              page={page}
              pageSize={MEMORY_TIMELINE_PAGE_SIZE}
              total={timelineTotal}
            />
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3">
          <h2 className={ui.settingsSectionTitle}>More</h2>
          <p className={ui.fieldHint}>
            Sources, health metrics, archived records and agent setup.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <DisclosureSection
            title="Markdown sources"
            description="Repository documents synced by coding-agent hooks."
            count={documents.length}
          >
            <MemoryDocumentLibrary
              workspaceId={workspaceId}
              documents={documents}
            />
          </DisclosureSection>

          {(analytics || showAnalyticsUpgrade) ? (
            <DisclosureSection
              title="Memory health & analytics"
              description="Capture, curation, blocker and agent-context activity."
            >
              {analytics ? (
                <WorkspaceMemoryInsights analytics={analytics} />
              ) : (
                <div>
                  <p className="text-sm font-medium text-ink">
                    Understand how your project memory is working
                  </p>
                  <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                    Team leaders can track capture sources, context usage,
                    blockers, topic trends and every Dreaming cycle.
                  </p>
                  <Link
                    href="/pricing"
                    className={`${ui.btnSecondary} mt-4 inline-flex text-sm`}
                  >
                    View Team plan
                  </Link>
                </div>
              )}
            </DisclosureSection>
          ) : null}

          {canCurate && archivedEvents.length > 0 ? (
            <ArchivedMemoryReview events={archivedEvents} />
          ) : null}

        </div>
      </section>
    </div>
  );
}

export default async function MemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { workspaceId } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  return (
    <Suspense fallback={<MemoryContentSkeleton />}>
      <MemoryData workspaceId={workspaceId} page={page} />
    </Suspense>
  );
}
