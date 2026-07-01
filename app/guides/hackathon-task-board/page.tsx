import Link from "next/link";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { guideBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Free hackathon task board — kanban for small teams";
const DESCRIPTION =
  "Set up a free hackathon kanban board in minutes. Real-time sync across web, WhatsApp, and Claude. No credit card, built for 48-hour sprints.";
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
        breadcrumbs={guideBreadcrumbs("Hackathon task board", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          Hackathons punish setup time. You need a{" "}
          <strong>hackathon task board</strong> that works in the first hour —
          not after a Jira tutorial. Euclis is a free kanban board built for
          small teams who move fast and coordinate in WhatsApp, Claude, or the
          browser.
        </p>

        <h2>What hackathon teams actually need</h2>
        <ul>
          <li>
            <strong>Instant setup</strong> — email signup, create workspace,
            invite via link. Under 60 seconds.
          </li>
          <li>
            <strong>Real-time visibility</strong> — everyone sees card moves
            live, whether someone dragged on web or texted the bot.
          </li>
          <li>
            <strong>Low friction on mobile</strong> — WhatsApp commands for
            teammates who never open a laptop.
          </li>
          <li>
            <strong>Short task IDs</strong> — reference #7 in chat instead of
            pasting Trello URLs.
          </li>
          <li>
            <strong>Free</strong> — no credit card, no per-seat pricing during
            a weekend build.
          </li>
        </ul>

        <h2>Suggested kanban columns for a 48-hour sprint</h2>
        <p>
          Euclis ships with To Do, In Progress, and Done. For hackathons, map
          your mental model:
        </p>
        <ul>
          <li>
            <strong>To Do:</strong> Ideas, MVP scope, stretch goals
          </li>
          <li>
            <strong>In Progress:</strong> Active build, blocked items
          </li>
          <li>
            <strong>Done:</strong> Shipped, demo-ready, cut from scope
          </li>
        </ul>

        <h2>Run the board from three places</h2>
        <p>
          <strong>Web:</strong> drag cards, use the multiplayer whiteboard for
          architecture sketches, upload assets.
        </p>
        <p>
          <strong>WhatsApp:</strong> &quot;add task: wire up auth API, assign
          @dev, due tonight&quot; — synced to the board instantly.
        </p>
        <p>
          <strong>Claude MCP:</strong> break down the PRD into tasks while you
          pair-program — no context switching.
        </p>

        <h2>Euclis vs other hackathon tools</h2>
        <p>
          Ephemeral boards (like Kanbin) are great for solo agents but lack team
          workspaces. All-in-one hackathon platforms add chat and submissions
          you may not need. Euclis focuses on one thing well: a{" "}
          <strong>shared board that stays in sync</strong> wherever your team
          talks.
        </p>

        <h2>Get started free</h2>
        <p>
          <Link href="/signup" className="font-medium text-ink underline">
            Create a workspace
          </Link>
          , invite your squad, link WhatsApp if you want mobile updates. Drop
          the spreadsheet before ideation ends.
        </p>
      </MarketingArticle>
    </>
  );
}
