import { AISHA } from "@/lib/forecast/seed/aisha";
import { generateHistory, dailyBalances } from "@/lib/forecast/seed/generate";
const h = generateHistory(AISHA, "2026-11-07");
console.log("tx", h.transactions.length, "opening", h.openingBalance);
const bals = dailyBalances(h);
const months = new Map<string, { low: number; date: string; od: number }>();
for (const b of bals) {
  const k = b.date.slice(0, 7);
  const m = months.get(k) ?? { low: Infinity, date: "", od: 0 };
  if (b.balance < m.low) { m.low = b.balance; m.date = b.date; }
  if (b.balance < 0) m.od++;
  months.set(k, m);
}
for (const [k, m] of months) console.log(k, m.low.toFixed(0), m.date, m.od);
console.log(h.transactions.filter(t => t.description === "DWP UC").map(t => `${t.date} ${t.amount}`).join("\n"));
