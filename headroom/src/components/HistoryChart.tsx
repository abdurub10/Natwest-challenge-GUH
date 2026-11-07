"use client";
// /behind: last 12 months as columns of the monthly low balance. Five-payday months are marked
// under the axis; months that went below zero carry their overdraft days at the bar end.
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, Cell, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";
import type { Forecast } from "@/lib/forecast/types";
import { formatMoney } from "@/lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const C = { pos: "#5FD3B5", neg: "#FF8A7A", axis: "#9BA7A1", grid: "rgba(255,255,255,0.12)", marker: "#F2C46D", text: "#E8ECE9" };

type Row = { label: string; month: string; low: number; overdraftDays: number; fivePayday: boolean };

function monthShort(m: string): string {
  const r = /^(\d{4})-(\d{2})/.exec(m);
  return r ? `${MONTHS[Number(r[2]) - 1]} ${r[1].slice(2)}` : m;
}

export function HistoryChart({ months, height = 260 }: { months: Forecast["history"]["months"]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      const w = Math.floor(e[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data: Row[] = months.map((m) => ({ label: monthShort(m.month), month: m.month, low: Math.round(m.low), overdraftDays: m.overdraftDays, fivePayday: m.fivePayday }));
  const min = Math.min(0, ...data.map((d) => d.low));
  const max = Math.max(0, ...data.map((d) => d.low));
  const step = max - min > 600 ? 200 : 100;
  const domain: [number, number] = [Math.floor((min - 40) / step) * step, Math.ceil((max + 20) / step) * step];
  const ticks: number[] = [];
  for (let v = domain[0]; v <= domain[1]; v += step) ticks.push(v);

  const summary = data.map((d) => `${d.label}: lowest ${formatMoney(d.low)}${d.overdraftDays ? `, ${d.overdraftDays} days below zero` : ""}${d.fivePayday ? ", five-payday month" : ""}`).join("; ");

  return (
    <figure className="m-0">
      <div ref={ref} role="img" aria-label={`Lowest balance each month. ${summary}`} style={{ height }} className="w-full">
        {width > 0 ? (
          <BarChart width={width} height={height} data={data} margin={{ top: 16, right: 8, bottom: 4, left: 4 }} barCategoryGap="28%" accessibilityLayer={false}>
            <YAxis domain={domain} ticks={ticks} tickFormatter={(v: number) => formatMoney(v)} width={56} tickLine={false} axisLine={false} tick={{ fill: C.axis, fontSize: 13 }} />
            <XAxis
              dataKey="label"
              interval={0}
              tickLine={false}
              axisLine={{ stroke: C.grid }}
              height={44}
              tick={(props: { x?: number | string; y?: number | string; index?: number; payload?: { value?: string } }) => {
                const x = Number(props.x ?? 0);
                const y = Number(props.y ?? 0);
                const row = data[props.index ?? 0];
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text dy={14} textAnchor="middle" fill={C.axis} fontSize={13}>
                      {props.payload?.value}
                    </text>
                    {row?.fivePayday ? <path d="M0,22 L5,31 L-5,31 Z" fill={C.marker} /> : null}
                  </g>
                );
              }}
            />
            <ReferenceLine y={0} stroke={C.axis} strokeOpacity={0.6} />
            <Bar dataKey="low" maxBarSize={24} radius={[4, 4, 4, 4]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.month} fill={d.low < 0 ? C.neg : C.pos} />
              ))}
              <LabelList
                dataKey="overdraftDays"
                content={(p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) => {
                  const row = data[p.index ?? -1];
                  if (!row || row.overdraftDays <= 0) return null;
                  const x = Number(p.x ?? 0) + Number(p.width ?? 0) / 2;
                  const y0 = Number(p.y ?? 0);
                  const y = Math.max(y0, y0 + Number(p.height ?? 0)); // bottom of the bar either way
                  return (
                    <text x={x} y={y + 16} textAnchor="middle" fill={C.text} fontSize={13} fontWeight={600}>
                      {`${row.overdraftDays} days`}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        ) : null}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[0.9375rem] text-[#9BA7A1]">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block size-3 rounded-sm" style={{ background: C.pos }} />
          Lowest balance in the month
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block size-3 rounded-sm" style={{ background: C.neg }} />
          Went below zero (days shown)
        </span>
        <span className="inline-flex items-center gap-2">
          <svg aria-hidden width="12" height="10">
            <path d="M6,0 L12,10 L0,10 Z" fill={C.marker} />
          </svg>
          Five-payday Universal Credit month
        </span>
      </figcaption>
    </figure>
  );
}
