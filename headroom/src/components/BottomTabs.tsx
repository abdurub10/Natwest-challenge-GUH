"use client";
// Bottom tabs: Home, Plan, Ask, Settings. 44px+ targets, aria-current on the active tab.
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Home, ListChecks, MessageCircle, Settings, type LucideIcon } from "lucide-react";
import type { I18nKey } from "@/lib/i18n";
import { useAppState } from "./AppState";

const TABS: { href: string; key: I18nKey; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/app", key: "tabs.home", icon: Home, match: (p) => p === "/app" || p === "/app/" || p.startsWith("/app/why") },
  { href: "/app/plan", key: "tabs.plan", icon: ListChecks, match: (p) => p.startsWith("/app/plan") || p.startsWith("/app/done") },
  { href: "/app/ask", key: "tabs.ask", icon: MessageCircle, match: (p) => p.startsWith("/app/ask") },
  { href: "/app/settings", key: "tabs.settings", icon: Settings, match: (p) => p.startsWith("/app/settings") },
];

export function BottomTabs() {
  const pathname = usePathname() ?? "/app";
  const { t } = useAppState();
  return (
    <nav aria-label={t("tabs.label")} className="shrink-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, key, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 text-[0.8125rem] font-semibold transition-colors duration-200 ease-calm",
                  active ? "text-accent" : "text-muted hover:text-ink",
                )}
              >
                <span className={clsx("flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 ease-calm", active && "bg-accentSoft")}>
                  <Icon aria-hidden size={20} strokeWidth={active ? 2.25 : 2} />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
