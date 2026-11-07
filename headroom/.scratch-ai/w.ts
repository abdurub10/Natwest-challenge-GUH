import { runForecast } from "@/lib/forecast";
const f = runForecast("aisha", "2026-11-07", { extraExpenses: [{ date: "2026-12-01", amount: 300, label: "Car repair" }] });
console.log(f.headroom, f.warnings.map(w => [w.startDate, w.endDate, w.lowestDate, w.depthP50]));
