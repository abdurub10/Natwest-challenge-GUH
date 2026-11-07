import { getContext } from "@/lib/forecast/context";
import { buildSchedule, simulate, buildDays } from "@/lib/forecast/project";
import { addDays } from "@/lib/forecast/calendar/dates";
const today = "2026-11-07";
const t0 = Date.now();
const ctx = getContext("aisha", today);
const t1 = Date.now();
const sch = buildSchedule(ctx, today, addDays(today, 90));
const pr = simulate(ctx, sch, 90);
const t2 = Date.now();
console.log("ctx ms", t1 - t0, "proj ms", t2 - t1, "residualMean", ctx.residualMean.toFixed(2), "pool", ctx.residualPool.length);
for (const d of ctx.detected) console.log(d.series.id, d.kind, d.series.cadence, d.series.amountP50, d.series.confidence, d.active, d.weekdays.join(","), d.series.count);
for (const a of ctx.annual) console.log("annual", a.series.id, a.total, a.series.anchor);
console.log(ctx.historyMonths.map(m => `${m.month} ${m.low.toFixed(0)} ${m.lowDate} od${m.overdraftDays} ${m.fivePayday ? "FIVE" : ""}`).join("\n"));
const days = buildDays(sch, pr);
let low = days[0];
for (const d of days) { if (d.p50 < low.p50) low = d; }
for (const d of days) if (d.date >= "2026-11-24" && d.date <= "2026-12-03" || d.date >= "2026-12-28" && d.date <= "2027-01-08" || d.date >= "2027-01-12") console.log(d.date, d.p20.toFixed(0), d.p50.toFixed(0), d.p80.toFixed(0), d.status, d.events.map(e => `${e.label} ${e.amount}`).join("; "));
console.log("LOW", low.date, low.p50, low.p20, low.p80);
