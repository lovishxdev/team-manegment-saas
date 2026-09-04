import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { MarketingArticle } from "@/components/seo/marketing-article";
import {
  articleJsonLd,
  breadcrumbsJsonLd,
  faqPageJsonLd,
} from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SIH_FAQ } from "@/lib/seo/sih-faq";
import { ui } from "@/components/ui/ui";
import { SihProductPeek } from "./_components/sih-product-peek";

const TITLE =
  "Euclis for Smart India Hackathon 2026 | WhatsApp + Project Memory for SIH Teams";
const DESCRIPTION =
  "SIH teams already live on WhatsApp. Euclis turns those chats into a shared board and project memory so your SIH 2026 team of 6 (and your AI agents) stay aligned through the 36-hour grind.";
const PATH = "/sih";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  ogImageAlt:
    "Euclis for Smart India Hackathon 2026: WhatsApp tasks and project memory for SIH teams",
});

export default function SihPage() {
  return (
    <>
      <JsonLd
        data={[
          articleJsonLd({
            title: TITLE,
            description: DESCRIPTION,
            path: PATH,
            datePublished: "2026-09-04",
            dateModified: "2026-09-04",
          }),
          breadcrumbsJsonLd([
            { name: "Home", path: "/" },
            { name: "Smart India Hackathon 2026", path: PATH },
          ]),
          faqPageJsonLd(SIH_FAQ),
        ]}
      />
      <MarketingArticle
        title="Euclis for Smart India Hackathon 2026"
        description="WhatsApp coordination + shared project memory for SIH teams (and their AI agents)."
      >
        <div className="not-prose my-6 flex flex-wrap gap-3">
          <Link href="/signup" className={`${ui.btnPrimary} px-5 py-3`}>
            Start free →
          </Link>
          <Link href="/pricing" className={`${ui.btnSecondary} px-5 py-3`}>
            See Hobby &amp; Team trial
          </Link>
        </div>
        <p className="!mt-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          Hobby free forever · SIH team of 6 fits · WhatsApp included · no card
        </p>

        <div className="not-prose my-8">
          <SihProductPeek />
        </div>

        <p>
          Your SIH team already runs on <strong>WhatsApp</strong>: problem
          debates, 3 a.m. blockers, who owns the demo. New Claude/Cursor sessions
          still start from zero. Teammates join mid-way and need the full story.{" "}
          <strong>Euclis</strong> meets you in WhatsApp, captures decisions
          automatically, and keeps one living brief for the whole team.
        </p>

        <h2>Why Euclis fits SIH perfectly</h2>
        <p>
          SIH teams move fast: problem statements change interpretation, tech
          stacks shift, blockers appear at 3 a.m., and judges expect coherent
          progress. Most teams lose hours re-explaining decisions or hunting old
          chats. Euclis was built for exactly this environment:{" "}
          <strong>
            small teams shipping with AI in the loop under time pressure
          </strong>
          , coordinating on WhatsApp between laptop sessions.
        </p>
        <p>
          Smart India Hackathon 2026 (9th edition) runs through idea submission,
          evaluation, and a{" "}
          <strong>36-hour Grand Finale</strong> (tentatively December 2026). Teams
          are exactly <strong>6 students</strong> from the same institution,
          which maps cleanly onto Euclis Hobby (free forever, 6 seats, WhatsApp
          included).
        </p>

        <h2>SIH teams already live on WhatsApp</h2>
        <p>
          During SIH you are rarely all at a desk. Someone is in the lab,
          someone is commuting, someone is editing the PPT on a phone. A private{" "}
          <strong>1:1 WhatsApp bot</strong> (not a noisy group @mention bot) lets
          each member add tasks, log decisions, or attach a photo in plain
          English, and it lands on the <strong>shared board and memory</strong>{" "}
          the rest of the team (and your agents) see.
        </p>
        <ul>
          <li>
            &quot;add blocker: waiting on ministry API keys&quot; → structured
            blocker in memory
          </li>
          <li>
            &quot;assign me the demo script, high priority&quot; → card on the
            board with an owner
          </li>
          <li>
            Send a photo of the hardware prototype with a caption → asset tagged
            to the right task
          </li>
        </ul>
        <p>
          Setup takes a few minutes:{" "}
          <Link
            href="/guides/manage-tasks-from-whatsapp"
            className="font-medium text-ink underline"
          >
            manage tasks from WhatsApp
          </Link>
          .
        </p>

        <h2>What you get during SIH</h2>
        <ul>
          <li>
            <strong>WhatsApp assistant:</strong> private 1:1 bot included on
            Hobby. Update the board without opening a laptop.
          </li>
          <li>
            <strong>Automatic capture</strong> from WhatsApp, Claude, Cursor, and
            the web. You don&apos;t write things down twice.
          </li>
          <li>
            <strong>Shared project memory:</strong> decisions, blockers,
            milestones, and insights stay structured and current.
          </li>
          <li>
            <strong>One context for humans and agents:</strong> connect via MCP.
            Coding agents call{" "}
            <code className="font-mono text-[13px]">get_project_context</code> and
            pull the same brief your teammates see.
          </li>
          <li>
            <strong>Kanban + discussions + whiteboard</strong> in the same
            workspace so the board and the memory live together.
          </li>
          <li>
            <strong>Dreaming:</strong> while the team sleeps, Euclis merges
            duplicates, reconciles contradictions, and surfaces patterns so the
            memory stays clean (curated Dreaming on Team; raw capture on Hobby).
          </li>
        </ul>

        <h2>How SIH teams actually use it</h2>
        <ol>
          <li>
            Create a workspace the day you lock the problem statement (name it
            after your PS ID if you like).
          </li>
          <li>
            Invite all six teammates. Each person links WhatsApp under Settings,
            then messages the bot in plain English to add tasks or log decisions
            from anywhere on campus.
          </li>
          <li>Connect Claude Desktop / Claude Code / Cursor via MCP.</li>
          <li>
            Every important call (&quot;we&apos;re going with this architecture&quot;,
            &quot;blocker on API keys&quot;, &quot;milestone: MVP demo ready&quot;)
            lands in the shared memory, from WhatsApp or the web.
          </li>
          <li>
            New teammate or fresh agent session? They load the brief in under a
            minute instead of scrolling 200 WhatsApp messages.
          </li>
        </ol>

        <h2>Who it&apos;s for</h2>
        <p>
          SIH software and hardware teams of 6 that already coordinate on
          WhatsApp and are tired of context loss, especially teams using Claude,
          Cursor, or any MCP-compatible agents heavily during internal college
          hackathons and the Grand Finale.
        </p>

        <h2>SIH FAQ</h2>
        <dl className="not-prose space-y-3">
          {SIH_FAQ.map((item) => (
            <div
              key={item.question}
              className="rounded-xl border border-line bg-paper p-4 shadow-sm"
            >
              <dt className="text-[15px] font-semibold text-ink">
                {item.question}
              </dt>
              <dd className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>

        <h2>Start your SIH workspace</h2>
        <p>
          <Link href="/signup" className="font-medium text-ink underline">
            Start free →
          </Link>{" "}
          Hobby is free forever. No credit card required. Create your SIH
          workspace in under two minutes, link WhatsApp, invite your six. Want
          curated Dreaming for the finale?{" "}
          <Link href="/pricing" className="font-medium text-ink underline">
            Start a free 14-day Team trial
          </Link>
          .
        </p>
        <p className="text-[13px] text-ink-faint">
          Euclis is not affiliated with AICTE, MIC, or sih.gov.in. Official SIH
          info lives at the Smart India Hackathon portal.
        </p>
      </MarketingArticle>
    </>
  );
}
