import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs ClickUp — simple board vs everything app";
const DESCRIPTION =
  "ClickUp packs docs, goals, and tasks into one platform. Euclis is a free lightweight kanban with WhatsApp and Claude. Compare complexity vs chat-native focus.";
const PATH = "/compare/clickup";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const ROWS = [
  {
    feature: "Philosophy",
    euclis: "One board, three doors (web / WhatsApp / Claude)",
    competitor: "Replace many tools with one workspace",
  },
  {
    feature: "Feature depth",
    euclis: "Kanban, whiteboard, assets, links — focused",
    competitor: "Tasks, docs, goals, time tracking, forms, and more",
  },
  {
    feature: "Learning curve",
    euclis: "Minutes — board ready immediately",
    competitor: "Days — hierarchy of spaces, folders, lists",
  },
  {
    feature: "WhatsApp",
    euclis: "Native task bot in private chat",
    competitor: "No WhatsApp-native task interface",
  },
  {
    feature: "Claude MCP",
    euclis: "Built-in MCP connector to team board",
    competitor: "No equivalent MCP task board",
  },
  {
    feature: "Free tier",
    euclis: "Free to start, email signup",
    competitor: "Generous free tier but feature-heavy UI",
  },
  {
    feature: "Best team size",
    euclis: "2–15 informal / ad-hoc teams",
    competitor: "Teams wanting one platform for everything",
  },
  {
    feature: "Where they win",
    euclis: "Chat-native sync, speed, simplicity",
    competitor: "Breadth, reporting, all-in-one consolidation",
  },
];

export default function EuclisVsClickUpPage() {
  return (
    <>
      <MarketingJsonLd
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        breadcrumbs={compareBreadcrumbs("Euclis vs ClickUp", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          ClickUp promises to replace your stack. That is powerful for teams
          ready to standardize on one complex workspace — and overwhelming for a
          four-person side project that just needs a board everyone will
          actually update.
        </p>

        <h2>What ClickUp does well</h2>
        <p>
          ClickUp&apos;s free tier is unusually generous: unlimited users, many
          views, docs, and goals in one place. If your team wants Gantt charts,
          time tracking, and nested project hierarchy, ClickUp delivers depth.
        </p>

        <h2>Where Euclis is different</h2>
        <p>
          Euclis is intentionally <strong>lightweight</strong>. You get a kanban
          board, whiteboard, and assets — plus the unusual part: update it from
          WhatsApp or Claude without learning ClickUp&apos;s space/folder/list
          model.
        </p>

        <h2>Side-by-side comparison</h2>
        <CompareTable competitorName="ClickUp" rows={ROWS} />

        <h2>When to choose ClickUp</h2>
        <ul>
          <li>You want one platform for docs, goals, time tracking, and tasks</li>
          <li>Your team has bandwidth to learn and maintain a complex hierarchy</li>
          <li>Reporting and multiple views (Gantt, workload) are requirements</li>
        </ul>

        <h2>When to choose Euclis</h2>
        <ul>
          <li>ClickUp felt like too much for a hackathon or weekend build</li>
          <li>Coordination happens in WhatsApp — the board must follow chat</li>
          <li>Developers want Claude MCP on the same board as the team</li>
          <li>You prefer a simple kanban over an everything-app</li>
        </ul>

        <p>
          Also compare:{" "}
          <Link href="/compare/trello" className="font-medium text-ink underline">
            Euclis vs Trello
          </Link>
          ,{" "}
          <Link href="/compare/notion" className="font-medium text-ink underline">
            vs Notion
          </Link>
        </p>
      </MarketingArticle>
    </>
  );
}
