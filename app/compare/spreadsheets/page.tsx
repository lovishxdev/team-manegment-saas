import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs spreadsheets — when the sheet stops being the plan";
const DESCRIPTION =
  "Google Sheets is fine until ownership and decisions scatter. Euclis gives you a board plus project memory humans and agents can share.";
const PATH = "/compare/spreadsheets";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const ROWS = [
  {
    feature: "Task model",
    euclis: "Kanban + structured memory",
    competitor: "Rows you design yourself",
  },
  {
    feature: "Decisions & blockers",
    euclis: "First-class memory events",
    competitor: "Comments in cells / side tabs",
  },
  {
    feature: "WhatsApp / agents",
    euclis: "Native capture and MCP brief",
    competitor: "Manual edits only",
  },
  {
    feature: "Stale data",
    euclis: "Dreaming tends the store",
    competitor: "Wrong tab, broken formulas, forgotten owners",
  },
  {
    feature: "Best for",
    euclis: "Teams outgrowing chat + sheet chaos",
    competitor: "Budgets, rosters, one-off tables",
  },
];

export default function EuclisVsSpreadsheetsPage() {
  return (
    <>
      <MarketingJsonLd
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        breadcrumbs={compareBreadcrumbs("Euclis vs spreadsheets", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          Sheets are free and familiar — which is why hackathon teams start
          there. They fail when &quot;who owns auth?&quot; lives in three tabs
          and a WhatsApp thread nobody can search.
        </p>

        <h2>Keep the spreadsheet when</h2>
        <ul>
          <li>You are tracking budgets, sign-ups, or pure tabular data</li>
          <li>One person owns updates and the sheet stays current</li>
        </ul>

        <h2>Switch to Euclis when</h2>
        <ul>
          <li>The sheet is always behind the group chat</li>
          <li>You need kanban visibility plus memory agents can load</li>
          <li>Weekend / hackathon speed matters</li>
        </ul>

        <h2>Side-by-side</h2>
        <CompareTable competitorName="Google Sheets / Excel" rows={ROWS} />

        <p>
          <Link href="/signup" className="font-medium text-ink underline">
            Start free
          </Link>{" "}
          — Hobby, no credit card.
        </p>
      </MarketingArticle>
    </>
  );
}
