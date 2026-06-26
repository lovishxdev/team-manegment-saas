import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { LandingContent } from "./landing/_components/landing-content";

/**
 * The marketing homepage.
 *
 * Signed-in users are sent straight to `/dashboard` so they never see
 * the marketing surface. Everyone else gets the full landing experience
 * (the same body rendered at `/landing`).
 */
export const metadata: Metadata = {
  title: "Euclis | Run your team from anywhere, even WhatsApp",
  description:
    "A shared task board your team can reach from anywhere the conversation happens: the web dashboard, a WhatsApp message, or a chat with Claude. Built for hackathons, side projects, hostel fests, study groups and every small team in between.",
};

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

  return <LandingContent />;
}
