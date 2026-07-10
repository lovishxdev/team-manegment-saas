import { cookies } from "next/headers";
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
import { ThemeProvider } from "@/components/theme/theme-provider";
import { rootMetadata } from "@/lib/seo/metadata";
import { parseThemeCookie, THEME_COOKIE, THEME_INIT_SCRIPT } from "@/lib/theme";
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themePreference = parseThemeCookie(
    cookieStore.get(THEME_COOKIE)?.value,
  );

  return (
    <html
      lang="en"
      className={`${hanken.variable} ${jetbrains.variable} ${instrumentSerif.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen app-shell-bg">
        <GoogleAnalytics />
        <PostHogProvider />
        <Analytics />
        <SpeedInsights />
        <ThemeProvider initialPreference={themePreference}>
          <div className="app-root relative z-[2] min-h-screen">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
