import { mockForecast } from "@/lib/mock/forecast";
import { explainForecastDetailed, clearExplainCache } from "@/lib/coach/explain";
import { getCounters } from "@/lib/coach/counters";
import { getStore } from "@/lib/store";

process.env.ANTHROPIC_API_KEY = "test-key";
const calls: any[] = [];
let script: any[] = [];
const fake = { messages: { create: async (req: any) => { calls.push(JSON.parse(JSON.stringify(req))); return script.shift(); } } };
(globalThis as any).__headroomAnthropic = { key: "test-key", client: fake };

const tool = (input: any, id = "tu_1") => ({ id: "m", type: "message", role: "assistant", model: "x", stop_reason: "tool_use", content: [{ type: "tool_use", id, name: "write_explanation", input }] });
const good = { headline: "You may be short by about £140 from Mon 25 Jan to Mon 1 Feb.", why: ["Christmas spending: about £380.", "Universal Credit on Thu 31 Dec is about £154 lower."], whatThisMeans: "Your balance may go below zero for a few days.", reassurance: "This is predictable and there are options.", nextStep: "The best option is to put £150 aside on Fri 11 Dec.", language: "en" };
const bad = { ...good, headline: "You may be short by about £999 on Fri 15 Jan." };

(async () => {
  // 1. good first time
  script = [tool(good)];
  let r = await explainForecastDetailed(mockForecast, "en");
  console.log("1", r.source, r.explanation.headline, "calls", calls.length, "tool_choice", JSON.stringify(calls[0].tool_choice), "thinking", JSON.stringify(calls[0].thinking), "effort", JSON.stringify(calls[0].output_config), "max_tokens", calls[0].max_tokens);
  // 2. bad then good (retry)
  clearExplainCache(); calls.length = 0;
  script = [tool(bad), tool(good, "tu_2")];
  r = await explainForecastDetailed(mockForecast, "en");
  console.log("2", r.source, calls.length, JSON.stringify(calls[1].messages.at(-1)).slice(0, 220));
  // 3. bad twice -> template
  clearExplainCache(); calls.length = 0;
  script = [tool(bad), tool(bad, "tu_2")];
  r = await explainForecastDetailed(mockForecast, "en");
  console.log("3", r.source, r.explanation.headline, calls.length);
  // 4. banned word -> retry -> template
  clearExplainCache(); calls.length = 0;
  script = [tool({ ...good, nextStep: "You could use your overdraft." }), tool({ ...good, nextStep: "Maybe a loan." }, "tu_2")];
  r = await explainForecastDetailed(mockForecast, "en");
  console.log("4", r.source, calls.length);
  // 5. throw -> template
  clearExplainCache(); calls.length = 0;
  script = [];
  fake.messages.create = async () => { throw new Error("timeout"); };
  r = await explainForecastDetailed(mockForecast, "en");
  console.log("5", r.source);
  // 6. cache hit
  const again = await explainForecastDetailed(mockForecast, "en");
  console.log("6 cached same obj", again === r || again.explanation === r.explanation);
  console.log(getCounters());
  console.log((await getStore().listActivity("aisha")).map(a => `${a.kind} | ${a.title} | ${a.detail}`));
})();
