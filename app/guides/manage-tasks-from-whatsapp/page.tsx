import Link from "next/link";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { guideBreadcrumbs, howToJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Manage tasks from WhatsApp — and keep project memory in sync";
const DESCRIPTION =
  "Use Euclis's private WhatsApp assistant to update the shared board in plain English. Not a group bot — 1:1 chat that feeds the same workspace memory.";
const PATH = "/guides/manage-tasks-from-whatsapp";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default function ManageTasksFromWhatsAppGuide() {
  const howTo = howToJsonLd({
    name: "Set up WhatsApp with Euclis",
    description: DESCRIPTION,
    path: PATH,
    steps: [
      {
        name: "Create a free account",
        text: "Sign up at euclis.dev with email — no credit card required.",
      },
      {
        name: "Create a workspace",
        text: "Create a workspace and invite teammates from the dashboard.",
      },
      {
        name: "Link WhatsApp",
        text: "Under Settings → WhatsApp, link your phone number to the Euclis bot.",
      },
      {
        name: "Send a command",
        text: 'Message the bot: "add task: fix landing page copy, due Friday".',
      },
      {
        name: "Check the board and memory",
        text: "Open the web workspace — the card is on the kanban, and context stays available to teammates and agents.",
      },
    ],
  });

  return (
    <>
      <MarketingJsonLd
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        breadcrumbs={guideBreadcrumbs("Manage tasks from WhatsApp", PATH)}
        extra={howTo}
      />
      <MarketingArticle title={TITLE} description={DESCRIPTION}>
        <p>
          Small teams already live in WhatsApp. The problem is not chat — it is
          that decisions and tasks vanish into scrollback. Euclis gives you a{" "}
          <strong>private 1:1 bot</strong> that updates the shared workspace
          board (and feeds project memory) without turning your group chat into
          a bot thread.
        </p>

        <h2>Not a WhatsApp group bot</h2>
        <p>
          Tools like TaskRio add a bot <em>into</em> the group and require
          @mentions. Euclis works differently: each person messages the bot in a
          private chat. The group stays human. Everyone still sees the same
          kanban and memory on the web.
        </p>

        <h2>Setup</h2>
        <ol>
          <li>
            <Link href="/signup" className="font-medium text-ink underline">
              Create a free Euclis account
            </Link>{" "}
            (email only).
          </li>
          <li>Create a workspace and invite teammates.</li>
          <li>Link your number under Settings → WhatsApp.</li>
          <li>
            Text: <em>add task: fix login API, assign me, due tonight</em>
          </li>
          <li>Open the board — the card is there, live.</li>
        </ol>

        <h2>Example commands</h2>
        <ul>
          <li>
            <strong>Create:</strong> &quot;add task: book venue, high priority&quot;
          </li>
          <li>
            <strong>Update:</strong> &quot;move #12 to done&quot;
          </li>
          <li>
            <strong>Check:</strong> &quot;what&apos;s on the board?&quot;
          </li>
          <li>
            <strong>Files:</strong> send a photo with caption{" "}
            <em>#42 booth mockup</em>
          </li>
        </ul>

        <h2>How this fits the bigger product</h2>
        <p>
          WhatsApp is one capture surface. The same workspace holds discussions,
          Dreaming memory, and MCP for agents. See{" "}
          <Link
            href="/guides/project-memory-dreaming"
            className="font-medium text-ink underline"
          >
            project memory &amp; Dreaming
          </Link>{" "}
          for the full story.
        </p>
      </MarketingArticle>
    </>
  );
}
