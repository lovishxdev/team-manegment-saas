import type { Metadata } from "next";
import { LandingContent } from "./_components/landing-content";

/**
 * `/landing` is kept as an alias for the marketing site so existing links
 * keep working. The same content also renders at `/` for signed-out
 * users (see `app/page.tsx`).
 */
export const metadata: Metadata = {
  title: "Euclis — run your team from anywhere, even WhatsApp",
  description:
    "A shared task board your team can reach from anywhere the conversation happens — the web dashboard, a WhatsApp message, or a chat with Claude. Built for hackathons, side projects, hostel fests, study groups and every small team in between.",
};

export default function LandingRoute() {
  return <LandingContent />;
}
