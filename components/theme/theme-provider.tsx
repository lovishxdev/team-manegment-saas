"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  THEME_COOKIE,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  /** The user's stored choice: light, dark, or follow system. */
  preference: ThemePreference;
  /** The theme actually applied right now. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolvePreference(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return preference;
}

export function ThemeProvider({
  initialPreference = "system",
  children,
}: {
  initialPreference?: ThemePreference;
  children: React.ReactNode;
}) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(initialPreference);
  // Deterministic initial value (no matchMedia) so server and first client
  // render agree. `system` resolves after mount in the effect below; the actual
  // painted theme is handled pre-paint by the inline no-flash script.
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    initialPreference === "dark" ? "dark" : "light",
  );

  const apply = useCallback((next: ThemePreference) => {
    const nextResolved = resolvePreference(next);
    setResolved(nextResolved);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = nextResolved;
    }
  }, []);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      apply(next);
    },
    [apply],
  );

  // Reconcile the DOM with state (covers the no-flash script) and, when
  // following the system, react live to OS color-scheme changes.
  useEffect(() => {
    apply(preference);
    if (preference !== "system" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference, apply]);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
