"use client";
// Weekly strip: 13 horizontally scrollable cards, each with icon + status word + headline,
// like a weather forecast. Tapping a card moves the scrubber to that week's lowest day.
import { useEffect, useRef } from "react";
import clsx from "clsx";
import type { Forecast, Status } from "@/lib/forecast/types";
import { formatShortDay } from "@/lib/format";
import { weekIndexForDay, weekLowestIndex } from "@/lib/client/forecastText";
import { useAppState } from "./AppState";
import { StatusIcon } from "./StatusIcon";
import { Tpl, Day } from "./ui";

const ring: Record<Status, string> = {
  comfortable: "border-line",
  tight: "border-tight/35",
  short: "border-short/40",
};

export function WeekStrip({ forecast, index, onSelect }: { forecast: Forecast; index: number; onSelect: (dayIndex: number) => void }) {
  const { t, dir } = useAppState();
  const scroller = useRef<HTMLUListElement>(null);
  const selectedDate = forecast.days[index]?.date ?? forecast.today;
  const selectedWeek = weekIndexForDay(forecast, selectedDate);

  // Keep the selected week in view while scrubbing (horizontal scroll only, no page jump).
  useEffect(() => {
    const ul = scroller.current;
    const li = ul?.children[selectedWeek] as HTMLElement | undefined;
    if (!ul || !li) return;
    const left = li.offsetLeft - ul.offsetLeft;
    const right = left + li.offsetWidth;
    if (left < ul.scrollLeft + 8 || right > ul.scrollLeft + ul.clientWidth - 8) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      ul.scrollTo({ left: Math.max(0, left - 20), behavior: reduced ? "auto" : "smooth" });
    }
  }, [selectedWeek]);

  return (
    <ul ref={scroller} className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t("home.weeksTitle")}>
      {forecast.weeks.map((w, k) => {
        const lowIdx = weekLowestIndex(forecast, w.startDate);
        const selected = k === selectedWeek;
        return (
          <li key={w.startDate} className="snap-start">
            <button
              type="button"
              aria-pressed={selected}
              disabled={lowIdx < 0}
              onClick={() => lowIdx >= 0 && onSelect(lowIdx)}
              className={clsx(
                "flex h-full min-h-[124px] w-[136px] flex-col items-start rounded-2xl border bg-card p-3 text-left transition-[border-color,box-shadow] duration-200 ease-calm",
                ring[w.status],
                selected ? "shadow-[0_0_0_2px_var(--color-accent)]" : "hover:border-muted/40",
              )}
              dir={dir}
            >
              <span className="text-[0.8125rem] font-medium text-muted">
                <Tpl text={t("day.weekOf")} vars={{ date: <Day iso={w.startDate}>{formatShortDay(w.startDate)}</Day> }} />
              </span>
              <StatusIcon status={w.status} className="mt-2 text-[1rem]" size={22} />
              <span className="mt-1.5 line-clamp-2 text-[0.875rem] leading-snug text-ink">{w.headline}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
