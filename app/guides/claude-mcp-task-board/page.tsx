import Link from "next/link";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { guideBreadcrumbs } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Claude MCP project memory — get_project_context for your team";
const DESCRIPTION =
  "Connect Euclis to Claude or Cursor via MCP. Agents load the same project brief as your teammates — decisions, blockers, and board state.";
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
        breadcrumbs={guideBreadcrumbs("Claude MCP project memory", PATH)}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          Coding agents are only as good as the context you paste. Euclis
          exposes your workspace over{" "}
          <strong>MCP</strong> so Claude Desktop, Claude Code, or Cursor can
          pull a real project brief — not a stale README.
        </p>

        <h2>What agents get</h2>
        <p>
          The key call is{" "}
          <code className="font-mono text-[13px]">get_project_context</code>:
          relevant decisions, open blockers, and recent memory for what you are
          about to work on. Agents can also create and update tasks on the same
          board your team uses on the web and WhatsApp.
        </p>

        <h2>Why this beats local-only MCP kanban tools</h2>
        <p>
          Many MCP boards are single-user and self-hosted. Euclis is a{" "}
          <strong>team workspace</strong>: invite people, capture from WhatsApp,
          run Dreaming on memory, and let every engineer&apos;s agent load the
          same source of truth.
        </p>

        <h2>Setup overview</h2>
        <ol>
          <li>
            <Link href="/signup" className="font-medium text-ink underline">
              Create a free account
            </Link>{" "}
            and workspace.
          </li>
          <li>Connect Claude / Cursor via OAuth MCP in workspace settings.</li>
          <li>
            Ask the agent: &quot;What&apos;s blocking us?&quot; or &quot;Load
            project context for the auth rewrite.&quot;
          </li>
        </ol>

        <h2>Plans and MCP scope</h2>
        <p>
          Hobby includes baseline <strong>context</strong> MCP access. Team and
          Business unlock full MCP scope. See{" "}
          <Link href="/pricing" className="font-medium text-ink underline">
            pricing
          </Link>
          .
        </p>

        <p>
          Deeper product story:{" "}
          <Link
            href="/guides/project-memory-dreaming"
            className="font-medium text-ink underline"
          >
            project memory &amp; Dreaming
          </Link>
          .
        </p>
      </MarketingArticle>
    </>
  );
}
