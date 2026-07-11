import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { listMemoryEventsPaginated } from "@/lib/services/memory";
import type { MemoryEventView } from "@/lib/actions/workspace";
import { displayUser } from "@/lib/username";
import { MemoryEventCard } from "@/components/memory/memory-event-card";
import {
  MEMORY_TIMELINE_PAGE_SIZE,
  MemoryPagination,
} from "@/components/memory/memory-pagination";
import { CopyField } from "@/components/ui/copy-field";
import { CODING_AGENT_RULES_SNIPPET } from "@/lib/memory/rules-snippet";
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

function SeedChecklist() {
  return (
    <div className={`${ui.contentPanel} text-center`}>
      <p className="text-base font-medium text-ink">No project memory yet</p>
      <p className={`${ui.fieldHint} mx-auto mt-2 max-w-2xl`}>
        Memory builds itself: when someone posts a task update that contains a
        decision, blocker, or milestone, it&apos;s captured automatically. To
        seed memory for a project that already has history:
      </p>
      <ol className="mx-auto mt-5 max-w-2xl list-decimal space-y-3 pl-5 text-left text-sm text-ink-soft">
        <li>
          <span className="font-medium text-ink">Backfill past updates</span> —
          run{" "}
          <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-xs text-ink">
            npm run backfill:memory
          </code>{" "}
          to extract decisions and blockers from existing task updates.
        </li>
        <li>
          <span className="font-medium text-ink">
            Tell the bot what it can&apos;t read
          </span>{" "}
          — on WhatsApp or Claude, say things like &quot;log a decision: we use
          Supabase RLS for all reads because writes go through the service
          layer&quot;.
        </li>
        <li>
          <span className="font-medium text-ink">
            Wire up your coding agents
          </span>{" "}
          — add the rules block below to your repo&apos;s{" "}
          <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-xs text-ink">
            AGENTS.md
          </code>{" "}
          so every session pulls context before working.
        </li>
      </ol>
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

function RulesSnippetSection() {
  return (
    <section className="mt-10 max-w-3xl">
      <h2 className={ui.settingsSectionTitle}>Coding-agent rules snippet</h2>
      <p className={`${ui.fieldHint} mb-4`}>
        Run this once in each repo — it appends the rules to{" "}
        <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-xs text-ink">
          AGENTS.md
        </code>{" "}
        so agents connected to Euclis via MCP pull relevant decisions and
        blockers before starting work, and record what they did after.
      </p>
      <div className={ui.contentPanel}>
        <RulesInstallCommand />
        <pre className="mt-4 max-h-72 overflow-auto rounded-lg border border-line bg-paper-deep/40 p-4 font-mono text-xs leading-relaxed text-ink-soft">
          {CODING_AGENT_RULES_SNIPPET}
        </pre>
      </div>
    </section>
  );
}

async function RulesInstallCommand() {
  const { getAppBaseUrl } = await import("@/lib/app-url");
  return (
    <CopyField
      value={`curl -fsSL ${getAppBaseUrl()}/api/agent-rules >> AGENTS.md`}
      secret={false}
    />
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

  let openEvents;
  let timelineEvents;
  let timelineTotal;
  let documents: MemoryDocumentView[] = [];
  let analytics: WorkspaceMemoryAnalytics | null = null;
  let showAnalyticsUpgrade = false;
  try {
    const [openResult, timelineResult, documentRows] = await Promise.all([
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
    <>
      <section className="mb-10 max-w-3xl">
        <h2 className={ui.settingsSectionTitle}>Project memory</h2>
        <p className={ui.fieldHint}>
          Decisions, blockers, dependencies, and milestones — captured
          automatically from task updates and queryable by anyone (or any
          agent) asking &quot;why&quot;, &quot;what&apos;s blocking&quot;, or
          &quot;what happened with X&quot;.
        </p>
      </section>

      {(analytics || showAnalyticsUpgrade) && (
        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className={ui.settingsSectionTitle}>
                Memory &amp; dreaming analytics
              </h2>
              <p className={ui.fieldHint}>
                Workspace-scoped capture, curation, blockers and agent-context
                usage.
              </p>
            </div>
            {analytics && (
              <span className="rounded bg-paper-deep px-2 py-1 font-mono text-[10px] text-ink-soft">
                Team leader view
              </span>
            )}
          </div>
          {analytics ? (
            <WorkspaceMemoryInsights analytics={analytics} />
          ) : (
            <div className="rounded-xl border border-line bg-card p-5">
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
        </section>
      )}

      <section className="mb-10">
        <h2 className={`${ui.settingsSectionTitle} mb-1`}>
          Markdown sources ({documents.length})
        </h2>
        <p className={`${ui.fieldHint} mb-4`}>
          Repository documents synced by coding-agent hooks. Preview the
          latest bounded snapshot and see how many structured events it
          supports.
        </p>
        <MemoryDocumentLibrary
          workspaceId={workspaceId}
          documents={documents}
        />
      </section>

      {!hasAnyMemory ? (
        <SeedChecklist />
      ) : (
        <>
          <section className="mb-10">
            <h2 className={`${ui.settingsSectionTitle} mb-4`}>
              Open blockers &amp; dependencies ({open.length})
            </h2>
            {open.length === 0 ? (
              <EmptyPanel>Nothing is blocked right now.</EmptyPanel>
            ) : (
              <div className="flex flex-col gap-3">
                {open.map((event) => (
                  <MemoryEventCard
                    key={event.id}
                    workspaceId={workspaceId}
                    event={event}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="mb-10">
            <h2 className={`${ui.settingsSectionTitle} mb-4`}>
              Timeline ({timelineTotal})
            </h2>
            {timelineTotal === 0 ? (
              <EmptyPanel>
                Decisions and milestones will appear here as they&apos;re
                captured.
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
        </>
      )}

      <RulesSnippetSection />
    </>
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
