// GET /api/health -> { ok, store, n8n, claude, today, numbersChecked, numbersRejected } (plan section 18)
import { connection } from "next/server";
import { runForecast } from "@/lib/forecast";
import type { HealthResponse } from "@/lib/forecast/types";
import { DEMO_TODAY, PERSONA_ID } from "@/lib/config";
import { getStore, storeMode } from "@/lib/store";
import { n8nActive, n8nEnabled, n8nUrl } from "@/lib/n8n";
import { claudeConfigured } from "@/lib/coach/client";
import { getCounters } from "@/lib/coach/counters";
import { twilioConfigured } from "@/lib/twilio";
import { json } from "@/lib/actions/http";

export async function GET() {
  await connection();
  let engine = true;
  try {
    runForecast(PERSONA_ID, DEMO_TODAY);
  } catch (err) {
    engine = false;
    console.error("[health] engine failed:", err);
  }
  let storeOk = true;
  try {
    await getStore().getProfile(PERSONA_ID);
  } catch {
    storeOk = false;
  }
  const counters = getCounters();
  const body: HealthResponse & {
    engine: boolean;
    storeOk: boolean;
    n8nEnabled: boolean;
    n8nConfigured: boolean;
    twilio: boolean;
    voice: boolean;
  } = {
    ok: engine && storeOk,
    store: storeMode(),
    n8n: n8nActive("plan"),
    claude: claudeConfigured(),
    today: DEMO_TODAY,
    numbersChecked: counters.numbersChecked,
    numbersRejected: counters.numbersRejected,
    engine,
    storeOk,
    n8nEnabled: n8nEnabled(),
    n8nConfigured: !!n8nUrl("plan"),
    twilio: twilioConfigured(),
    voice: !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID),
  };
  return json(body);
}
