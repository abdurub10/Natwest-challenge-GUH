// Business actions (plan sections 6.4, 17, 18): accept a plan, record activity, send messages.
// API routes, the coach tools and n8n callbacks all go through these functions.
import { runForecast } from "@/lib/forecast";
import type { ActionCandidate, Activity, ActivityKind, ActivitySource, Forecast, ISODate, PlanResponse } from "@/lib/forecast/types";
import { DEMO_TODAY } from "@/lib/config";
import { formatDay, formatMoney, parseISO, toISO } from "@/lib/format";
import { getStore } from "@/lib/store";
import { n8nEnabled, n8nUrl, postToN8n } from "@/lib/n8n";
import { isRealRecipient, sendTwilioMessage, twilioConfigured } from "@/lib/twilio";

export const MAX_MESSAGE_CHARS = 320;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const HELP_CONTACTS = [
  { name: "Citizens Advice Manchester", phone: "0808 278 7800", url: "https://www.citizensadvicemanchester.org.uk" },
  { name: "StepChange", phone: "0800 138 1111", url: "https://www.stepchange.org" },
  { name: "MoneyHelper", phone: "0800 138 7777", url: "https://www.moneyhelper.org.uk" },
];

export class PlanError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "PlanError";
  }
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export interface ActivityInput { profileId: string; kind: ActivityKind; title: string; detail?: string | null; source: ActivitySource; }

