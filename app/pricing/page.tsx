import { buildPageMetadata } from "@/lib/seo/metadata";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import type { PlanTier } from "@/lib/generated/prisma/client";
import { planLimits, planLabel } from "@/lib/billing/plans";
import { createSupabaseServer } from "@/lib/supabase-server";
import { TeamTrialCta } from "@/components/pricing/team-trial-cta";

export const metadata = buildPageMetadata({
  title: "Pricing",
  description:
    "Hobby free forever for small teams. Team adds curated Dreaming memory and collaboration features — start a free trial, no credit card.",
  path: "/pricing",
});

const BUSINESS_CONTACT_EMAIL = "euclis.support@gmail.com";

/** Feature bullets derived from the single source of truth (lib/billing/plans.ts). */
function featuresFor(tier: PlanTier): string[] {
  const l = planLimits(tier);
  const cap = (n: number | null) => (n === null ? "Unlimited" : `${n}`);

  const features = [
    `${cap(l.maxMembers)} members per workspace`,
    l.maxWorkspacesLed === null
      ? "Unlimited workspaces"
      : `${l.maxWorkspacesLed} workspace${l.maxWorkspacesLed === 1 ? "" : "s"} you can lead`,
    l.maxOpenDiscussions === null
      ? "Unlimited discussions"
      : `${l.maxOpenDiscussions} open discussions`,
    "WhatsApp assistant",
    l.maxMcpScope === "full" ? "Full MCP access" : "Context MCP access",
    // Memory: raw capture (Hobby) vs the curated, tended store (Team+).
    l.curatedMemory
      ? "Curated project memory — dedupe, contradiction resolution & insights"
      : "Raw memory capture",
    l.memoryRetentionDays === null
      ? "Unlimited memory retention"
      : `${l.memoryRetentionDays}-day memory retention`,
    // Ambient coding-agent seats (editor hooks).
    l.ambientAgentSeats === null
      ? "Unlimited coding-agent seats"
      : `${l.ambientAgentSeats} connected coding-agent seat${l.ambientAgentSeats === 1 ? "" : "s"}`,
  ];

  if (l.onboardingBrief) {
    features.push("New-member onboarding brief + history backfill");
  }
  if (l.blockerRouting) {
    features.push("Automatic blocker routing to assignees");
  }
  if (l.leaderAnalytics) {
    features.push("Leader analytics dashboard");
  }
  if (l.guestAccess) {
    features.push("Guest & client access");
  }
  if (l.customSubdomain) features.push("Custom subdomain");
  if (l.sso) features.push("SSO (single sign-on)");
  return features;
}

const TIER_TAGLINE: Record<PlanTier, string> = {
  HOBBY: "For hackathons, side projects, and study groups.",
  TEAM: "For teams that have outgrown small and informal.",
  BUSINESS: "For organizations that need branding, SSO, and scale.",
};

const TIER_PRICE: Record<PlanTier, string> = {
  HOBBY: "Free forever",
  TEAM: "Free 14-day trial",
  BUSINESS: "Custom",
};

const ctaBase =
  "inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition";
const ctaPrimary = `${ctaBase} bg-ink text-white shadow-sm hover:bg-ink/90`;
const ctaSecondary = `${ctaBase} border border-line-strong bg-paper text-ink-soft hover:border-ink/20 hover:text-ink`;

export default async function PricingPage() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const isAuthed = Boolean(data?.claims?.sub);

  const tiers: PlanTier[] = ["HOBBY", "TEAM", "BUSINESS"];

  return (
    <div className="min-h-screen bg-shell">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/euclis-logo-64.webp"
            alt="Euclis"
            width={32}
            height={32}
            className="rounded-md ring-1 ring-line/80"
          />
          <span className="text-base font-semibold tracking-tight text-ink">
            Euclis
          </span>
        </Link>
        <Link
          href={isAuthed ? "/dashboard" : "/login?next=/pricing"}
          className="text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          {isAuthed ? "Dashboard" : "Sign in"}
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Simple pricing that grows with your team
          </h1>
          <p className="mt-3 text-lg text-ink-soft">
            Free forever for small, informal teams. Upgrade only when you
            outgrow it — no credit card to start.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => {
            const highlighted = tier === "TEAM";
            return (
              <div
                key={tier}
                className={`flex flex-col rounded-2xl border bg-paper p-6 shadow-sm ${
                  highlighted
                    ? "border-ink/30 ring-1 ring-ink/10"
                    : "border-line"
                }`}
              >
                {highlighted ? (
                  <span className="mb-3 inline-flex w-fit rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                    Most popular
                  </span>
                ) : null}

                <h2 className="text-lg font-semibold text-ink">
                  {planLabel(tier)}
                </h2>
                <p className="mt-1 min-h-[2.5rem] text-sm text-ink-soft">
                  {TIER_TAGLINE[tier]}
                </p>

                <div className="mt-4">
                  <span className="text-2xl font-semibold tracking-tight text-ink">
                    {TIER_PRICE[tier]}
                  </span>
                </div>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {featuresFor(tier).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-ink-soft">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-ink"
                        strokeWidth={2}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {tier === "HOBBY" ? (
                    <Link
                      href={isAuthed ? "/dashboard" : "/signup"}
                      className={ctaSecondary}
                    >
                      {isAuthed ? "Go to dashboard" : "Get started"}
                    </Link>
                  ) : tier === "TEAM" ? (
                    <TeamTrialCta isAuthed={isAuthed} className={ctaPrimary} />
                  ) : (
                    <a
                      href={`mailto:${BUSINESS_CONTACT_EMAIL}?subject=${encodeURIComponent(
                        "Euclis Business plan"
                      )}`}
                      className={ctaSecondary}
                    >
                      Contact us
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-ink-faint">
          Trials are free with no card required. WhatsApp and Claude/MCP access
          are included on every plan.
        </p>
      </main>
    </div>
  );
}
