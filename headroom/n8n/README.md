# n8n workflows for Headroom

Two importable workflows (plan section 17):

- `plan-created.json`: webhook `POST /webhook/headroom-plan` → secret check (401 if wrong) → WhatsApp through Twilio → callback to `/api/activity` ("Plan sent by WhatsApp", source `n8n`) → `{ ok: true }`.
- `payday-reminder.json`: two triggers.
  - **Fridays 09:00** (schedule): GET `/api/forecast?persona=aisha` → Code node picks that Friday's events and the week status → WhatsApp → callback `reminder_sent`.
  - **Reminder now** (webhook `POST /webhook/headroom-reminder-now`, used by the "Send Friday reminder now" button): secret check → sends the message our server built → callback `reminder_sent` → `{ ok: true }`.

n8n never writes copy for the plan. Our server builds the message (`buildPlanMessage` / `buildReminderMessage` in `src/lib/actions/run.ts`) using engine numbers only.

## Setup (5 steps)

1. **Import.** In n8n Cloud go to Workflows → Import from file. Import `plan-created.json`, then `payday-reminder.json`.
2. **Twilio credential.** Open each "Send WhatsApp" node, create or pick a *Twilio API* credential (Account SID + Auth Token from the Twilio console) and save. The sandbox sender `+14155238886` is already set. Make sure the demo phone has sent `join <code>` to the sandbox in the last 24 hours (section 17.1).
3. **Config nodes.** In every node named `Config…`, replace the placeholders:
   - `appUrl`: your deployed app, e.g. `https://headroom.vercel.app` (no trailing slash)
   - `sharedSecret`: the same value as `N8N_SHARED_SECRET` in Vercel (our server sends it as `x-headroom-secret`)
   - `callbackSecret`: the same value as `CALLBACK_SECRET` in Vercel (n8n sends it back as `x-callback-secret`)
   - `demoTo` (schedule path only): the demo phone, e.g. `+447700900123`
4. **Activate and copy URLs.** Switch both workflows to Active. Copy the *Production* webhook URLs into Vercel:
   - `N8N_PLAN_CREATED_URL` = `https://<you>.app.n8n.cloud/webhook/headroom-plan`
   - `N8N_REMINDER_URL` = `https://<you>.app.n8n.cloud/webhook/headroom-reminder-now`
   Redeploy so the variables take effect.
5. **Test end to end.**
   ```bash
   curl -X POST "$N8N_PLAN_CREATED_URL" \
     -H "content-type: application/json" -H "x-headroom-secret: $N8N_SHARED_SECRET" \
     -d '{"profileId":"aisha","to":"whatsapp:+447700900123","message":"Headroom: test message."}'
   ```
   You should get `{ "ok": true }`, a WhatsApp on the demo phone, and "Plan sent by WhatsApp" on `/behind` within 3 seconds. A wrong secret returns 401.

## If something breaks on the day

- `/behind` → **n8n off** makes the server skip n8n and send directly with Twilio (`source: fallback`). If Twilio keys are not set on the server either, the rail still shows "Plan sent by WhatsApp" with a detail saying it was simulated.
- The server waits at most 5 seconds for n8n, then falls back on its own.
- If WhatsApp fails, switch the Twilio nodes to SMS: untick "To WhatsApp" and use your Twilio phone number as the sender.
- Node parameter names can shift between n8n versions. If a node shows a warning after import, open it and re-select the same options. The behaviour above is what matters.