/** Add an activity row. Never throws: a failed write is logged and returns null. */
export async function recordActivity(a: ActivityInput): Promise<Activity | null> {
  try {
    return await getStore().addActivity({ ...a, detail: a.detail ? a.detail.slice(0, 500) : null });
  } catch (err) {
    console.error("[activity] write failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Message builders (engine numbers only)
// ---------------------------------------------------------------------------

export interface Reminder { date: ISODate; text: string; }

function monthName(d: ISODate): string {
  return MONTH_NAMES[parseISO(d).getUTCMonth()];
}

/** Amount to set aside: the £ figure in the action title ("Put £150 aside..."), else its effect. */
function setAsideAmount(a: ActionCandidate): number {
  const m = /£\s?(\d[\d,]*)/.exec(a.title);
  return m ? Number(m[1].replace(/,/g, "")) : Math.round(a.effectByCliff);
}

function actionLine(a: ActionCandidate, forecast: Forecast, withDetail: boolean): string {
  const title = a.title.replace(/[.\s]+$/, "");
  if (!withDetail) return `${title}.`;
  if (a.id === "talk_to_someone" || a.type === "help") return `${title}: Citizens Advice ${HELP_CONTACTS[0].phone}.`;
  if (a.date && (a.type === "timing" || a.type === "save")) return `${title} (we'll remind you).`;
  if (Math.round(a.effectMonthly) >= 1) return `${title}: about £${Math.round(a.effectMonthly)} a month.`;
  const w = forecast.warnings[0];
  if (Math.round(a.effectByCliff) >= 1 && w) return `${title}: about £${Math.round(a.effectByCliff)} more by ${formatDay(w.lowestDate)}.`;
  return `${title}.`;
}

/**
 * The WhatsApp plan message (plan section 17.2). `forecast` is the forecast without the plan;
 * `lowestAfter` is the engine's lowest point with the plan (defaults to headroom.afterPlan).
 * Always under 320 characters.
 */
export function buildPlanMessage(forecast: Forecast, actions: ActionCandidate[], lowestAfter?: number): string {
  const after = lowestAfter ?? forecast.headroom.afterPlan;
  const before = forecast.headroom.lowest;
  const head = "Headroom: your plan.";
  const tailParts: string[] = [];
  if (after !== undefined && actions.length) {
    tailParts.push(`With ${actions.length === 1 ? "this" : "these"}, your lowest point goes from ${formatMoney(before, { about: true })} to ${formatMoney(after, { about: true, sign: true })}.`);
  }
  tailParts.push("Reply HELP to talk to a person.");
  const tail = tailParts.join("\n");

  const compose = (withDetail: boolean, count: number) => {
    const lines = actions.slice(0, count).map((a, i) => `${i + 1}. ${actionLine(a, forecast, withDetail)}`);
    const more = actions.length - count;
    if (more > 0) lines.push(`And ${more} more in the app.`);
    return [head, ...lines, tail].join("\n");
  };

  for (const withDetail of [true, false]) {
    for (let count = actions.length; count >= 1; count--) {
      const msg = compose(withDetail, count);
      if (msg.length <= MAX_MESSAGE_CHARS) return msg;
    }
  }
  return `${head}\n${tail}`.slice(0, MAX_MESSAGE_CHARS);
}

/** Reminders for dated actions, e.g. "Payday. Move £150 to your January pot today." */
export function buildPlanReminders(forecast: Forecast, actions: ActionCandidate[]): Reminder[] {
  const w = forecast.warnings[0];
  const potMonth = w ? monthName(w.startDate) : undefined;
  const out: Reminder[] = [];
  for (const a of actions) {
    if (!a.date) continue;
    if (a.id === "set_aside_payday" || a.type === "save") {
      out.push({ date: a.date, text: `Payday. Move £${setAsideAmount(a)} to your ${potMonth ? `${potMonth} ` : ""}pot today.` });
    } else {
      out.push({ date: a.date, text: `Today: ${a.title.replace(/[.\s]+$/, "")}.` });
    }
  }
  return out;
}

const STATUS_WORD = { comfortable: "Comfortable", tight: "Tight", short: "Short" } as const;

/** First Friday on or after `from`. */
export function nextFriday(from: ISODate): ISODate {
  const d = parseISO(from);
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
  return toISO(d);
}

/**
 * Payday reminder (plan section 17.3), e.g. "Fri 13 Nov. Wage due today. This week looks Comfortable.
 * Lowest point ahead: about −£140 on Mon 1 Feb. Your plan is on track."
 */
export function buildReminderMessage(
  forecast: Forecast,
  opts: { date?: ISODate; planForecast?: Forecast; planActions?: ActionCandidate[] } = {},
): string {
  const date = opts.date ?? nextFriday(forecast.today);
  const parts: string[] = [`${formatDay(date)}.`];

  const setAside = (opts.planActions ?? []).find((a) => a.date === date && (a.id === "set_aside_payday" || a.type === "save"));
  if (setAside) {
    const w = forecast.warnings[0];
    parts.push(`Payday. Move £${setAsideAmount(setAside)} to your ${w ? `${monthName(w.startDate)} ` : ""}pot today.`);
  } else {
    const day = forecast.days.find((d) => d.date === date);
    const credit = day?.events.filter((e) => e.amount > 0).sort((a, b) => b.amount - a.amount)[0];
    if (credit) parts.push(`${credit.label.replace(/[.\s]+$/, "")} due today.`);
  }

  const week = forecast.weeks.find((wk) => {
    const start = parseISO(wk.startDate).getTime();
    const t = parseISO(date).getTime();
    return t >= start && t < start + 7 * 86_400_000;
  });
  if (week) parts.push(`This week looks ${STATUS_WORD[week.status]}.`);

  const ahead = opts.planForecast ?? forecast;
  parts.push(`Lowest point ahead: ${formatMoney(ahead.headroom.lowest, { about: true })} on ${formatDay(ahead.headroom.lowestDate)}.`);
  parts.push(opts.planForecast ? "Your plan is on track." : "Open Headroom to see what you can do.");

  let msg = parts.join(" ");
  if (msg.length > MAX_MESSAGE_CHARS) msg = msg.slice(0, MAX_MESSAGE_CHARS - 1).replace(/\s+\S*$/, "") + ".";
  return msg;
}

// ---------------------------------------------------------------------------
// Sending: n8n first, then Twilio directly, then a simulated send so the demo rail still moves.
// ---------------------------------------------------------------------------

export type SendPath = "n8n" | "twilio" | "simulated" | "failed";
export interface SendResult { path: SendPath; activity: Activity | null; detail: string; }

async function recipientFor(profileId: string): Promise<string> {
  try {
    const p = await getStore().getProfile(profileId);
    if (isRealRecipient(p.whatsappTo)) return p.whatsappTo;
  } catch {
    /* fall through to the demo number */
  }
  return process.env.DEMO_WHATSAPP_TO ?? "";
}

function first60(message: string): string {
  return message.replace(/\s+/g, " ").slice(0, 60);
}

async function sendWithFallback(opts: {
  workflow: "plan" | "reminder";
  profileId: string;
  message: string;
  payload: Record<string, unknown>;
  kind: ActivityKind;
  title: string;
}): Promise<SendResult> {
  const to = await recipientFor(opts.profileId);
  let why = "";

  if (n8nEnabled() && n8nUrl(opts.workflow)) {
    const res = await postToN8n(opts.workflow, { profileId: opts.profileId, to, message: opts.message, ...opts.payload });
    // n8n sends the message and calls back /api/activity, so the rail entry comes from n8n.
    if (res.ok) return { path: "n8n", activity: null, detail: "Sent to n8n" };
    why = `n8n failed (${res.error ?? res.status}). `;
  } else {
    why = n8nEnabled() ? "n8n not set up. " : "n8n switched off. ";
  }

  if (twilioConfigured() && isRealRecipient(to)) {
    const tw = await sendTwilioMessage({ to, body: opts.message });
    if (tw.ok) {
      const activity = await recordActivity({ profileId: opts.profileId, kind: opts.kind, title: opts.title, detail: `${why}Sent directly. ${first60(opts.message)}`, source: "fallback" });
      return { path: "twilio", activity, detail: `${why}Sent directly with Twilio` };
    }
    const activity = await recordActivity({ profileId: opts.profileId, kind: "error", title: "WhatsApp message failed", detail: `${why}Twilio: ${tw.error ?? tw.status}`, source: "fallback" });
    return { path: "failed", activity, detail: `${why}Twilio failed: ${tw.error ?? tw.status}` };
  }

  const missing = !twilioConfigured() ? "no Twilio keys set" : "no demo phone number set";
  const activity = await recordActivity({
    profileId: opts.profileId,
    kind: opts.kind,
    title: opts.title,
    detail: `${why}Simulated: ${missing}. ${first60(opts.message)}`,
    source: "fallback",
  });
  return { path: "simulated", activity, detail: `${why}Simulated (${missing})` };
}

/** Send the plan message (plan section 17.5). Never throws. */
export async function sendPlanMessage(opts: { profileId: string; message: string; reminders?: Reminder[] }): Promise<SendResult> {
  try {
    return await sendWithFallback({
      workflow: "plan",
      profileId: opts.profileId,
      message: opts.message,
      payload: { reminders: opts.reminders ?? [] },
      kind: "message_sent",
      title: "Plan sent by WhatsApp",
    });
  } catch (err) {
    console.error("[sendPlanMessage] failed:", err);
    return { path: "failed", activity: null, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Send the payday reminder now (demo button and n8n schedule). Never throws. */
export async function sendReminder(profileId: string, today: ISODate = DEMO_TODAY): Promise<SendResult & { message: string }> {
  let message = "";
  try {
    const forecast = runForecast(profileId, today);
    const plans = await getStore().listPlans(profileId).catch(() => []);
    const latest = plans[0];
    const planForecast = latest ? runForecast(profileId, today, { actionIds: latest.actionIds }) : undefined;
    const planActions = latest ? forecast.actions.filter((a) => latest.actionIds.includes(a.id)) : [];
    message = buildReminderMessage(forecast, { planForecast, planActions });
    const res = await sendWithFallback({
      workflow: "reminder",
      profileId,
      message,
      payload: {},
      kind: "reminder_sent",
      title: "Friday reminder sent by WhatsApp",
    });
    return { ...res, message };
  } catch (err) {
    console.error("[sendReminder] failed:", err);
    return { path: "failed", activity: null, detail: err instanceof Error ? err.message : String(err), message };
  }
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/**
 * Accept a plan (plan section 18): forecast with and without the actions -> createPlan ->
 * "Plan saved" -> send the WhatsApp message -> return.
 */
export async function acceptPlan(personaId: string, actionIds: string[], today: ISODate = DEMO_TODAY): Promise<PlanResponse> {
  const before = runForecast(personaId, today);
  const known = new Map(before.actions.map((a) => [a.id, a]));
  const ids = [...new Set(actionIds)].filter((id) => known.has(id));
  if (ids.length === 0) throw new PlanError("Pick at least one option.");
  const actions = ids.map((id) => known.get(id) as ActionCandidate);

  const after = runForecast(personaId, today, { actionIds: ids });
  const store = getStore();
  const plan = await store.createPlan({
    profileId: personaId,
    actionIds: ids,
    lowestBefore: Math.round(before.headroom.lowest * 100) / 100,
    lowestAfter: Math.round(after.headroom.lowest * 100) / 100,
    lowestDate: after.headroom.lowestDate,
  });

  const activity: Activity[] = [];
  const saved = await recordActivity({
    profileId: personaId,
    kind: "plan_created",
    title: "Plan saved",
    detail: `${actions.length} ${actions.length === 1 ? "option" : "options"}: ${actions.map((a) => a.title).join("; ")}`,
    source: "app",
  });
  if (saved) activity.push(saved);

  const message = buildPlanMessage(before, actions, after.headroom.lowest);
  const reminders = buildPlanReminders(before, actions);
  const sent = await sendPlanMessage({ profileId: personaId, message, reminders });
  if (sent.activity) activity.unshift(sent.activity);

  return { plan, activity, lowestAfter: after.headroom.lowest };
}

/** Distress or structural deficit: log the handoff, notify n8n if set up, return the contacts. */
export async function requestHumanHelp(personaId: string, reason: string): Promise<{ contacts: typeof HELP_CONTACTS; activity: Activity | null }> {
  const res = await postToN8n("handoff", { profileId: personaId, reason }).catch(() => ({ ok: false }));
  const activity = await recordActivity({
    profileId: personaId,
    kind: "handoff_sent",
    title: "Asked for a person to help",
    detail: reason.slice(0, 200),
    source: res.ok ? "n8n" : "app",
  });
  return { contacts: HELP_CONTACTS, activity };
}
