import http from "node:http";
let mode: "ok" | "slow" = "ok";
const got: any[] = [];
const srv = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    got.push({ secret: req.headers["x-headroom-secret"], body: JSON.parse(b) });
    if (mode === "slow") setTimeout(() => { res.end("{}"); }, 6000); else { res.setHeader("content-type", "application/json"); res.end('{"ok":true}'); }
  });
});
srv.listen(0, async () => {
  const port = (srv.address() as any).port;
  process.env.N8N_PLAN_CREATED_URL = `http://127.0.0.1:${port}/webhook/headroom-plan`;
  process.env.N8N_SHARED_SECRET = "s3cret";
  process.env.DEMO_WHATSAPP_TO = "whatsapp:+447700900123";
  const { acceptPlan } = await import("@/lib/actions/run");
  let r = await acceptPlan("aisha", ["set_aside_payday"]);
  console.log("ok path activity:", r.activity.map((a) => `${a.title}|${a.source}`), "payload:", got[0].secret, Object.keys(got[0].body), got[0].body.reminders);
  mode = "slow"; const t = Date.now();
  r = await acceptPlan("aisha", ["set_aside_payday"]);
  console.log("slow path ms", Date.now() - t, r.activity.map((a) => `${a.title}|${a.source}|${a.detail}`));
  srv.close(); process.exit(0);
});
