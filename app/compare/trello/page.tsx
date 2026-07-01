import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs Trello — lightweight kanban with WhatsApp & Claude";
const DESCRIPTION =
  "Trello alternative for small teams who coordinate in chat. Compare free kanban, WhatsApp task commands, Claude MCP, and when Trello is still the better fit.";
const PATH = "/compare/trello";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const ROWS = [
  {
    feature: "Core focus",
    euclis: "Shared kanban + chat-native updates",
    competitor: "Visual kanban cards and boards",
  },
  {
    feature: "WhatsApp",
    euclis: "Private 1:1 bot — natural-language task commands",
    competitor: "No native WhatsApp interface",
  },
  {
    feature: "Claude MCP",
    euclis: "Manage the same board from Claude",
    competitor: "No MCP task board",
  },
  {
    feature: "Setup time",
    euclis: "Email signup, workspace in ~60 seconds",
    competitor: "Fast, but everyone must adopt Trello",
  },
  {
    feature: "Free tier",
    euclis: "Free to start, email only, no credit card",
    competitor: "Free with limits (10 boards/workspace, etc.)",
  },
  {
    feature: "Whiteboard",
    euclis: "Multiplayer whiteboard in workspace",
    competitor: "Requires Power-Ups / separate tools",
  },
  {
    feature: "Best team size",
    euclis: "2–15 informal teams (hackathons, side projects)",
    competitor: "2–10+; scales with paid plans",
  },
  {
    feature: "Ecosystem",
    euclis: "Focused — web, WhatsApp, Claude",
    competitor: "Mature integrations, Butler automations, huge template library",
  },
];

export default function EuclisVsTrelloPage() {
  return (
    <>
      <MarketingJsonLd
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        breadcrumbs={compareBreadcrumbs("Euclis vs Trello", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          Trello is the default answer for &quot;we need a kanban board.&quot;
          Euclis is for teams who also need that board to stay current when
          work happens in <strong>WhatsApp</strong> or <strong>Claude</strong> —
          not only when someone opens another tab.
        </p>

        <h2>What Trello does well</h2>
        <p>
          Trello invented the simple drag-and-drop card experience. For teams
          who already live in Trello daily, its free tier, templates, and
          Butler automations are hard to beat. If everyone checks the board
          twice a day, you may not need anything else.
        </p>

        <h2>Where Euclis is different</h2>
        <p>
          Euclis is a <strong>Trello alternative for WhatsApp teams</strong> and
          small squads who want one board with three doors: web kanban, WhatsApp
          assistant, and Claude MCP. Text &quot;add task: fix API, due tonight&quot;
          and the card appears on the board for everyone — same as a drag on
          the web.
        </p>

        <h2>Side-by-side comparison</h2>
        <CompareTable competitorName="Trello" rows={ROWS} />

        <h2>When to choose Trello</h2>
        <ul>
          <li>Your team already standardized on Trello and uses it daily</li>
          <li>You need mature Power-Ups, templates, and a large integration catalog</li>
          <li>WhatsApp and Claude are not part of how you coordinate work</li>
        </ul>

        <h2>When to choose Euclis</h2>
        <ul>
          <li>Tasks get discussed in WhatsApp but the Trello board goes stale</li>
          <li>You want Claude to manage the team backlog via MCP</li>
          <li>Hackathon or weekend team — free start, minimal setup, no training day</li>
          <li>You want kanban + whiteboard + assets without stacking tools</li>
        </ul>

        <p>
          Also compare:{" "}
          <Link href="/compare/notion" className="font-medium text-ink underline">
            Euclis vs Notion
          </Link>
          ,{" "}
          <Link href="/compare/taskrio" className="font-medium text-ink underline">
            vs TaskRio
          </Link>
        </p>
      </MarketingArticle>
    </>
  );
}
