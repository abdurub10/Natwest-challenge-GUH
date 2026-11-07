import { AISHA } from "@/lib/forecast/seed/aisha";
import { generateHistory, dailyBalances } from "@/lib/forecast/seed/generate";
const p: any = AISHA;
const rest = 0.45;
p.christmas.items = [
  { day: 5, description: "SMYTHS TOYS XMAS", share: rest * 0.37 }, { day: 12, description: "AMAZON XMAS", share: rest * 0.25 },
  { day: 18, description: "PRIMARK XMAS", share: rest * 0.16 }, { day: 20, description: "AMAZON XMAS", share: rest * 0.22 },
  { day: 24, description: "ALDI XMAS FOOD", share: 0.55 }];
p.knobs.aldiRange = [77, 93]; p.knobs.tescoRange = [7, 13]; p.knobs.occasionalPerMonth = 3; p.knobs.balanceToday = 280;
const h = generateHistory(AISHA, "2026-11-07");
const b = dailyBalances(h);
const from = process.argv[2] ?? "2026-01-15", to = process.argv[3] ?? "2026-03-05";
for (const x of b) if (x.date >= from && x.date <= to) console.log(x.date, x.balance.toFixed(0), h.transactions.filter(t => t.date === x.date).map(t => `${t.description} ${t.amount}`).join("; "));
