import { MarketingArticle } from "@/components/seo/marketing-article";
import { buildPageMetadata } from "@/lib/seo/metadata";

const PATH = "/privacy";

export const metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "Euclis privacy policy — how we handle account data, workspace content, and WhatsApp integration for our free team task board.",
  path: PATH,
});

export default function PrivacyPage() {
  return (
    <MarketingArticle
      title="Privacy Policy"
      description="Last updated: July 2026. This policy describes how Euclis (euclis.dev) collects and uses information."
    >
      <p>
        Euclis (&quot;we&quot;, &quot;us&quot;) operates a free team task board
        at euclis.dev. This policy explains what data we collect and why.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> email, username, and authentication
          credentials when you sign up.
        </li>
        <li>
          <strong>Workspace data:</strong> tasks, boards, assets, links, and
          whiteboard content you create in your workspaces.
        </li>
        <li>
          <strong>WhatsApp:</strong> if you link a phone number, we store it to
          route bot messages. Message content is processed to execute task
          commands and may be retained in conversation history for context.
        </li>
        <li>
          <strong>Usage analytics:</strong> aggregated page views via Google
          Analytics and Vercel Analytics on production.
        </li>
      </ul>

      <h2>How we use information</h2>
      <p>
        We use your data to provide the service — sync tasks across web,
        WhatsApp, and Claude MCP; authenticate you; and improve reliability. We
        do not sell personal data.
      </p>

      <h2>Third-party services</h2>
      <p>
        Euclis uses Supabase (auth), hosting on Vercel, Meta WhatsApp Cloud API,
        and Anthropic Claude for natural-language parsing. Each provider has its
        own privacy terms.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        You may delete your account from Settings. Workspace data associated
        with your account is removed according to our deletion workflow.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy: sign in and use in-app support channels, or
        contact us through euclis.dev.
      </p>
    </MarketingArticle>
  );
}
