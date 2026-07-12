import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Euclis demo reel 2",
  robots: { index: false, follow: false },
};

export default function Demo2Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
