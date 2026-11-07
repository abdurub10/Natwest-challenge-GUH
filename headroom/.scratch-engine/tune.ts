import { AISHA } from "@/lib/forecast/seed/aisha";
import { clearHistoryCache } from "@/lib/forecast/seed/generate";
import { clearContextCache, getContext } from "@/lib/forecast/context";
import { buildSchedule, simulate } from "@/lib/forecast/project";
import { addDays } from "@/lib/forecast/calendar/dates";

const today = "2026-11-07";
export function evaluate(mut: (p: typeof AISHA) => void, verbose = false) {
  const snapshot = JSON.parse(JSON.stringify(AISHA));
  mut(AISHA);
  clearHistoryCache(); clearContextCache();
  const ctx = getContext("aisha", today);
  const sch = buildSchedule(ctx, today, addDays(today, 90));
  const pr = simulate(ctx, sch, 90);
  const at = (d: string) => pr.p50[pr.dates.indexOf(d)];
  let minLate = Infinity, minLateD = "";
  let low = Infinity, lowD = "";
  let firstShort = "";
  for (let i = 0; i < pr.dates.length; i++) {
    const d = pr.dates[i], v = pr.p50[i];
    if (d < "2027-01-01" && v < minLate) { minLate = v; minLateD = d; }
    if (v < low) { low = v; lowD = d; }
    if (!firstShort && v < 0) firstShort = d;
  }
  const hm = ctx.historyMonths.map(m => `${m.month.slice(2)}:${m.low.toFixed(0)}/${m.overdraftDays}${m.fivePayday ? "*" : ""}`).join(" ");
  const out = { dec1: at("2026-12-01").toFixed(0), preJanMin: `${minLate.toFixed(0)}@${minLateD}`, low: `${low.toFixed(0)}@${lowD}`, firstShort, dec31: at("2026-12-31").toFixed(0), jan14: at("2027-01-14").toFixed(0), dec23: at("2026-12-23").toFixed(0), dec30: at("2026-12-30").toFixed(0), jan21: at("2027-01-21").toFixed(0), hist: hm, opening: ctx.openingBalance };
  Object.assign(AISHA, snapshot);
  return out;
}
if (process.argv[2] === "base") console.log(evaluate(() => {}));
