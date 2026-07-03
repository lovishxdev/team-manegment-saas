import { Caveat, Instrument_Serif } from "next/font/google";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instruments-serif",
  weight: "400",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["500", "600"],
  display: "swap",
});

/** Loads display fonts only on marketing pages — not on /dashboard or workspace routes. */
export function MarketingFonts({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${instrumentSerif.variable} ${caveat.variable}`}>
      {children}
    </div>
  );
}
