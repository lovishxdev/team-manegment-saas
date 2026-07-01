import { MarketingArticle } from "@/components/seo/marketing-article";
import { buildPageMetadata } from "@/lib/seo/metadata";

const PATH = "/terms";

export const metadata = buildPageMetadata({
  title: "Terms of Service",
  description:
    "Euclis terms of service for the free team task board — acceptable use, accounts, and service availability.",
  path: PATH,
});

export default function TermsPage() {
  return (
    <MarketingArticle
      title="Terms of Service"
      description="Last updated: July 2026. By using Euclis you agree to these terms."
    >
      <p>
        Euclis provides a free team task management service at euclis.dev,
        including web dashboard, optional WhatsApp integration, and Claude MCP
        connector.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for your account credentials and activity in your
        workspaces. You must provide accurate information at signup.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not use Euclis for unlawful activity, spam, abuse of the WhatsApp or
        Claude APIs, or attempts to compromise other users&apos; data. We may
        suspend accounts that violate these terms.
      </p>

      <h2>Service availability</h2>
      <p>
        Euclis is provided as-is during beta and free-tier operation. We aim for
        high availability but do not guarantee uninterrupted service. Features
        may change as the product evolves.
      </p>

      <h2>Free tier</h2>
      <p>
        The free tier is offered without credit card requirement. We may
        introduce paid plans in the future with notice; existing free access
        terms will be communicated before changes affect you.
      </p>

      <h2>Intellectual property</h2>
      <p>
        You retain ownership of content you upload. You grant Euclis the rights
        needed to host and display that content to your workspace members.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, Euclis is not liable for indirect or
        consequential damages arising from use of the service.
      </p>
    </MarketingArticle>
  );
}
