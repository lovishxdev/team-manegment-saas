import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs Notion — task board vs all-in-one workspace";
const DESCRIPTION =
  "Notion is a docs and wiki powerhouse. Euclis is a free task-first kanban with WhatsApp and Claude MCP. Compare when each tool fits your small team.";
const PATH = "/compare/notion";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const ROWS = [
  {
    feature: "Primary strength",
    euclis: "Task board that stays in sync from chat",
    competitor: "Docs, databases, wikis, flexible workspaces",
  },
  {
    feature: "Task management",
    euclis: "Kanban-first — built for card flow",
    competitor: "Database/board views you configure yourself",
  },
  {
    feature: "WhatsApp",
    euclis: "Native bot — create and update tasks by message",
    competitor: "No WhatsApp task interface",
  },
  {
    feature: "Claude MCP",
    euclis: "Team board via MCP connector",
    competitor: "Not a dedicated MCP task board product",
  },
  {
    feature: "Learning curve",
    euclis: "Low — board ready in minutes",
    competitor: "Steeper — databases, relations, templates",
  },
  {
    feature: "Documentation",
    euclis: "Task descriptions, assets, links — not a full wiki",
    competitor: "Excellent long-form docs and knowledge bases",
  },
  {
    feature: "Free tier",
    euclis: "Free to start for small teams",
    competitor: "Generous for solo; team features vary by plan",
  },
  {
    feature: "Best for",
    euclis: "Chat-native teams who need one live board",
    competitor: "Teams who want one app for notes + tasks + wiki",
  },
];

export default function EuclisVsNotionPage() {
  return (
    <>
      <MarketingJsonLd
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        breadcrumbs={compareBreadcrumbs("Euclis vs Notion", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          &quot;Can we just use Notion for tasks?&quot; is a fair question.
          Notion can do almost anything — but for a 5-person hackathon squad
          coordinating in WhatsApp, it is often <strong>more tool than the
          problem needs</strong>. Euclis is deliberately narrower and
          chat-native.
        </p>

        <h2>What Notion does well</h2>
        <p>
          Notion excels when your team wants a single place for documentation,
          specs, meeting notes, and custom database views. If building a
          company wiki matters as much as tracking tasks, Notion is a strong
          choice.
        </p>

        <h2>Where Euclis is different</h2>
        <p>
          Euclis does not try to replace your wiki. It gives you a{" "}
          <strong>shared kanban</strong> reachable from the browser, WhatsApp,
          and Claude — so informal teams do not need to learn databases or
          rebuild a board from templates before the sprint starts.
        </p>

        <h2>Side-by-side comparison</h2>
        <CompareTable competitorName="Notion" rows={ROWS} />

        <h2>When to choose Notion</h2>
        <ul>
          <li>Documentation and knowledge base are as important as task status</li>
          <li>You want deeply customized database views and relations</li>
          <li>Everyone already works in Notion daily</li>
        </ul>

        <h2>When to choose Euclis</h2>
        <ul>
          <li>Tasks scatter in group chat and the board never gets updated</li>
          <li>You need WhatsApp or Claude as first-class task interfaces</li>
          <li>Side project, study group, or hackathon — speed over flexibility</li>
          <li>You want kanban + whiteboard without configuring Notion databases</li>
        </ul>

        <p>
          Also compare:{" "}
          <Link href="/compare/trello" className="font-medium text-ink underline">
            Euclis vs Trello
          </Link>
          ,{" "}
          <Link href="/compare/clickup" className="font-medium text-ink underline">
            vs ClickUp
          </Link>
        </p>
      </MarketingArticle>
    </>
  );
}
