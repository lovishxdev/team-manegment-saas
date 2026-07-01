import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs spreadsheets — when to graduate from Google Sheets";
const DESCRIPTION =
  "Still tracking hackathon or hostel tasks in a shared spreadsheet? Compare Sheets vs a free kanban board with WhatsApp and Claude sync.";
const PATH = "/compare/spreadsheets";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const ROWS = [
  {
    feature: "Task model",
    euclis: "Kanban columns — To Do, In Progress, Done",
    competitor: "Rows and columns you design manually",
  },
  {
    feature: "Realtime board view",
    euclis: "Drag-and-drop cards, live sync",
    competitor: "Cells update; no native kanban without setup",
  },
  {
    feature: "WhatsApp updates",
    euclis: "Message the bot — board updates automatically",
    competitor: "Manual cell edits; no chat integration",
  },
  {
    feature: "Claude MCP",
    euclis: "Claude reads and updates the same board",
    competitor: "Possible via exports; not built-in",
  },
  {
    feature: "Setup",
    euclis: "Email signup, invite team, start cards",
    competitor: "Free, but someone owns the sheet structure",
  },
  {
    feature: "Conflict / version issues",
    euclis: "Single source of truth per workspace",
    competitor: "Multiple editors, formula breaks, stale tabs",
  },
  {
    feature: "Files & whiteboard",
    euclis: "Assets tab + multiplayer whiteboard",
    competitor: "Drive links in cells; no whiteboard",
  },
  {
    feature: "Best for",
    euclis: "Small teams outgrowing chat + spreadsheet chaos",
    competitor: "Quick lists, budgets, one-off tables",
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
          Google Sheets is free, familiar, and everywhere — which is why hackathon
          teams, hostel committees, and side projects start there. It works until
          someone forgets to update row 14, the wrong tab gets edited, or
          &quot;who&apos;s doing what?&quot; becomes a scroll through WhatsApp.
        </p>

        <h2>What spreadsheets do well</h2>
        <p>
          Spreadsheets are unbeatable for budgets, rosters, simple tables, and
          one-person tracking. Zero onboarding. If your &quot;project&quot; is
          really a list with dates, keep the sheet.
        </p>

        <h2>Where Euclis is different</h2>
        <p>
          Euclis is a <strong>free team task board</strong> when you need status
          at a glance — kanban columns, assignees, short IDs like{" "}
          <code className="font-mono text-[13px]">#42</code> referenceable in
          chat, and updates from WhatsApp or Claude without touching a cell.
        </p>

        <h2>Side-by-side comparison</h2>
        <CompareTable competitorName="Google Sheets / Excel" rows={ROWS} />

        <h2>When to keep the spreadsheet</h2>
        <ul>
          <li>Budget tracking, sign-up lists, or data that is inherently tabular</li>
          <li>Solo tracking — no need for a shared board</li>
          <li>One person owns updates and the sheet stays current</li>
        </ul>

        <h2>When to switch to Euclis</h2>
        <ul>
          <li>The sheet is always out of date compared to the group chat</li>
          <li>You want kanban visibility — who is blocked, what is done</li>
          <li>Teammates update from WhatsApp instead of opening the sheet</li>
          <li>48-hour hackathon or weekend event — need structure in minutes</li>
        </ul>

        <p>
          <Link href="/signup" className="font-medium text-ink underline">
            Start free
          </Link>{" "}
          — email only, no credit card. Drop the spreadsheet before your next
          sprint.
        </p>
      </MarketingArticle>
    </>
  );
}
