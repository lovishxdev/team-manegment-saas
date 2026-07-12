import { loadFont as loadHanken } from "@remotion/google-fonts/HankenGrotesk";
import { loadFont as loadInstrument } from "@remotion/google-fonts/InstrumentSerif";

/**
 * Hanken Grotesk — the Euclis app/landing sans (`--font-sans` / wordmark).
 * Instrument Serif — the landing display serif used on dreaming headlines and
 * step labels (`font-serif` / `--font-instruments-serif`).
 */
const hanken = loadHanken("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

const instrument = loadInstrument("normal", {
  weights: ["400"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

// Italic face for “It dreams.” on the landing headline.
loadInstrument("italic", {
  weights: ["400"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

/** Display + body sans. */
export const FONT = hanken.fontFamily;

/** Brand wordmark (same family). */
export const BRAND = hanken.fontFamily;

/** Landing serif (dreaming headline + step labels). */
export const SERIF = instrument.fontFamily;
