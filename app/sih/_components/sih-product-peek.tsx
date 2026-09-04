"use client";

import { DashboardPreview } from "@/app/landing/_components/dashboard-preview";
import { LandingStyles } from "@/app/landing/_components/landing-styles";
import { WhatsAppDemo } from "@/app/landing/_components/whatsapp-demo";

/** Product peeks for SIH: WhatsApp edge + full workspace preview. No signup. */
export function SihProductPeek() {
  return (
    <div className="space-y-10">
      <LandingStyles />

      <div>
        <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          WhatsApp → shared board · no signup
        </p>
        <p className="mb-4 text-[14px] leading-snug text-ink-soft">
          Message Euclis in plain English from the phone you already have open
          during SIH. Tasks and decisions land on the team board instantly.
        </p>
        <WhatsAppDemo />
      </div>

      <div>
        <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Full workspace · board + whiteboard
        </p>
        <DashboardPreview />
      </div>
    </div>
  );
}
