// GET /api/voice/token -> { signedUrl } for the ElevenLabs agent (plan section 16). 503 when not set up.
import { connection } from "next/server";
import { json, jsonError } from "@/lib/actions/http";

const UNAVAILABLE = "Voice is unavailable, type instead";

export async function GET() {
  await connection();
  const key = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agentId) return jsonError(503, UNAVAILABLE);
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
    return json({ signedUrl: data.signed_url });
  } catch (err) {
    console.error("[voice] token failed:", err);
    return jsonError(502, UNAVAILABLE);
  }
}
