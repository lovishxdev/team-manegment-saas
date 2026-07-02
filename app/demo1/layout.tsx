import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LandingPreviewStyles } from "@/marketing/social/_styles/landing-preview-styles";
import { MarketingDemoStyles } from "@/marketing/social/_styles/demo-styles";

export const metadata: Metadata = {
  title: "Euclis full demo",
  robots: { index: false, follow: false },
};

export default function Demo1Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingDemoStyles />
      <LandingPreviewStyles />
      {children}
    </>
  );
}
