// GET /api/voice/token?persona=aisha&lang=en -> { signedUrl, dynamicVariables } for the ElevenLabs
// agent (plan section 16). 503 when not set up. dynamicVariables carries the forecast summary the
// agent opens with ({{insights}}) and the person's name ({{user_name}}).
import { connection } from "next/server";
import { json, jsonError } from "@/lib/actions/http";
import { DEMO_TODAY } from "@/lib/config";
import type { Language } from "@/lib/forecast/types";
import { getStore } from "@/lib/store";
import { buildVoiceInsights } from "@/lib/voice/insights";

const UNAVAILABLE = "Voice is unavailable, type instead";

export async function GET(req: Request) {
  await connection();
  const key = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agentId) return jsonError(503, UNAVAILABLE);

  const url = new URL(req.url);
  const persona = /^[a-z0-9_-]{1,32}$/.test(url.searchParams.get("persona") ?? "") ? url.searchParams.get("persona")! : "aisha";
  const lang = (["en", "ur", "pl"].includes(url.searchParams.get("lang") ?? "") ? url.searchParams.get("lang") : "en") as Language;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(5_000), cache: "no-store" },
    );
    if (!res.ok) {
      console.error("[voice] ElevenLabs returned", res.status, await res.text().catch(() => ""));
      return jsonError(502, UNAVAILABLE);
    }
    const data = (await res.json()) as { signed_url?: string };
    if (!data.signed_url) return jsonError(502, UNAVAILABLE);

    let insights = "The summary could not be loaded. Call get_forecast before quoting any number.";
    try {
      insights = buildVoiceInsights(persona, DEMO_TODAY, lang);
    } catch (err) {
      console.error("[voice] insights failed:", err);
    }
    let userName = "there";
    try {
      userName = (await getStore().getProfile(persona)).displayName || userName;
    } catch {
      /* the name is a nicety; keep "there" */
    }

    return json({ signedUrl: data.signed_url, dynamicVariables: { insights, user_name: userName } });
  } catch (err) {
    console.error("[voice] token failed:", err);
    return jsonError(502, UNAVAILABLE);
  }
}
