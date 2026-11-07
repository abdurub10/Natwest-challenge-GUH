delete process.env.ANTHROPIC_API_KEY;
process.env.CALLBACK_SECRET = "cb-secret";
const post = (body: unknown, headers: Record<string, string> = {}) => new Request("http://x/api", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
(async () => {
  const show = async (name: string, res: Response) => { const t = await res.text(); console.log(name, res.status, t.slice(0, 260)); };
  const health = await import("@/app/api/health/route");
  try { await show("health", await health.GET()); } catch (e) { console.log("health threw", (e as Error).message); }
  const explain = await import("@/app/api/explain/route");
  await show("explain", await explain.POST(post({ persona: "aisha", lang: "en" })));
  await show("explain unknown", await explain.POST(post({ persona: "bob", lang: "en" })));
  await show("explain bad lang", await explain.POST(post({ lang: "fr" })));
  const coach = await import("@/app/api/coach/route");
  await show("coach", await coach.POST(post({ persona: "aisha", lang: "en", messages: [{ role: "user", content: "What happens if I cancel Disney+?" }] })));
  await show("coach empty", await coach.POST(post({ messages: [] })));
  await show("coach badjson", await coach.POST(post("{bad")));
  const plan = await import("@/app/api/plan/route");
  await show("plan", await plan.POST(post({ persona: "aisha", actionIds: ["set_aside_payday", "free_school_meals"] })));
  await show("plan unknown ids", await plan.POST(post({ persona: "aisha", actionIds: ["nope"] })));
  const act = await import("@/app/api/activity/route");
  const { NextRequest } = await import("next/server");
  try { await show("activity GET", await act.GET(new NextRequest("http://x/api/activity?persona=aisha"))); } catch (e) { console.log("activity threw", (e as Error).message); }
  await show("activity POST nosecret", await act.POST(post({ profileId: "aisha", kind: "message_sent", title: "Plan sent by WhatsApp", source: "n8n" })));
  await show("activity POST ok", await act.POST(post({ profileId: "aisha", kind: "message_sent", title: "Plan sent by WhatsApp", detail: "Headroom: your plan.", source: "n8n" }, { "x-callback-secret": "cb-secret" })));
  const n8n = await import("@/app/api/demo/n8n/route");
  await show("n8n off", await n8n.POST(post({ enabled: false })));
  const rem = await import("@/app/api/demo/reminder-now/route");
  await show("reminder", await rem.POST(post({})));
  const reset = await import("@/app/api/demo/reset/route");
  await show("reset", await reset.POST(post({})));
  try { await show("n8n GET", await n8n.GET()); } catch (e) { console.log("n8n GET threw", (e as Error).message); }
  const voice = await import("@/app/api/voice/token/route");
  try { await show("voice", await voice.GET()); } catch (e) { console.log("voice threw", (e as Error).message); }
})();
