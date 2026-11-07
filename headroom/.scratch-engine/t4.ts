import { AISHA } from "@/lib/forecast/seed/aisha";
import { generateHistory, dailyBalances, clearHistoryCache } from "@/lib/forecast/seed/generate";
const p: any = AISHA;
const rest = 0.45;
p.christmas.items = [
  { day: 5, description: "SMYTHS TOYS XMAS", share: rest * 0.37 }, { day: 12, description: "AMAZON XMAS", share: rest * 0.25 },
  { day: 18, description: "PRIMARK XMAS", share: rest * 0.16 }, { day: 20, description: "AMAZON XMAS", share: rest * 0.22 },
  { day: 24, description: "ALDI XMAS FOOD", share: 0.55 }];
p.knobs.aldiRange = [77, 93]; p.knobs.tescoRange = [7, 13]; p.knobs.occasionalPerMonth = 3; p.knobs.balanceToday = 280;
p.annualOneOffs = p.annualOneOffs.map((o: any) => o.category === "car" ? { ...o, date: "2026-03-12" } : o);
const extra = JSON.parse(process.argv[2] ?? "[]");
p.annualOneOffs.push(...extra);
clearHistoryCache();
const h = generateHistory(AISHA, "2026-11-07");
const b = dailyBalances(h);
const months = new Map<string, { low: number; date: string; od: number; odDates: string[] }>();
for (const x of b) {
  const k = x.date.slice(0, 7);
  const m = months.get(k) ?? { low: Infinity, date: "", od: 0, odDates: [] };
  if (x.balance < m.low) { m.low = x.balance; m.date = x.date; }
  if (x.balance < 0) { m.od++; m.odDates.push(x.date.slice(8)); }
  months.set(k, m);
}
console.log("opening", h.openingBalance);
for (const [k, m] of months) console.log(k, m.low.toFixed(0), m.date, m.od, m.od <= 10 ? m.odDates.join(",") : "");
