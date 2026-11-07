"use client";
// Time-travel scrubber: a native range input (keyboard and touch work by default)
// with a 44px thumb. aria-valuetext is the day card headline.
import clsx from "clsx";
import type { DayPoint } from "@/lib/forecast/types";
import { formatShortDay } from "@/lib/format";
import { useAppState } from "./AppState";

export function Scrubber({ days, index, onChange, valueText, id = "scrubber" }: { days: DayPoint[]; index: number; onChange: (i: number) => void; valueText: string; id?: string }) {
  const { t } = useAppState();
  const max = Math.max(0, days.length - 1);
  const pct = max ? (index / max) * 100 : 0;
  const first = days[0]?.date;
  const last = days[max]?.date;
  return (
    <div className="px-5">
      <label htmlFor={id} className="sr-only">
        {t("scrubber.label")}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={valueText}
        style={{ ["--pct" as string]: `${pct}%` }}
        className={clsx(
          "block h-11 w-full cursor-pointer appearance-none bg-transparent touch-pan-y",
          // Track
          "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full",
          "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-accent)_var(--pct),var(--color-line)_var(--pct))]",
          "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-line",
          "[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-accent",
          // Thumb: 44px target, drawn as a 28px disc with a white ring.
          "[&::-webkit-slider-thumb]:-mt-[19px] [&::-webkit-slider-thumb]:size-11 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:border-[8px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-transparent [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:bg-clip-padding",
          "[&::-webkit-slider-thumb]:shadow-[inset_0_0_0_3px_#fff]",
          "[&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.25)]",
          "focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:shadow-[inset_0_0_0_3px_#fff,0_0_0_3px_var(--color-accent)]",
          "focus-visible:[&::-moz-range-thumb]:outline focus-visible:[&::-moz-range-thumb]:outline-[3px] focus-visible:[&::-moz-range-thumb]:outline-accent",
        )}
      />
      {first && last ? (
        <div aria-hidden className="mt-0.5 flex justify-between text-[0.8125rem] text-muted">
          <span>{t("day.today")}</span>
          <span>{formatShortDay(last)}</span>
        </div>
      ) : null}
    </div>
  );
}
