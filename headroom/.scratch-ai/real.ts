delete process.env.ANTHROPIC_API_KEY;
import { runForecast } from "@/lib/forecast";
import { buildFacts } from "@/lib/forecast/facts";
import { runCoach } from "@/lib/coach/chat";
import { explainForecastDetailed } from "@/lib/coach/explain";
import { acceptPlan, sendReminder, buildPlanMessage } from "@/lib/actions/run";
import { getStore } from "@/lib/store";
import { getCounters } from "@/lib/coach/counters";
(async () => {
  let t = Date.now();
  const f = runForecast("aisha", "2026-11-07");
  console.log("forecast ms", Date.now() - t, "lowest", f.headroom, "warning", f.warnings[0] && { ...f.warnings[0], causes: f.warnings[0].causes.map(c => `${c.label} | ${c.amount} | ${c.detail}`) });
  console.log("actions", f.actions.map(a => `${a.id} | ${a.title} | ${a.effectByCliff} | ${a.effectMonthly} | ${a.defaultOn} | ${a.date ?? ""}`));
  const facts = buildFacts(f, "en");
  console.log("keyEvents", facts.keyEvents.map(e => `${e.date} ${e.amount} ${e.label} ${e.ruleId ?? ""} ${e.note ?? ""}`));
  console.log("past", facts.pastEpisodes);
  console.log("recurring", f.recurring.map(s => `${s.id}|${s.label}|${s.cadence}|${s.amountP50}`).join("; "));
  const ex = await explainForecastDetailed(f, "en");
  console.log("EXPLAIN", ex);
  for (const q of ["What if my hours drop to 16 a week in January?", "What happens if I cancel Disney+?", "Can I afford £120 for a school trip in January?", "Why is my Universal Credit lower in January?", "What does my next month look like?", "Can you set this up for me?", "What if I cancel Netflix?", "car repair £300 in December"]) {
    t = Date.now();
    const r = await runCoach({ personaId: "aisha", language: "en", messages: [{ role: "user", content: q }] });
    console.log(`\nQ: ${q}\nA: ${r.reply}\n   tools=${r.toolCalls} checked=${r.checked} ms=${Date.now() - t}`);
  }
  const defaults = f.actions.filter(a => a.defaultOn).map(a => a.id);
  const pr = await acceptPlan("aisha", defaults);
  console.log("\nPLAN", pr.plan, pr.lowestAfter, pr.activity.map(a => `${a.title} | ${a.source} | ${a.detail}`));
  console.log(buildPlanMessage(f, f.actions.filter(a => a.defaultOn), pr.lowestAfter));
  const rem = await sendReminder("aisha");
  console.log("\nREMINDER", rem.path, rem.message, rem.message.length);
  console.log("\nRAIL", (await getStore().listActivity("aisha")).map(a => `${a.kind} | ${a.title} | ${a.source}`));
  console.log(getCounters());
})();
