import { buildPageMetadata } from "@/lib/seo/metadata";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/seo/site";
import { LandingContent } from "./_components/landing-content";

/**
 * `/landing` is kept as an alias for the marketing site so existing links
 * keep working. Canonical URL is `/` to avoid duplicate content in search.
 */
export const metadata = buildPageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
  index: false,
});

export default function LandingRoute() {
  return <LandingContent />;
}
