"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useClientMounted } from "@/lib/use-client-mounted";

const SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

export type AppModalSize = keyof typeof SIZE_CLASS;

export function AppModal({
  size = "lg",
  title,
  subtitle,
  onClose,
  children,
  footer,
  className = "",
  bodyClassName = "",
  labelledBy,
}: {
  size?: AppModalSize;
  title?: ReactNode;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  labelledBy?: string;
}) {
  const mounted = useClientMounted();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="app-scope contents">
      <div
        className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        <div
          className={`pointer-events-auto relative flex max-h-[min(40rem,calc(100dvh-2rem))] w-full flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_80px_rgba(26,26,26,0.22)] ${SIZE_CLASS[size]} ${className}`}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 rounded-md p-1.5 text-ink-faint transition hover:text-ink sm:right-4 sm:top-4"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>

          {title ? (
            <header className="flex shrink-0 border-b border-line px-5 py-4 pr-14 sm:px-6 sm:pr-16">
              <div className="min-w-0">
                <h2
                  id={labelledBy}
                  className="text-lg font-semibold tracking-tight text-ink"
                >
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>
                ) : null}
              </div>
            </header>
          ) : null}

          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden ${bodyClassName}`}
          >
            {children}
          </div>

          {footer ? (
            <footer className="shrink-0 border-t border-line px-5 py-4 sm:px-6">
              {footer}
            </footer>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
