"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { Spinner } from "@/components/ui/loading";
import { useClientMounted } from "@/lib/use-client-mounted";
import { AccountSettingsSectionBody } from "@/components/settings/account-settings-section-body";
import {
  ACCOUNT_SETTINGS_NAV,
  ACCOUNT_SETTINGS_NAV_GROUPS,
  ACCOUNT_SETTINGS_SECTION_META,
  accountSettingsPath,
  consumeSettingsReturnPath,
  isAccountSettingsPath,
  sectionFromPathname,
  type AccountSettingsSection,
} from "@/lib/account-settings";
import type { AccountSettingsData } from "@/lib/settings/load-account-settings";

type AccountSettingsContextValue = {
  setData: (data: AccountSettingsData | null) => void;
};

const AccountSettingsContext = createContext<AccountSettingsContextValue | null>(
  null
);

function filterNavItems(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return ACCOUNT_SETTINGS_NAV;

  return ACCOUNT_SETTINGS_NAV.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.includes(q))
  );
}

function SettingsSidebar({
  active,
  search,
  onSearchChange,
  onNavigate,
}: {
  active: AccountSettingsSection;
  search: string;
  onSearchChange: (value: string) => void;
  onNavigate: (section: AccountSettingsSection) => void;
}) {
  const items = useMemo(() => filterNavItems(search), [search]);

  return (
    <aside className="flex max-h-48 min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-line bg-paper-deep/25 sm:max-h-none sm:h-full sm:w-56 sm:border-b-0 sm:border-r lg:w-60">
      <div className="shrink-0 p-3 sm:p-4 sm:pb-3">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.75}
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search"
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint outline-none transition focus:border-ink/30 focus:shadow-[0_0_0_3px_rgba(26,26,26,0.08)]"
          />
        </label>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4"
        aria-label="Settings"
      >
        {items.length === 0 ? (
          <p className="px-2.5 py-2 text-sm text-ink-faint">No matches.</p>
        ) : (
          ACCOUNT_SETTINGS_NAV_GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.group === group.id);
            if (groupItems.length === 0) return null;

            return (
              <div key={group.id} className="mb-4 last:mb-0">
                <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {groupItems.map(({ id, label, icon: Icon }) => {
                    const isActive = active === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onNavigate(id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-paper font-medium text-ink shadow-[0_1px_3px_rgba(26,26,26,0.06),0_0_0_1px_rgba(26,26,26,0.04)]"
                            : "text-ink-soft hover:bg-paper/70 hover:text-ink"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon
                          className="h-4 w-4 shrink-0 opacity-70"
                          strokeWidth={1.75}
                        />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </nav>
    </aside>
  );
}

function SectionFallback() {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center">
      <Spinner />
    </div>
  );
}

function AccountSettingsOverlay({
  section,
  data,
  onClose,
  onNavigate,
}: {
  section: AccountSettingsSection;
  data: AccountSettingsData | null;
  onClose: () => void;
  onNavigate: (section: AccountSettingsSection) => void;
}) {
  const [navSearch, setNavSearch] = useState("");
  const mounted = useClientMounted();
  const meta = ACCOUNT_SETTINGS_SECTION_META[section];

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
    <>
      <div
        className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        <div
          className="pointer-events-auto relative flex h-[min(40rem,calc(100dvh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_80px_rgba(26,26,26,0.22)] sm:flex-row"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Account settings"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 rounded-md p-1.5 text-ink-faint transition hover:text-ink sm:right-4 sm:top-4"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>

          <SettingsSidebar
            active={section}
            search={navSearch}
            onSearchChange={setNavSearch}
            onNavigate={onNavigate}
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 border-b border-line px-5 py-4 pr-14 sm:px-6 sm:pr-16">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  {meta.title}
                </h2>
                {meta.subtitle ? (
                  <p className="mt-0.5 text-sm text-ink-soft">{meta.subtitle}</p>
                ) : null}
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
              <div className="min-h-0 flex-1">
                {data ? (
                  <AccountSettingsSectionBody section={section} data={data} />
                ) : (
                  <SectionFallback />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export function AccountSettingsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<AccountSettingsData | null>(null);

  const open = isAccountSettingsPath(pathname);
  const section = open ? sectionFromPathname(pathname) : "profile";

  const setDataStable = useCallback((next: AccountSettingsData | null) => {
    setData(next);
  }, []);

  const close = useCallback(() => {
    router.push(consumeSettingsReturnPath());
  }, [router]);

  const navigate = useCallback(
    (next: AccountSettingsSection) => {
      if (next === section) return;
      router.replace(accountSettingsPath(next), { scroll: false });
    },
    [router, section]
  );

  const contextValue = useMemo(
    () => ({ setData: setDataStable }),
    [setDataStable]
  );

  useEffect(() => {
    if (!open) setData(null);
  }, [open]);

  return (
    <AccountSettingsContext.Provider value={contextValue}>
      {children}
      {open ? (
        <AccountSettingsOverlay
          section={section}
          data={data}
          onClose={close}
          onNavigate={navigate}
        />
      ) : null}
    </AccountSettingsContext.Provider>
  );
}

/** Pushes server-loaded settings data into the app-wide overlay. */
export function AccountSettingsDataBridge({
  data,
}: {
  data: AccountSettingsData;
}) {
  const context = useContext(AccountSettingsContext);

  useLayoutEffect(() => {
    if (!context) return;
    context.setData(data);
    return () => context.setData(null);
  }, [context, data]);

  return null;
}
