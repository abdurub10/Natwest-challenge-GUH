// Direct WhatsApp/SMS send through the Twilio REST API (plan section 17.5, fallback path).
// Plain fetch with basic auth; server only.

export interface TwilioResult { ok: boolean; sid?: string; status?: number; error?: string; }

const TWILIO_TIMEOUT_MS = 8_000;

/** A recipient is usable if it is set and is not the .env.example placeholder. */
export function isRealRecipient(to: string | null | undefined): to is string {
  return !!to && /\d{6,}/.test(to) && !/X{3,}/i.test(to);
}

export function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}

/** WhatsApp recipients must carry the "whatsapp:" prefix; add it if it is missing. */
export function asWhatsApp(to: string): string {
  return to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
}

export async function sendTwilioMessage(opts: { to: string; body: string; from?: string }): Promise<TwilioResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = opts.from ?? process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return { ok: false, error: "Twilio is not configured" };
  if (!isRealRecipient(opts.to)) return { ok: false, error: "No real recipient number is set" };

  const to = from.startsWith("whatsapp:") ? asWhatsApp(opts.to) : opts.to;
  const form = new URLSearchParams({ To: to, From: from, Body: opts.body });
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(TWILIO_TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok) return { ok: false, status: res.status, error: json.message ?? `Twilio returned ${res.status}` };
    return { ok: true, status: res.status, sid: json.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
