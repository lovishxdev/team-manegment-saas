import Link from "next/link";
import { CompareTable } from "@/components/seo/compare-table";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { compareBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Euclis vs TaskRio — project memory vs WhatsApp group bot";
const DESCRIPTION =
  "TaskRio runs inside WhatsApp groups. Euclis uses a private 1:1 bot plus web memory, Dreaming, and MCP for agents — same workspace, different model.";
const PATH = "/compare/taskrio";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const ROWS = [
  {
    feature: "WhatsApp model",
    euclis: "Private 1:1 bot per linked user",
    competitor: "Bot inside WhatsApp groups (@mention)",
  },
  {
    feature: "Group chat",
    euclis: "Stays human — no bot cards in the thread",
    competitor: "Task cards and summaries in the group",
  },
  {
    feature: "Project memory",
    euclis: "Decisions, blockers, Dreaming maintenance",
    competitor: "Task-focused; not a memory product",
  },
  {
    feature: "AI agents / MCP",
    euclis: "Yes — get_project_context and board tools",
    competitor: "No",
  },
  {
    feature: "Web workspace",
    euclis: "Kanban, discussions, whiteboard, assets",
    competitor: "Lighter task surface",
  },
  {
    feature: "Onboarding",
    euclis: "Email signup; link phone when ready",
    competitor: "Group invite + admin approval",
  },
  {
    feature: "Best for",
    euclis: "Teams that want web + agents + optional WhatsApp",
    competitor: "Teams whose entire workflow is one WhatsApp group",
  },
];

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
          Both products meet teams in WhatsApp. TaskRio is a{" "}
          <strong>group bot</strong>. Euclis is a{" "}
          <strong>private assistant</strong> plus a full workspace with project
          memory for humans and coding agents.
        </p>

        <h2>TaskRio&apos;s group model</h2>
        <p>
          You invite @TaskRio into a WhatsApp group. The bot stays quiet until
          @mentioned (or someone replies to its task cards). Groups often need
          manual admin approval before automation works. Task cards and standup
          summaries can appear in the thread.
        </p>

        <h2>Euclis&apos;s model</h2>
        <p>
          Each teammate messages Euclis in a 1:1 chat. Updates hit the shared
          board and feed workspace memory. Agents pull the same brief via MCP.
          Your group chat is not a bot channel.
        </p>

        <h2>Side-by-side</h2>
        <CompareTable competitorName="TaskRio" rows={ROWS} />

        <h2>When to choose TaskRio</h2>
        <ul>
          <li>The whole workflow is one WhatsApp group</li>
          <li>You want task cards visible in the group thread</li>
        </ul>

        <h2>When to choose Euclis</h2>
        <ul>
          <li>You want web kanban + memory + MCP, not group-bot-only</li>
          <li>You prefer private bot chats</li>
          <li>Hackathons / side projects with mixed web and mobile users</li>
        </ul>

        <p>
          <Link
            href="/guides/manage-tasks-from-whatsapp"
            className="font-medium text-ink underline"
          >
            WhatsApp setup guide
          </Link>
        </p>
      </MarketingArticle>
    </>
  );
}
