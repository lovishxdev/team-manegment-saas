import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs Trello — project memory vs a kanban you open";
const DESCRIPTION =
  "Trello is a great card board. Euclis captures context from WhatsApp, Claude, and Cursor — then shares one brief with your team and agents.";
const PATH = "/compare/trello";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const ROWS = [
  {
    feature: "Core job",
    euclis: "Shared project memory + board",
    competitor: "Visual kanban cards and lists",
  },
  {
    feature: "Where context lives",
    euclis: "Captured from chat & editors; Dreaming keeps it current",
    competitor: "On cards — if someone updates them",
  },
  {
    feature: "AI agents",
    euclis: "MCP get_project_context for the same brief",
    competitor: "No native project-memory MCP",
  },
  {
    feature: "WhatsApp",
    euclis: "Private 1:1 bot updates the workspace",
    competitor: "No native WhatsApp assistant",
  },
  {
    feature: "Free tier",
    euclis: "Hobby free forever for small teams",
    competitor: "Free with board/automation limits",
  },
  {
    feature: "Best for",
    euclis: "Teams shipping with AI in the loop",
    competitor: "Teams that already live in Trello daily",
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
          Trello invented simple drag-and-drop cards. If everyone opens Trello
          twice a day, it still works. Euclis is for teams whose real plan lives
          in WhatsApp and agent sessions — and who need that context to survive
          past the scrollback.
        </p>

        <h2>What Trello does well</h2>
        <p>
          Mature kanban UX, templates, Power-Ups, and a huge ecosystem. For pure
          card tracking with a trained team, Trello is hard to beat.
        </p>

        <h2>Where Euclis is different</h2>
        <p>
          Euclis is <strong>memory-first</strong>: capture decisions and blockers
          from WhatsApp, Claude, Cursor, and the web; Dreaming maintains the
          store; agents pull{" "}
          <code className="font-mono text-[13px]">get_project_context</code>. You
          still get a kanban — it is not the whole product.
        </p>

        <h2>Side-by-side</h2>
        <CompareTable competitorName="Trello" rows={ROWS} />

        <h2>When to choose Trello</h2>
        <ul>
          <li>Your team already standardized on Trello</li>
          <li>You need deep Power-Ups and template libraries</li>
          <li>AI agents and chat capture are not part of the workflow</li>
        </ul>

        <h2>When to choose Euclis</h2>
        <ul>
          <li>Context dies in chat; the board goes stale</li>
          <li>You want agents and humans on the same brief</li>
          <li>Hackathon / side-project speed with free Hobby</li>
        </ul>

        <p>
          Also:{" "}
          <Link href="/compare/notion" className="font-medium text-ink underline">
            vs Notion
          </Link>
          ,{" "}
          <Link
            href="/guides/project-memory-dreaming"
            className="font-medium text-ink underline"
          >
            how memory works
          </Link>
        </p>
      </MarketingArticle>
    </>
  );
}
