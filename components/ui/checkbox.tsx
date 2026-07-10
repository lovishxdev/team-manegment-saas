"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

export function Checkbox({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  description?: string;
  className?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-ink/[0.04] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${className}`}
    >
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-2 transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-ink/20 peer-focus-visible:ring-offset-1 ${
            checked
              ? "border-ink bg-ink text-white dark:text-on-accent"
              : "border-line-strong bg-paper peer-hover:border-ink/35"
          }`}
        >
          {checked ? (
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          ) : null}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-sm text-ink-soft">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
