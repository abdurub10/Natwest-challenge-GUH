"use client";
import { useSyncExternalStore } from "react";

/** True when the media query matches. False during server render and hydration. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The desktop shell breakpoint (ui-plan.md 3.4): 1024px and wider. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
