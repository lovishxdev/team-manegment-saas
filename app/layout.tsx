import type { Metadata } from "next";
import {
  Caveat,
  Hanken_Grotesk,
  Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
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
        <div className="app-root relative z-[2] min-h-screen">{children}</div>
      </body>
    </html>
  );
}
