import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MarketingDemoStyles } from "@/marketing/social/_styles/demo-styles";

export const metadata: Metadata = {
  title: "Marketing demos",
  robots: { index: false, follow: false },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingDemoStyles />
      {children}
    </>
  );
}
