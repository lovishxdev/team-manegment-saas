import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { listMemoryEvents } from "@/lib/services/memory";
import type { MemoryEventView } from "@/lib/actions/workspace";
import { displayUser } from "@/lib/username";
import { MemoryEventCard } from "@/components/memory/memory-event-card";
import { CopyField } from "@/components/ui/copy-field";
import { CODING_AGENT_RULES_SNIPPET } from "@/lib/memory/rules-snippet";
import { LinksContentSkeleton } from "@/components/ui/tab-content-skeleton";

function SeedChecklist() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line/80 bg-paper px-8 py-14 text-center shadow-[0_1px_3px_rgba(26,26,26,0.04)]">
      <p className="font-display text-lg text-ink">No project memory yet.</p>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Memory builds itself: when someone posts a task update that contains a
        decision, blocker, or milestone, it&apos;s captured automatically. To
        seed memory for a project that already has history:
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
        <li>
          <span className="font-medium text-ink">Backfill past updates</span> —
          run{" "}
          <code className="rounded bg-paper-deep px-1 py-0.5 font-mono text-xs">
            npm run backfill:memory
          </code>{" "}
          to extract decisions and blockers from existing task updates.
        </li>
        <li>
          <span className="font-medium text-ink">Tell the bot what it can&apos;t read</span>{" "}
          — on WhatsApp or Claude, say things like &quot;log a decision: we
          use Supabase RLS for all reads because writes go through the service
          layer&quot;. Key architectural choices, known constraints, things
          newcomers trip over.
        </li>
        <li>
          <span className="font-medium text-ink">Wire up your coding agents</span>{" "}
          — add the rules block below to your repo&apos;s{" "}
          <code className="rounded bg-paper-deep px-1 py-0.5 font-mono text-xs">
            .cursor/rules
          </code>{" "}
          or{" "}
          <code className="rounded bg-paper-deep px-1 py-0.5 font-mono text-xs">
            AGENTS.md
          </code>{" "}
          so every session pulls context before working.
        </li>
      </ol>
    </div>
  );
}

function RulesSnippetSection() {
  return (
    <section className="mt-10 max-w-3xl">
      <h2 className="text-sm font-semibold text-ink">
        Coding-agent rules snippet
      </h2>
      <p className="mb-3 mt-1 text-sm text-ink-soft">
        Run this once in each repo — it appends the rules to{" "}
        <code className="rounded bg-paper-deep px-1 py-0.5 font-mono text-xs">AGENTS.md</code>{" "}
        so agents connected to Euclis via MCP pull relevant decisions and
        blockers before starting work, and record what they did after.
      </p>
      <RulesInstallCommand />
      <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-line bg-paper-deep/50 p-4 font-mono text-xs leading-relaxed text-ink-soft">
        {CODING_AGENT_RULES_SNIPPET}
      </pre>
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

async function MemoryData({ workspaceId }: { workspaceId: string }) {
  const user = await requireUser();

  let events;
  try {
    events = await listMemoryEvents({
      workspaceId,
      userId: user.id,
      limit: 100,
    });
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const views: MemoryEventView[] = events.map((e) => ({
    id: e.id,
    kind: e.kind,
    status: e.status,
    summary: e.summary,
    reasoning: e.reasoning,
    createdAt: e.createdAt.toISOString(),
    resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
    authorLabel: e.author ? displayUser(e.author) : null,
    task: e.task,
  }));

  const open = views.filter((v) => v.status === "OPEN");
  const rest = views.filter((v) => v.status !== "OPEN");

  return (
    <>
      <section className="mb-8 max-w-3xl">
        <h2 className="mb-1 text-sm font-semibold text-ink">Project memory</h2>
        <p className="text-sm text-ink-soft">
          Decisions, blockers, dependencies, and milestones — captured
          automatically from task updates and queryable by anyone (or any
          agent) asking &quot;why&quot;, &quot;what&apos;s blocking&quot;, or
          &quot;what happened with X&quot;.
        </p>
      </section>

      {views.length === 0 ? (
        <SeedChecklist />
      ) : (
        <>
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-ink">
              Open blockers &amp; dependencies{" "}
              <span className="font-normal text-ink-faint">({open.length})</span>
            </h3>
            {open.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-paper px-4 py-3 text-sm text-ink-soft">
                Nothing is blocked right now.
              </p>
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

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">
              Timeline{" "}
              <span className="font-normal text-ink-faint">({rest.length})</span>
            </h3>
            {rest.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-paper px-4 py-3 text-sm text-ink-soft">
                Decisions and milestones will appear here as they&apos;re
                captured.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {rest.map((event) => (
                  <MemoryEventCard
                    key={event.id}
                    workspaceId={workspaceId}
                    event={event}
                  />
                ))}
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
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <Suspense fallback={<LinksContentSkeleton />}>
      <MemoryData workspaceId={workspaceId} />
    </Suspense>
  );
}
