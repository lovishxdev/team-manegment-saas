import Link from "next/link";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { guideBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Hackathon project memory — board + context for 48-hour teams";
const DESCRIPTION =
  "Run a hackathon without losing decisions in the group chat. Free Euclis workspace: kanban, WhatsApp, and a brief your agents can pull via MCP.";
const PATH = "/guides/hackathon-task-board";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default function HackathonTaskBoardGuide() {
  return (
    <>
      <MarketingJsonLd
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        breadcrumbs={guideBreadcrumbs("Hackathon project memory", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          Hackathons punish setup time and punish lost context. You need a board
          in the first hour — and a place where &quot;we decided to cut the
          auth rewrite&quot; does not die in WhatsApp at 2 AM. Euclis is free
          Hobby for small teams: kanban, WhatsApp, and{" "}
          <strong>project memory</strong> agents can read.
        </p>

        <h2>What a 48-hour team actually needs</h2>
        <ul>
          <li>
            <strong>Instant setup</strong> — email signup, invite link, under a
            minute
          </li>
          <li>
            <strong>A live board</strong> — who is on what, without a spreadsheet
          </li>
          <li>
            <strong>Mobile updates</strong> — WhatsApp commands when nobody has
            a laptop open
          </li>
          <li>
            <strong>Agent context</strong> — Claude Code / Cursor can call{" "}
            <code className="font-mono text-[13px]">get_project_context</code>{" "}
            instead of you pasting the brief again
          </li>
          <li>
            <strong>Free</strong> — no credit card for a weekend build
          </li>
        </ul>

        <h2>Suggested flow</h2>
        <ol>
          <li>Create a workspace named after the hackathon.</li>
          <li>Dump MVP scope onto the kanban (To Do / In Progress / Done).</li>
          <li>Link WhatsApp for the people who live on phones.</li>
          <li>
            Connect MCP so agents load decisions and blockers mid-build.
          </li>
        </ol>

        <h2>Why not only Trello or a Google Sheet?</h2>
        <p>
          Boards go stale when the real conversation is in chat. Sheets scatter
          ownership. Euclis keeps the board and the memory in one workspace —
          see{" "}
          <Link href="/compare/trello" className="font-medium text-ink underline">
            vs Trello
          </Link>{" "}
          and{" "}
          <Link
            href="/compare/spreadsheets"
            className="font-medium text-ink underline"
          >
            vs spreadsheets
          </Link>
          .
        </p>

        <p>
          <Link href="/signup" className="font-medium text-ink underline">
            Create a workspace
          </Link>{" "}
          before ideation ends.
        </p>
      </MarketingArticle>
    </>
  );
}
