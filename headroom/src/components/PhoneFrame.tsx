"use client";
// Phone frame: on screens wider than 480px the app sits in a 390 x 844 frame with a 28px radius
// on the canvas; on phones it is full screen. The frame owns the scroll area, the transparency
// footer (every screen) and the bottom tabs.
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAppState } from "./AppState";
import { BottomTabs } from "./BottomTabs";

export function PhoneFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t, dir } = useAppState();

  // One shared scroll area: start each screen at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-canvas min-[481px]:flex min-[481px]:items-center min-[481px]:justify-center min-[481px]:bg-[#EDE7DC] min-[481px]:p-4">
      <div
        data-phone-frame=""
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-canvas min-[481px]:h-[min(844px,calc(100dvh-32px))] min-[481px]:w-[390px] min-[481px]:rounded-[28px] min-[481px]:border min-[481px]:border-line min-[481px]:shadow-[0_24px_60px_-20px_rgba(27,31,29,0.28),0_2px_6px_rgba(27,31,29,0.06)]"
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-accent"
        >
          Skip to content
        </a>
        <div ref={scrollRef} id="app-scroll" className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin]">
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <footer className="px-5 pb-6 pt-8">
            <p className="border-t border-line pt-4 text-[0.875rem] leading-relaxed text-muted" dir={dir}>
              {t("footer")}
            </p>
          </footer>
        </div>
        <BottomTabs />
      </div>
    </div>
  );
}
