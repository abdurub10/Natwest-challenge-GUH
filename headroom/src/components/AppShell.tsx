"use client";
// App shell (ui-plan.md section 4). At 1024px and wider: a slim top header with the wordmark,
// Home / Plan / Ask / Settings and an "Example data" pill, then a page-scrolling 1280px column.
// Below 1024px: the original full-screen mobile layout with its own scroll area and bottom tabs.
// The transparency footer is on every screen.
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import { useAppState } from "./AppState";
import { BottomTabs, TABS } from "./BottomTabs";
import { UNDERTOW_URL } from "./NearbyCard";

function TopNav() {
  const pathname = usePathname() ?? "/app";
  const { t, dir } = useAppState();
  return (
    <header className="sticky top-0 z-30 hidden border-b border-line bg-canvas lg:block" dir={dir}>
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-10 px-10">
        <Link href="/app" className="inline-flex min-h-11 items-center gap-2.5 rounded-lg text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-accent" />
          {t("app.name")}
        </Link>
        <nav aria-label={t("tabs.label")} className="h-full">
          <ul className="flex h-full items-stretch gap-1">
            {TABS.map(({ href, key, match }) => {
              const active = match(pathname);
              return (
                <li key={href} className="flex">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "relative inline-flex items-center px-3.5 text-[0.9375rem] font-medium transition-colors duration-200 ease-calm",
                      "after:absolute after:inset-x-3.5 after:bottom-[-1px] after:h-[2px] after:origin-left after:bg-accent after:transition-transform after:duration-200 after:ease-calm",
                      active ? "text-ink after:scale-x-100" : "text-muted after:scale-x-0 hover:text-ink",
                    )}
                  >
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <a
          href={UNDERTOW_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex min-h-11 items-center gap-1.5 px-3.5 text-[0.9375rem] font-medium text-muted transition-colors duration-200 ease-calm hover:text-ink"
        >
          {t("shell.areaView")}
          <ArrowUpRight aria-hidden size={16} />
        </a>
        <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[0.8125rem] text-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-muted" />
          {t("shell.example")}
        </span>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t, dir } = useAppState();

  // Start each screen at the top (mobile scrolls the inner area, desktop scrolls the page).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-dvh flex-col bg-canvas lg:block lg:h-auto lg:min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-accentInk"
      >
        Skip to content
      </a>
      <TopNav />
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin] lg:overflow-x-visible lg:overflow-y-visible"
      >
        <div className="lg:mx-auto lg:max-w-[1280px] lg:px-5">
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <footer className="px-5 pb-6 pt-8 lg:pb-10 lg:pt-14">
            <p className="border-t border-line pt-4 text-[0.875rem] leading-relaxed text-muted" dir={dir}>
              {t("footer")}
            </p>
          </footer>
        </div>
      </div>
      <div className="lg:hidden">
        <BottomTabs />
      </div>
    </div>
  );
}
