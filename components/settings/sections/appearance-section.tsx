"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import type { ThemePreference } from "@/lib/theme";
import { ui } from "@/components/ui/ui";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { value: "light", label: "Light", hint: "Always light", icon: Sun },
  { value: "dark", label: "Dark", hint: "Always dark", icon: Moon },
  {
    value: "system",
    label: "System",
    hint: "Match your device",
    icon: Monitor,
  },
];

export function AppearanceSection() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <div className="space-y-5">
      <div>
        <p className={ui.label}>Theme</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
            const active = preference === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPreference(value)}
                aria-pressed={active}
                className={`flex flex-col items-start gap-2 rounded-xl border px-4 py-3.5 text-left transition ${
                  active
                    ? "border-ink/40 bg-paper shadow-[0_0_0_1px_rgba(26,26,26,0.06)] dark:border-white/30"
                    : "border-line bg-paper hover:border-ink/25 dark:hover:border-white/20"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  {label}
                </span>
                <span className="text-xs text-ink-faint">{hint}</span>
              </button>
            );
          })}
        </div>
        <p className={ui.fieldHint}>
          {preference === "system"
            ? `Following your device — currently ${resolved}.`
            : `The app is set to ${preference} on this device.`}{" "}
          The marketing site always stays light.
        </p>
      </div>
    </div>
  );
}
