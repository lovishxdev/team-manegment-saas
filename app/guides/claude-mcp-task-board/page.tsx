import Link from "next/link";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { guideBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Claude MCP task board — manage team tasks from Claude";
const DESCRIPTION =
  "Connect Euclis to Claude via MCP and manage your team's kanban board mid-conversation. Free workspace, synced with web and WhatsApp.";
const PATH = "/guides/claude-mcp-task-board";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default function ClaudeMcpTaskBoardGuide() {
  return (
    <>
      <MarketingJsonLd
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        breadcrumbs={guideBreadcrumbs("Claude MCP task board", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          Developers and PMs increasingly work inside Claude. But your team&apos;s
          tasks still live in a separate tab — unless your task board exposes a{" "}
          <strong>Claude MCP connector</strong>. Euclis is a free team kanban that
          Claude can read and update through the Model Context Protocol, synced
          with the web dashboard and WhatsApp.
        </p>

        <h2>What is Claude MCP project management?</h2>
        <p>
          MCP (Model Context Protocol) lets Claude call tools on external
          systems. With Euclis connected, Claude can create tasks, move cards,
          and read board state — the same data your teammates see on the web or
          update from WhatsApp. One Postgres-backed board, three interfaces.
        </p>

        <h2>Why this matters vs local MCP kanban tools</h2>
        <p>
          Many MCP kanban projects are self-hosted and single-user. Euclis is a
          hosted team workspace: invite cofounders, share assets, use the
          whiteboard, and let Claude manage the shared backlog while a teammate
          texts <em>close #12</em> from their phone.
        </p>

        <h2>What Claude can do on your Euclis board</h2>
        <ul>
          <li>Create and update tasks with titles, priority, due dates, and tags</li>
          <li>Move cards between To Do, In Progress, and Done</li>
          <li>Read full board state for standups or planning</li>
          <li>Reference task short IDs (#42) consistently with WhatsApp commands</li>
        </ul>

        <h2>Setup overview</h2>
        <ol>
          <li>
            <Link href="/signup" className="font-medium text-ink underline">
              Create a free Euclis account
            </Link>{" "}
            and workspace.
          </li>
          <li>
            In workspace settings → Integrations, connect Claude via OAuth MCP.
          </li>
          <li>
            In Claude Desktop or claude.ai, add the Euclis MCP connector when
            prompted.
          </li>
          <li>
            Ask Claude: &quot;What&apos;s on our board?&quot; or &quot;Add a
            task to fix the API timeout, high priority.&quot;
          </li>
        </ol>

        <h2>Three doors, one board</h2>
        <p>
          <strong>Claude MCP</strong> for planning in chat.{" "}
          <strong>Web</strong> for drag-and-drop and whiteboard.{" "}
          <strong>WhatsApp</strong> for teammates on mobile. Every change syncs
          in real time — same board, same truth.
        </p>

        <h2>Free to start</h2>
        <p>
          No credit card. Email signup only. MCP, WhatsApp, and web are available
          on the free tier for small teams.
        </p>
      </MarketingArticle>
    </>
  );
}
