process.env.TWILIO_ACCOUNT_SID = "AC123"; process.env.TWILIO_AUTH_TOKEN = "tok"; process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886"; process.env.DEMO_WHATSAPP_TO = "+447700900123";
const calls: any[] = [];
globalThis.fetch = (async (url: any, init: any) => { calls.push({ url: String(url), auth: init.headers.Authorization, body: init.body }); return new Response(JSON.stringify({ sid: "SM1" }), { status: 201 }); }) as any;
(async () => {
  const { sendPlanMessage } = await import("@/lib/actions/run");
  const r = await sendPlanMessage({ profileId: "aisha", message: "Headroom: test." });
  console.log(r.path, r.activity?.source, r.activity?.detail);
  console.log(calls[0].url, calls[0].auth, decodeURIComponent(calls[0].body));
  globalThis.fetch = (async () => new Response(JSON.stringify({ message: "not in sandbox" }), { status: 400 })) as any;
  const r2 = await sendPlanMessage({ profileId: "aisha", message: "Headroom: test." });
  console.log(r2.path, r2.activity?.kind, r2.activity?.detail);
})();
