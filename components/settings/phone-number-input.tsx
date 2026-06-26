"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { ui } from "@/components/ui/ui";
import {
  PHONE_COUNTRIES,
  combinePhone,
  defaultDialCode,
  flagEmoji,
  parseStoredPhone,
} from "@/lib/phone-countries";

const countryOptions = PHONE_COUNTRIES.map((c) => ({
  value: c.dial,
  triggerLabel: `${flagEmoji(c.iso)} +${c.dial}`,
  label: `${flagEmoji(c.iso)} +${c.dial} ${c.name}`,
}));

export function PhoneNumberInput({
  name = "phone",
  defaultPhone,
  disabled,
  required,
  nationalPlaceholder = "Phone number",
  nationalAriaLabel = "Mobile number",
}: {
  name?: string;
  defaultPhone?: string | null;
  disabled?: boolean;
  required?: boolean;
  nationalPlaceholder?: string;
  nationalAriaLabel?: string;
}) {
  const parsed = parseStoredPhone(defaultPhone, "91");
  const [dial, setDial] = useState(parsed.dial);
  const [national, setNational] = useState(parsed.national);

  useEffect(() => {
    if (!defaultPhone) setDial(defaultDialCode());
  }, [defaultPhone]);

  const storedValue = useMemo(
    () => combinePhone(dial, national),
    [dial, national]
  );

  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <Select
        value={dial}
        onChange={setDial}
        options={countryOptions}
        disabled={disabled}
        aria-label="Country code"
        className="w-[6.75rem] shrink-0"
      />
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        required={required && !defaultPhone}
        value={national}
        onChange={(e) => setNational(e.target.value)}
        placeholder={nationalPlaceholder}
        aria-label={nationalAriaLabel}
        className={`${ui.input} min-w-0 flex-1`}
      />
      <input type="hidden" name={name} value={storedValue} />
    </div>
  );
}
