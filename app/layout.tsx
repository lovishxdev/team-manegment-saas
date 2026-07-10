import {
  Caveat,
  Hanken_Grotesk,
  Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { rootMetadata } from "@/lib/seo/metadata";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instruments-serif",
  weight: "400",
  adjustFontFallback: true,
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["500", "600"],
  display: "swap",
});

export const metadata = {
  ...rootMetadata,
  icons: {
    icon: [
      {
        url: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${jetbrains.variable} ${instrumentSerif.variable} ${caveat.variable}`}
    >
      <body className="min-h-screen app-shell-bg">
        <GoogleAnalytics />
        <PostHogProvider />
        <Analytics />
        <SpeedInsights />
        <div className="app-root relative z-[2] min-h-screen">{children}</div>
      </body>
    </html>
  );
}
