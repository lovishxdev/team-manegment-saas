"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  /** Shorter label for the closed trigger when the menu label is wider. */
  triggerLabel?: string;
};

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-4 w-4 shrink-0 text-ink"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M3.5 8.2 6.2 10.8 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Matches `ui.input` border, radius, and focus treatment. */
const fieldCls =
  "border border-line bg-paper outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 " +
  "hover:-translate-y-px hover:border-ink/30 hover:bg-white hover:shadow-[0_4px_14px_rgba(26,26,26,0.1),0_0_0_1px_rgba(26,26,26,0.05)] " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:bg-paper disabled:hover:shadow-none";
const fieldOpenCls =
  "-translate-y-px border-ink/40 bg-white shadow-[0_4px_16px_rgba(26,26,26,0.1),0_0_0_4px_rgba(26,26,26,0.12)]";

const sizeCls = {
  sm: {
    trigger: "min-h-[36px] gap-2 rounded-lg px-3 py-2 text-sm",
    menu: "p-1.5",
    item: "gap-2 rounded-md px-2.5 py-2 text-sm",
  },
  md: {
    trigger: "min-h-[46px] gap-2 rounded-lg px-3.5 py-3 text-[15px]",
    menu: "p-2",
    item: "gap-2.5 rounded-lg px-3 py-2.5 text-[15px]",
  },
  lg: {
    trigger: "min-h-[52px] gap-2 rounded-lg px-4 py-3.5 text-base",
    menu: "p-2",
    item: "gap-2.5 rounded-lg px-3 py-2.5 text-[15px]",
  },
} as const;

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  size = "md",
  name,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  name?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const styles = sizeCls[size];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-50 ${fieldCls} ${styles.trigger} ${
          open ? fieldOpenCls : ""
        }`}
      >
        <span className={selected ? "truncate font-medium text-ink" : "truncate text-ink-soft"}>
          {selected?.triggerLabel ?? selected?.label ?? placeholder}
        </span>
        <ChevronDown open={open} />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute left-0 top-full z-50 mt-1.5 max-h-60 min-w-full w-max overflow-auto rounded-lg border border-line bg-paper ${styles.menu}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || "__empty"} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => pick(option.value)}
                  className={`flex w-full items-center text-left transition ${styles.item} ${
                    isSelected
                      ? "bg-ink/[0.06] font-medium text-ink"
                      : "text-ink-soft hover:bg-ink/[0.04] hover:text-ink"
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {isSelected ? <CheckIcon /> : null}
                  </span>
                  <span className="whitespace-nowrap">{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
