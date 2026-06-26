/** Dial codes for the country picker (E.164 without +). India first, then alphabetical. */
export type PhoneCountry = {
  iso: string;
  name: string;
  dial: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "IN", name: "India", dial: "91" },
  { iso: "US", name: "United States", dial: "1" },
  { iso: "CA", name: "Canada", dial: "1" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "AU", name: "Australia", dial: "61" },
  { iso: "AE", name: "United Arab Emirates", dial: "971" },
  { iso: "AR", name: "Argentina", dial: "54" },
  { iso: "AT", name: "Austria", dial: "43" },
  { iso: "BD", name: "Bangladesh", dial: "880" },
  { iso: "BE", name: "Belgium", dial: "32" },
  { iso: "BR", name: "Brazil", dial: "55" },
  { iso: "CH", name: "Switzerland", dial: "41" },
  { iso: "CL", name: "Chile", dial: "56" },
  { iso: "CN", name: "China", dial: "86" },
  { iso: "CO", name: "Colombia", dial: "57" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "EG", name: "Egypt", dial: "20" },
  { iso: "ES", name: "Spain", dial: "34" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "HK", name: "Hong Kong", dial: "852" },
  { iso: "ID", name: "Indonesia", dial: "62" },
  { iso: "IE", name: "Ireland", dial: "353" },
  { iso: "IL", name: "Israel", dial: "972" },
  { iso: "IT", name: "Italy", dial: "39" },
  { iso: "JP", name: "Japan", dial: "81" },
  { iso: "KE", name: "Kenya", dial: "254" },
  { iso: "KR", name: "South Korea", dial: "82" },
  { iso: "LK", name: "Sri Lanka", dial: "94" },
  { iso: "MX", name: "Mexico", dial: "52" },
  { iso: "MY", name: "Malaysia", dial: "60" },
  { iso: "NG", name: "Nigeria", dial: "234" },
  { iso: "NL", name: "Netherlands", dial: "31" },
  { iso: "NO", name: "Norway", dial: "47" },
  { iso: "NZ", name: "New Zealand", dial: "64" },
  { iso: "PH", name: "Philippines", dial: "63" },
  { iso: "PK", name: "Pakistan", dial: "92" },
  { iso: "PL", name: "Poland", dial: "48" },
  { iso: "PT", name: "Portugal", dial: "351" },
  { iso: "QA", name: "Qatar", dial: "974" },
  { iso: "RU", name: "Russia", dial: "7" },
  { iso: "SA", name: "Saudi Arabia", dial: "966" },
  { iso: "SE", name: "Sweden", dial: "46" },
  { iso: "SG", name: "Singapore", dial: "65" },
  { iso: "TH", name: "Thailand", dial: "66" },
  { iso: "TR", name: "Turkey", dial: "90" },
  { iso: "TW", name: "Taiwan", dial: "886" },
  { iso: "UA", name: "Ukraine", dial: "380" },
  { iso: "VN", name: "Vietnam", dial: "84" },
  { iso: "ZA", name: "South Africa", dial: "27" },
];

const byDialLength = [...PHONE_COUNTRIES].sort(
  (a, b) => b.dial.length - a.dial.length
);

export function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}

export function defaultDialCode(): string {
  if (typeof navigator === "undefined") return "91";
  const locale = navigator.language.toUpperCase();
  const region = locale.split("-")[1];
  const match = region
    ? PHONE_COUNTRIES.find((c) => c.iso === region)
    : undefined;
  return match?.dial ?? "91";
}

/** Split stored E.164 (no +) into dial code + local digits. */
export function parseStoredPhone(
  phone: string | null | undefined,
  fallbackDial = "91"
): { dial: string; national: string } {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (!digits) return { dial: fallbackDial, national: "" };

  for (const country of byDialLength) {
    if (digits.startsWith(country.dial)) {
      return {
        dial: country.dial,
        national: digits.slice(country.dial.length),
      };
    }
  }

  return { dial: fallbackDial, national: digits };
}

/** Merge picker values into E.164 digits (no +). Empty national → empty string. */
export function combinePhone(dial: string, national: string): string {
  const local = normalizeNationalNumber(national);
  if (!local) return "";
  const code = dial.replace(/\D/g, "");
  return `${code}${local}`;
}

export function normalizeNationalNumber(national: string): string {
  let digits = national.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  return digits;
}

export function formatPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const { dial, national } = parseStoredPhone(phone);
  if (!national) return `+${dial}`;
  return `+${dial} ${national}`;
}
