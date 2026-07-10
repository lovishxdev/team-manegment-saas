import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs Notion — living memory vs a wiki you maintain";
const DESCRIPTION =
  "Notion is excellent for docs and databases. Euclis captures project context from chat and agents — so you are not rebuilding the brief by hand.";
const PATH = "/compare/notion";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const ROWS = [
  {
    feature: "Primary strength",
    euclis: "Auto-captured project memory + agent brief",
    competitor: "Docs, databases, wikis you design",
  },
  {
    feature: "Maintenance",
    euclis: "Dreaming tends the store on a schedule",
    competitor: "Humans keep pages and DBs up to date",
  },
  {
    feature: "AI agents",
    euclis: "MCP shares the same brief as the team",
    competitor: "Possible with custom setups; not the core product",
  },
  {
    feature: "WhatsApp",
    euclis: "Native 1:1 task & capture assistant",
    competitor: "No WhatsApp-native memory capture",
  },
  {
    feature: "Learning curve",
    euclis: "Workspace ready in minutes",
    competitor: "Steeper — databases, relations, templates",
  },
  {
    feature: "Best for",
    euclis: "Teams tired of re-explaining context",
    competitor: "Teams that need a company wiki + custom DBs",
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
          &quot;Can we just put it in Notion?&quot; works until nobody updates
          the page. Euclis assumes context is created in chat and editors — and
          should not require a second write into a wiki.
        </p>

        <h2>What Notion does well</h2>
        <p>
          Long-form docs, flexible databases, and a single place for company
          knowledge. If documentation is the product, Notion wins.
        </p>

        <h2>Where Euclis is different</h2>
        <p>
          Euclis is not trying to replace your wiki. It is{" "}
          <strong>project memory</strong>: decisions and blockers captured from
          WhatsApp, Claude, Cursor, and the web, maintained by Dreaming, shared
          with agents via MCP. Kanban and discussions sit alongside that memory.
        </p>

        <h2>Side-by-side</h2>
        <CompareTable competitorName="Notion" rows={ROWS} />

        <h2>When to choose Notion</h2>
        <ul>
          <li>You need rich docs and custom databases</li>
          <li>The team already lives in Notion daily</li>
          <li>Manual wiki maintenance is acceptable</li>
        </ul>

        <h2>When to choose Euclis</h2>
        <ul>
          <li>New people (and new agent sessions) start from zero</li>
          <li>Decisions die in scrollback</li>
          <li>You want capture + Dreaming, not another empty page</li>
        </ul>

        <p>
          <Link
            href="/guides/project-memory-dreaming"
            className="font-medium text-ink underline"
          >
            How Dreaming works
          </Link>
        </p>
      </MarketingArticle>
    </>
  );
}
