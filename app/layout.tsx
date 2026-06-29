import type { Metadata } from "next";
import {
  Caveat,
  Hanken_Grotesk,
  Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instruments-serif",
  weight: "400",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Euclis | Where your team's work flows together",
    template: "%s · Euclis",
  },
  description:
    "One workspace, three doors: a web dashboard, a WhatsApp assistant, and a Claude connector. Euclis keeps your team's tasks in order wherever the conversation happens.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      {
        url: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
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
        <div className="app-root relative z-[2] min-h-screen">{children}</div>
      </body>
    </html>
  );
}
