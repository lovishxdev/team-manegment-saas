import Link from "next/link";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { guideBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Project memory and Dreaming — how Euclis keeps context current";
const DESCRIPTION =
  "What Euclis project memory is, how Dreaming maintains it while you're away, and why humans and AI agents share one brief.";
const PATH = "/guides/project-memory-dreaming";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default function ProjectMemoryDreamingGuide() {
  return (
    <>
      <MarketingJsonLd
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        breadcrumbs={guideBreadcrumbs("Project memory & Dreaming", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          Most teams lose context in chat scrollback. New teammates ask the same
          questions. New AI sessions start from zero.{" "}
          <strong>Euclis is shared project memory</strong> — decisions, blockers,
          and milestones captured where work already happens, then kept current.
        </p>

        <h2>Capture from every surface</h2>
        <p>
          Euclis listens on WhatsApp, Claude, Cursor, and the web. You do not
          re-enter the same decision into a wiki. Capture records the moment;
          the workspace turns it into structured memory.
        </p>

        <h2>What gets stored</h2>
        <ul>
          <li>
            <strong>Decisions</strong> — what you chose and why
          </li>
          <li>
            <strong>Blockers</strong> — what is stuck and who it affects
          </li>
          <li>
            <strong>Dependencies</strong> — what waits on what
          </li>
          <li>
            <strong>Milestones</strong> — shipped moments worth keeping
          </li>
        </ul>

        <h2>What Dreaming does</h2>
        <p>
          Capture only ever sees one moment. On a schedule, Dreaming steps back
          and tends the whole store:
        </p>
        <ul>
          <li>
            <strong>Consolidate</strong> — merge duplicate notes
          </li>
          <li>
            <strong>Reconcile</strong> — flag or resolve contradictions
          </li>
          <li>
            <strong>Surface</strong> — highlight patterns no single note could see
          </li>
          <li>
            <strong>Prune</strong> — file away what has gone stale
          </li>
        </ul>
        <p>
          Nothing is deleted. Plan retention may hide older events from recall —
          they stay in the store. Hobby includes raw capture; Team adds curated
          Dreaming (dedupe, contradiction resolution, insights).
        </p>

        <h2>One brief for humans and agents</h2>
        <p>
          Teammates read memory in the app. Coding agents call{" "}
          <code className="font-mono text-[13px]">get_project_context</code> over
          MCP and load the same brief — so Claude Code or Cursor does not need
          you to paste last week&apos;s chat.
        </p>

        <h2>Still a board when you need one</h2>
        <p>
          Euclis includes kanban, discussions, whiteboard, and assets. The
          difference is the center of gravity: memory first, tasks as part of
          the same workspace — not another empty board you forget to update.
        </p>

        <p>
          <Link href="/signup" className="font-medium text-ink underline">
            Start free on Hobby
          </Link>{" "}
          or see{" "}
          <Link href="/pricing" className="font-medium text-ink underline">
            pricing
          </Link>{" "}
          for Team curated memory.
        </p>
      </MarketingArticle>
    </>
  );
}
