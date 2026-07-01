import Link from "next/link";
import { MarketingArticle } from "@/components/seo/marketing-article";
import { MarketingJsonLd } from "@/components/seo/marketing-json-ld";
import { guideBreadcrumbs, howToJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "How to manage team tasks from WhatsApp (free guide)";
const DESCRIPTION =
  "Learn how to run a shared kanban board from WhatsApp with natural-language commands. Free setup with Euclis — no new app, no credit card.";
const PATH = "/guides/manage-tasks-from-whatsapp";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default function ManageTasksFromWhatsAppGuide() {
  const howTo = howToJsonLd({
    name: "Set up WhatsApp task management with Euclis",
    description: DESCRIPTION,
    path: PATH,
    steps: [
      {
        name: "Create a free account",
        text: "Sign up at euclis.dev with email only — no credit card or phone required.",
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
        name: "Send your first task",
        text: 'Message the bot: "add task: fix landing page copy, due Friday".',
      },
      {
        name: "Verify on the web board",
        text: "Open the kanban dashboard — the card appears live-synced for the whole team.",
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
          Most small teams already coordinate in WhatsApp. The problem is not
          chat — it is that tasks, deadlines, and files scatter across messages
          nobody can search later. A{" "}
          <strong>free WhatsApp task management</strong> setup gives you a real
          board behind the chat, so &quot;done&quot; actually means done on the
          kanban too.
        </p>

        <h2>Why WhatsApp-native task management works</h2>
        <p>
          Your team checks WhatsApp dozens of times a day. Asking everyone to
          adopt another heavy PM tool means slow adoption and stale boards.
          Tools that meet people in WhatsApp — while keeping a proper web
          dashboard — solve the sync problem without a training day.
        </p>

        <h2>Euclis vs a WhatsApp group bot</h2>
        <p>
          Some tools (like TaskRio) add a bot <em>into</em> your WhatsApp group.
          You @mention the bot, it posts task cards in the thread, and the group
          admin must approve the integration.
        </p>
        <p>
          Euclis works differently: each teammate messages the Euclis bot in a{" "}
          <strong>private 1:1 chat</strong>. Plain English updates the shared
          workspace board everyone sees on the web. Your group chat stays human —
          no bot interrupting standup banter.
        </p>

        <h2>Step-by-step: free setup in under 2 minutes</h2>
        <ol>
          <li>
            <Link href="/signup" className="font-medium text-ink underline">
              Create a free Euclis account
            </Link>{" "}
            with email only — no credit card, no phone required yet.
          </li>
          <li>Create a workspace and invite teammates from the dashboard.</li>
          <li>
            Under Settings → WhatsApp, link your phone number to the bot.
          </li>
          <li>
            Message the bot: <em>add task: fix landing page copy, due Friday</em>
          </li>
          <li>
            Open the web kanban — the card is already there, live-synced.
          </li>
        </ol>

        <h2>Example commands that work</h2>
        <ul>
          <li>
            <strong>Create:</strong> &quot;add task: book venue for hackathon,
            high priority&quot;
          </li>
          <li>
            <strong>Update:</strong> &quot;move #12 to done&quot; or &quot;make
            #12 high priority&quot;
          </li>
          <li>
            <strong>Check status:</strong> &quot;what&apos;s on the board?&quot;
          </li>
          <li>
            <strong>Files:</strong> send a photo with caption{" "}
            <em>#42 booth mockup</em> — it attaches to task #42 and appears in
            workspace assets.
          </li>
        </ul>

        <h2>Three doors, one board</h2>
        <p>
          WhatsApp is one door. Teammates who prefer a laptop use the web
          kanban (drag-and-drop, whiteboard, assets). Developers using Claude
          connect via MCP and manage the same tasks mid-conversation. Every
          change hits the same Postgres row —{" "}
          <strong>same board, same truth</strong>.
        </p>

        <h2>Who this is for</h2>
        <p>
          Hackathon squads, study groups, side-project cofounders, hostel event
          committees — any small team that lives in chat and wants a{" "}
          <strong>free team task board</strong> without enterprise PM overhead.
        </p>
      </MarketingArticle>
    </>
  );
}
