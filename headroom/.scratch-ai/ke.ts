import { mockForecast } from "@/lib/mock/forecast";
import { buildFacts } from "@/lib/forecast/facts";
const f = buildFacts(mockForecast, "en");
for (const e of f.keyEvents) console.log(e.date, e.amount, e.label, e.ruleId ?? "", e.note ?? "");
console.log(f.pastEpisodes, f.allowedNumbers.length);
