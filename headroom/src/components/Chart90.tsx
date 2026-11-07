"use client";
// 90-day projected balance: P20-P80 band (range Area), P50 line, dashed zero line,
// a reference line at the scrubber day, ticks at today / 1 Dec / 1 Jan / 1 Feb and dots
// on days with an event of £100 or more. Rendered only after mount (no SSR of the SVG),
// sized by our own ResizeObserver so hidden routes (display: none) never draw at 0 x 0.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { Area, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";
import type { DotItemDotProps } from "recharts";
import type { DayPoint, Warning } from "@/lib/forecast/types";
import { formatMoney, formatShortDay } from "@/lib/format";

const COLORS = {
  accent: "#0F6E5C",
  band: "rgba(15,110,92,0.14)",
  zero: "#8A8F8C",
  ink: "#1B1F1D",
  muted: "#5B625E",
  short: "#B3261E",
  card: "#FFFFFF",
  compare: "#8A8F8C",
};

const noopSubscribe = () => () => {};

const MARGIN = { top: 14, right: 14, bottom: 2, left: 4 };
const Y_AXIS_WIDTH = 50;

interface Row {
  i: number;
  date: string;
  band: [number, number];
  p50: number;
  compare?: number;
  big: boolean;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      // Ignore 0 while the route is hidden (display: none) so the chart does not remount and replay.
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean y ticks that always include 0. */
function niceTicks(min: number, max: number): { domain: [number, number]; ticks: number[] } {
  const span = Math.max(200, max - min);
  const rough = span / 3;
  const steps = [100, 250, 500, 1000, 2000];
  const step = steps.find((s) => s >= rough) ?? 2000;
  const lo = Math.floor(Math.min(min, 0) / step) * step;
  const hi = Math.ceil(Math.max(max, 0) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-6; v += step) ticks.push(v);
  return { domain: [lo, hi], ticks };
}

export interface Chart90Props {
  days: DayPoint[];
  /** Scrubber position (index into days). */
  index?: number;
  onIndexChange?: (i: number) => void;
  /** Shade the Short stretch. */
  warning?: Warning;
  /** Optional "before" line, drawn faint, for the Plan screen. */
  compareDays?: DayPoint[];
  compareLabel?: string;
  mainLabel?: string;
  height?: number;
  label: string;
  todayLabel?: string;
}

export function Chart90({ days, index, onIndexChange, warning, compareDays, compareLabel, mainLabel, height = 210, label, todayLabel = "Today" }: Chart90Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  // Render the SVG only on the client, after hydration.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // 600 ms reveal on load; 300 ms for later changes (toggles); off under reduced motion.
  const [firstDays] = useState(days);
  const duration = firstDays === days ? 600 : 300;

  const data: Row[] = useMemo(
    () =>
      days.map((d, i) => ({
        i,
        date: d.date,
        band: [d.p20, d.p80],
        p50: d.p50,
        compare: compareDays?.[i]?.p50,
        big: d.events.some((e) => Math.abs(e.amount) >= 100),
      })),
    [days, compareDays],
  );

  const { domain, ticks: yTicks } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of data) {
      min = Math.min(min, r.band[0], r.p50, r.compare ?? Infinity);
      max = Math.max(max, r.band[1], r.p50, r.compare ?? -Infinity);
    }
    if (!Number.isFinite(min)) return { domain: [0, 1000] as [number, number], ticks: [0, 500, 1000] };
    return niceTicks(min, max);
  }, [data]);

  const xTicks = useMemo(() => {
    const t = [0];
    data.forEach((r) => {
      if (r.i >= 5 && r.date.endsWith("-01")) t.push(r.i);
    });
    return t;
  }, [data]);

  const tickLabel = useCallback((i: number) => (i === 0 ? todayLabel : data[i] ? formatShortDay(data[i].date) : ""), [data, todayLabel]);

  const renderDot = useCallback((props: DotItemDotProps) => {
    const { cx, cy, payload, index: i } = props;
    if (!payload?.big || cx == null || cy == null) return <g key={`d${i}`} />;
    return <circle key={`d${i}`} cx={cx} cy={cy} r={4} fill={COLORS.accent} stroke={COLORS.card} strokeWidth={2} />;
  }, []);

  const warnRange = useMemo(() => {
    if (!warning) return null;
    const a = data.findIndex((r) => r.date >= warning.startDate);
    let b = -1;
    for (let k = data.length - 1; k >= 0; k--) if (data[k].date <= warning.endDate) { b = k; break; }
    return a >= 0 && b >= a ? [a, b] : null;
  }, [warning, data]);

  // Pointer scrubbing on the plot: tap or drag horizontally to move the scrubber.
  const dragging = useRef(false);
  const indexFromPointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const left = MARGIN.left + Y_AXIS_WIDTH;
      const plotW = rect.width - left - MARGIN.right;
      if (plotW <= 0 || data.length < 2) return null;
      const x = e.clientX - rect.left - left;
      return Math.max(0, Math.min(data.length - 1, Math.round((x / plotW) * (data.length - 1))));
    },
    [data.length],
  );
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onIndexChange) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const i = indexFromPointer(e);
    if (i != null) onIndexChange(i);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !onIndexChange) return;
    const i = indexFromPointer(e);
    if (i != null) onIndexChange(i);
  };
  const stop = () => {
    dragging.current = false;
  };

  const sel = index != null && data[index] ? data[index] : null;
  const animate = !reduced;
  const showCompare = !!compareDays?.length;

  return (
    <figure className="m-0">
      <div
        ref={wrapRef}
        role="img"
        aria-label={label}
        className="relative w-full select-none touch-pan-y"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      >
        {mounted && width > 0 && data.length > 1 ? (
          <ComposedChart width={width} height={height} data={data} margin={MARGIN} accessibilityLayer={false}>
            <XAxis
              dataKey="i"
              type="number"
              domain={[0, data.length - 1]}
              ticks={xTicks}
              tickFormatter={tickLabel}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: "#E6E1D8" }}
              tick={{ fill: COLORS.muted, fontSize: 13 }}
              tickMargin={8}
              height={30}
            />
            <YAxis
              type="number"
              domain={domain}
              ticks={yTicks}
              tickFormatter={(v: number) => formatMoney(v)}
              width={Y_AXIS_WIDTH}
              tickLine={false}
              axisLine={false}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              allowDataOverflow
            />
            {warnRange ? <ReferenceArea x1={warnRange[0]} x2={warnRange[1]} fill={COLORS.short} fillOpacity={0.07} stroke="none" ifOverflow="hidden" /> : null}
            <ReferenceLine y={0} stroke={COLORS.zero} strokeDasharray="4 4" strokeWidth={1} />
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill={COLORS.band}
              fillOpacity={1}
              isAnimationActive={animate}
              animationDuration={duration}
              animationEasing="ease-out"
              activeDot={false}
              dot={false}
            />
            {showCompare ? (
              <Line
                type="monotone"
                dataKey="compare"
                stroke={COLORS.compare}
                strokeWidth={1.5}
                strokeDasharray="3 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="p50"
              stroke={COLORS.accent}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={renderDot}
              activeDot={false}
              isAnimationActive={animate}
              animationDuration={duration}
              animationEasing="ease-out"
            />
            {sel ? <ReferenceLine x={sel.i} stroke={COLORS.ink} strokeWidth={1} strokeOpacity={0.55} /> : null}
            {sel ? <ReferenceDot x={sel.i} y={sel.p50} r={6} fill={COLORS.accent} stroke={COLORS.card} strokeWidth={2.5} ifOverflow="visible" /> : null}
          </ComposedChart>
        ) : (
          <div aria-hidden className="absolute inset-x-[54px] bottom-[30px] top-[14px] rounded-xl bg-accentSoft/40" />
        )}
      </div>
      {showCompare && (mainLabel || compareLabel) ? (
        <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[0.875rem] text-muted">
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden width="22" height="8">
              <line x1="1" y1="4" x2="21" y2="4" stroke={COLORS.accent} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            {mainLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden width="22" height="8">
              <line x1="1" y1="4" x2="21" y2="4" stroke={COLORS.compare} strokeWidth="1.5" strokeDasharray="3 4" />
            </svg>
            {compareLabel}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}
