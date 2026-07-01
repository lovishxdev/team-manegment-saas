import { redirect } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  faqPageJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/seo/site";
import { LandingContent } from "./landing/_components/landing-content";

/**
 * The marketing homepage.
 *
 * Signed-in users are sent straight to `/dashboard` so they never see
 * the marketing surface. Everyone else gets the full landing experience
 * (the same body rendered at `/landing`).
 */
export const metadata = buildPageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
  ogImageAlt: "Euclis — free team task board with WhatsApp and Claude MCP",
});

export default async function Home() {
  // Only attempt the Supabase auth check when credentials are configured.
  // Without them, `createSupabaseServer` throws — we'd rather render the
  // marketing site for previewing/screenshots than crash the homepage.
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <>
      <JsonLd
        data={[
          websiteJsonLd(),
          organizationJsonLd(),
          softwareApplicationJsonLd(),
          faqPageJsonLd(),
        ]}
      />
      <LandingContent />
    </>
  );
}
