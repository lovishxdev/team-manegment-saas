import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs TaskRio — WhatsApp task management compared";
const DESCRIPTION =
  "Honest comparison: TaskRio's WhatsApp group bot vs Euclis's private assistant, web kanban, and Claude MCP. Free tier, setup, and best use cases.";
const PATH = "/compare/taskrio";

const ROWS = [
  { feature: "WhatsApp model", euclis: "Private 1:1 bot per user", competitor: "Bot inside WhatsApp groups" },
  { feature: "Group @mention required", euclis: "No — chat naturally in DM", competitor: "Yes, in groups for most commands" },
  { feature: "Web kanban dashboard", euclis: "Full drag-and-drop board + whiteboard + assets", competitor: "Task-focused; less visual PM surface" },
  { feature: "Claude MCP connector", euclis: "Yes — same board from Claude", competitor: "No" },
  { feature: "Group admin approval", euclis: "Not required", competitor: "Required before group automation" },
  { feature: "Pricing", euclis: "Free to start, email signup", competitor: "Free for small projects; paid tiers exist" },
  { feature: "Task IDs in chat", euclis: "#42 short IDs per workspace", competitor: "T12 style IDs on task cards" },
  { feature: "Standup summaries in group", euclis: "Ask bot in DM; board on web", competitor: "@TaskRio summarise in group thread" },
  { feature: "Best for", euclis: "Teams wanting web + WhatsApp + Claude sync", competitor: "Teams who live entirely in one WhatsApp group" },
];

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default function EuclisVsTaskRioPage() {
  return (
    <>
      <MarketingJsonLd
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        breadcrumbs={compareBreadcrumbs("Euclis vs TaskRio", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          Both Euclis and TaskRio help teams manage work through WhatsApp. They
          solve the problem differently. This page explains TaskRio&apos;s
          WhatsApp group model and where Euclis fits — especially if you want a{" "}
          <strong>free team task board</strong> with a full web dashboard and
          Claude integration.
        </p>

        <h2>What TaskRio&apos;s WhatsApp group feature is</h2>
        <p>
          TaskRio is a <strong>WhatsApp group bot</strong>. You invite
          @TaskRio into an existing team group. In groups, the bot stays quiet
          until someone <strong>@mentions TaskRio</strong>. Then it can:
        </p>
        <ul>
          <li>Create tasks from natural language (e.g. @TaskRio fix bug by Friday)</li>
          <li>Post task cards in the group thread</li>
          <li>List open/overdue work (@TaskRio list open sends a DM; show open posts in group)</li>
          <li>Accept replies on task cards without @mention (e.g. &quot;done&quot;, &quot;tomorrow 5pm&quot;)</li>
          <li>Summarise recent standup discussion when asked</li>
          <li>Assign via @teammate mentions on task cards</li>
        </ul>
        <p>
          TaskRio <strong>ignores normal group chat</strong> — messages like
          &quot;@john can you help?&quot; do not trigger the bot. Before a group
          is enabled, TaskRio&apos;s team <strong>manually approves</strong> the
          group (send invite link via DM, wait for admin verification).
        </p>

        <h2>How Euclis handles WhatsApp</h2>
        <p>
          Euclis uses a <strong>private 1:1 chat</strong> with the Euclis bot
          per linked user. You message naturally — no @mention syntax. Claude
          Haiku parses intent and updates your team&apos;s shared workspace
          board. Teammates see changes on the web kanban in real time.
        </p>
        <p>
          Euclis does not post task cards into your WhatsApp group. That is
          intentional: your group stays a human space; the board is the system of
          record on web (and via Claude MCP).
        </p>

        <h2>Side-by-side comparison</h2>
        <CompareTable competitorName="TaskRio" rows={ROWS} />

        <h2>When to choose TaskRio</h2>
        <ul>
          <li>Your entire workflow already happens in one WhatsApp group</li>
          <li>You want task cards visible in the group thread for everyone</li>
          <li>You need in-group standup summaries and @mention-based assignment</li>
        </ul>

        <h2>When to choose Euclis</h2>
        <ul>
          <li>You want a proper kanban dashboard plus WhatsApp (not group-bot-only)</li>
          <li>Developers use Claude and need MCP access to the same board</li>
          <li>You prefer private bot chats so the group chat stays unstructured</li>
          <li>You want free signup with no group approval wait</li>
          <li>Hackathons, study groups, or side projects with mixed web/mobile users</li>
        </ul>

        <p>
          Read more:{" "}
          <Link
            href="/guides/manage-tasks-from-whatsapp"
            className="font-medium text-ink underline"
          >
            How to manage tasks from WhatsApp
          </Link>
        </p>
      </MarketingArticle>
    </>
  );
}
