import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs ClickUp — focused memory vs the everything app";
const DESCRIPTION =
  "ClickUp packs many tools into one workspace. Euclis focuses on shared project memory for humans and AI agents — lighter to adopt, built for chat and MCP.";
const PATH = "/compare/clickup";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const ROWS = [
  {
    feature: "Philosophy",
    euclis: "One memory brief, many capture doors",
    competitor: "Replace many tools with one platform",
  },
  {
    feature: "Feature depth",
    euclis: "Memory, Dreaming, discussions, kanban, MCP",
    competitor: "Tasks, docs, goals, time tracking, forms…",
  },
  {
    feature: "Learning curve",
    euclis: "Minutes",
    competitor: "Days — spaces, folders, lists",
  },
  {
    feature: "Agent brief",
    euclis: "Native MCP get_project_context",
    competitor: "Not a first-class project-memory MCP product",
  },
  {
    feature: "WhatsApp",
    euclis: "Native 1:1 assistant",
    competitor: "No WhatsApp-native capture",
  },
  {
    feature: "Best for",
    euclis: "Small AI-native teams",
    competitor: "Teams consolidating a large tool stack",
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
          ClickUp promises to replace your stack. That is powerful when you have
          time to configure it — and heavy for a four-person side project that
          just needs context to stick.
        </p>

        <h2>What ClickUp does well</h2>
        <p>
          Breadth: views, docs, goals, reporting. Generous free tiers if you
          want one platform for everything.
        </p>

        <h2>Where Euclis is different</h2>
        <p>
          Euclis stays narrow on purpose:{" "}
          <strong>capture → structure → Dream → share with agents</strong>. You
          get a board and discussions without learning a hierarchy of spaces.
        </p>

        <h2>Side-by-side</h2>
        <CompareTable competitorName="ClickUp" rows={ROWS} />

        <h2>When to choose ClickUp</h2>
        <ul>
          <li>You want Gantt, time tracking, and deep hierarchy</li>
          <li>The team will invest in learning one mega-tool</li>
        </ul>

        <h2>When to choose Euclis</h2>
        <ul>
          <li>ClickUp felt like too much for a weekend team</li>
          <li>You need WhatsApp + MCP memory, not another UI to train</li>
        </ul>

        <p>
          <Link href="/pricing" className="font-medium text-ink underline">
            See Euclis plans
          </Link>
        </p>
      </MarketingArticle>
    </>
  );
}
