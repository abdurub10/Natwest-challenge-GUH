// Actions catalogue (plan section 14). Each action changes the schedule; its pound effect is never
// typed in here, it is measured by re-running the projection with the action applied.
// Never in this catalogue: any overdraft, loan, credit card, buy-now-pay-later or salary-advance product.
import type { ActionCandidate, ActionType, DayPoint, Eligibility, ISODate, Warning } from "../types";
import type { EngineContext, Schedule, ScheduledItem } from "../model";
import { addDays, daysInMonth, isWorkingDay, makeISO, nextWorkingDay, shiftDebit, shortDay, ymd } from "../calendar/dates";
import { isSchoolHoliday } from "../seed/aisha";
import { formatDay, formatMoney } from "@/lib/format";
import { round2 } from "../rng";

/** "£27.33", or "£150" for whole pounds. */
function pounds(n: number): string {
  return Number.isInteger(round2(n)) ? formatMoney(n) : `£${round2(n).toFixed(2)}`;
}

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** What an action can see about the forecast it is improving. */
export interface ActionBase {
  ctx: EngineContext;
  today: ISODate;
  days: DayPoint[];
  warning?: Warning;
  schedule: Schedule;
}

export interface ActionDefinition {
  id: string;
  type: ActionType;
  effortMinutes: number;
  link?: string;
  eligibility(base: ActionBase): Eligibility;
  /** False when the action makes no sense for this forecast (it is then not listed). */
  applies(base: ActionBase): boolean;
  title(base: ActionBase): string;
  summary(base: ActionBase): string;
  needs(base: ActionBase): string[];
  steps(base: ActionBase): string[];
  date?(base: ActionBase): ISODate | undefined;
  /** Mutates the schedule (a copy). Must be deterministic. */
  apply(schedule: Schedule, base: ActionBase): void;
}

/** Councils and suppliers need notice: a change applies from the first bill at least this many days away. */
const NOTICE_DAYS = 28;

function onUC(base: ActionBase): boolean {
  return base.ctx.detected.some((d) => d.kind === "uc" && d.active);
}

function hasSeries(base: ActionBase, id: string): boolean {
  return base.schedule.items.some((i) => i.seriesId === id);
}

// ---- set_aside_payday --------------------------------------------------------------------------

function potPlan(base: ActionBase): { saveDate: ISODate; returnDate: ISODate; amount: number } | undefined {
  const w = base.warning;
  if (!w) return undefined;
  const paydays = new Set(base.schedule.items.filter((i) => i.kind === "wage" && i.date > base.today && i.date < w.startDate).map((i) => i.date));
  let best: DayPoint | undefined;
  for (const d of base.days) if (paydays.has(d.date) && (!best || d.p20 > best.p20)) best = d;
  if (!best) return undefined;
  return { saveDate: best.date, returnDate: w.startDate, amount: base.ctx.persona.knobs.potAmount };
}

function potName(returnDate: ISODate): string {
  return `${MONTHS_LONG[ymd(returnDate).m - 1]} pot`;
}

const setAside: ActionDefinition = {
  id: "set_aside_payday",
  type: "timing",
  effortMinutes: 1,
  eligibility: () => "yes",
  applies: (b) => !!potPlan(b),
  date: (b) => potPlan(b)?.saveDate,
  title: (b) => {
    const p = potPlan(b) as NonNullable<ReturnType<typeof potPlan>>;
    return `Put ${formatMoney(p.amount)} aside on ${formatDay(p.saveDate)}`;
  },
  summary: (b) => {
    const p = potPlan(b) as NonNullable<ReturnType<typeof potPlan>>;
    return `Move ${formatMoney(p.amount)} into a ${potName(p.returnDate)} on payday and leave it there. It comes back to you on ${formatDay(p.returnDate)}, when money runs short.`;
  },
  needs: () => [],
  steps: (b) => {
    const p = potPlan(b) as NonNullable<ReturnType<typeof potPlan>>;
    return [
      "One tap. We'll remind you on the day.",
      "Your pot is still your money. You can take it out at any time.",
      `It moves back to your account on ${formatDay(p.returnDate)}.`,
    ];
  },
  apply: (s, b) => {
    const p = potPlan(b);
    if (!p) return;
    // The forecast counts the pot as your money, so moving it changes nothing by itself. What changes
    // is that the £150 is not spent: everyday spending in the four weeks after payday is lower by
    // that amount in total (this is what a pot is for). On the return day the pot is back in the account.
    const pot = potName(p.returnDate);
    s.items.push(
      { key: `pot:out:${p.saveDate}`, date: p.saveDate, nominalDate: p.saveDate, label: `${formatMoney(p.amount)} into your ${pot}`, category: "other", kind: "pot", amount: 0, notes: [`Still your money. It comes back on ${formatDay(p.returnDate)}.`] },
      { key: `pot:back:${p.returnDate}`, date: p.returnDate, nominalDate: p.returnDate, label: `${formatMoney(p.amount)} back from your ${pot}`, category: "other", kind: "pot", amount: 0, notes: [] },
    );
    const end = addDays(p.saveDate, 27) < p.returnDate ? addDays(p.saveDate, 27) : addDays(p.returnDate, -1);
    const days: ISODate[] = [];
    for (let d = p.saveDate; d <= end; d = addDays(d, 1)) days.push(d);
    const perDay = p.amount / days.length;
    for (const d of days) s.spendAdjust.set(d, round2((s.spendAdjust.get(d) ?? 0) + perDay));
  },
};

// ---- broadband_social_tariff -------------------------------------------------------------------

const broadband: ActionDefinition = {
  id: "broadband_social_tariff",
  type: "claim",
  effortMinutes: 10,
  link: "https://www.ofcom.org.uk/phones-and-broadband/saving-money/social-tariffs",
  eligibility: (b) => (onUC(b) ? "yes" : "check"),
  applies: (b) => hasSeries(b, "broadband"),
  title: () => "Switch to a broadband social tariff",
  summary: (b) => {
    const bill = b.schedule.items.find((i) => i.seriesId === "broadband");
    const now = bill ? formatMoney(-bill.amount) : "your bill";
    return `You get Universal Credit, so you can switch to a cheaper broadband deal. About ${formatMoney(b.ctx.persona.socialTariffPrice)} a month instead of ${now}, from your next bill.`;
  },
  needs: () => ["Your Universal Credit statement"],
  steps: () => [
    "Call or chat with Virgin Media.",
    "Say \"social tariff\". Ask for Essential Broadband.",
    "There is no fee for leaving your old deal.",
  ],
  apply: (s, b) => {
    const price = b.ctx.persona.socialTariffPrice;
    for (const i of s.items) {
      if (i.seriesId !== "broadband" || i.kind !== "bill") continue;
      i.amount = -price;
      i.notes = [...i.notes.filter((n) => !n.includes("from April")), `Social tariff: about ${formatMoney(price)}.`];
      if (i.ruleId === "april_telecom_rise") delete i.ruleId;
    }
  },
};

// ---- free_school_meals -------------------------------------------------------------------------

/** First school day after the next school holiday (meals are free from the start of next term). */
function nextTermStart(base: ActionBase): ISODate | undefined {
  const p = base.ctx.persona;
  const next = p.schoolHolidays.filter((h) => h.from > base.today).sort((a, b) => (a.from < b.from ? -1 : 1))[0];
  if (!next) return undefined;
  let d = addDays(next.to, 1);
  for (let i = 0; i < 14 && (isSchoolHoliday(p, d) || !isWorkingDay(d)); i++) d = addDays(d, 1);
  return d;
}

const schoolMeals: ActionDefinition = {
  id: "free_school_meals",
  type: "claim",
  effortMinutes: 15,
  link: "https://www.gov.uk/apply-free-school-meals",
  eligibility: (b) => (onUC(b) ? "likely" : "check"),
  applies: (b) => hasSeries(b, "parentpay") && !!nextTermStart(b),
  title: () => "Apply for free school meals",
  summary: (b) => {
    const meal = b.schedule.items.find((i) => i.seriesId === "parentpay");
    const per = meal ? formatMoney(-meal.amount) : "the cost";
    return `${b.ctx.persona.childName}'s school dinners could be free. That saves ${per} a week in term time, from ${formatDay(nextTermStart(b) as ISODate)}.`;
  },
  needs: () => ["Your National Insurance number", "Your Universal Credit statement"],
  steps: (b) => [
    `Apply through ${b.ctx.persona.council}. It takes about 15 minutes online.`,
    "Most families on Universal Credit in England can get them. The council will check.",
    "School dinners stop coming out of your account once it is approved.",
  ],
  apply: (s, b) => {
    const start = nextTermStart(b);
    if (!start) return;
    s.items = s.items.filter((i) => !(i.seriesId === "parentpay" && i.date >= start));
  },
};

// ---- council tax helpers -----------------------------------------------------------------------

function councilTaxBills(s: Schedule): ScheduledItem[] {
  return s.items.filter((i) => i.category === "council_tax" && i.kind === "bill").sort((a, b) => (a.date < b.date ? -1 : 1));
}
function firstNoticedBill(s: Schedule, today: ISODate): ScheduledItem | undefined {
  return councilTaxBills(s).find((i) => i.nominalDate >= addDays(today, NOTICE_DAYS));
}

const councilTaxSupport: ActionDefinition = {
  id: "council_tax_support",
  type: "claim",
  effortMinutes: 20,
  link: "https://www.manchester.gov.uk/counciltaxsupport",
  eligibility: () => "check",
  applies: (b) => councilTaxBills(b.schedule).length > 0 && onUC(b),
  title: () => "Check Council Tax Support",
  summary: (b) => {
    const [lo, hi] = b.ctx.persona.councilTaxSupportMonthly;
    return `${b.ctx.persona.council} may lower your council tax by about ${formatMoney(lo)} to ${formatMoney(hi)} a month. We have counted ${formatMoney(lo)}, the low end.`;
  },
  needs: () => ["Your Universal Credit statement", "Your council tax bill"],
  steps: (b) => [
    `Apply through ${b.ctx.persona.council}. Have your Universal Credit statement ready.`,
    "For a full check of everything you could get, try a free benefits calculator such as Inbest or Policy in Practice.",
  ],
  apply: (s, b) => {
    const first = firstNoticedBill(s, b.today);
    if (!first) return;
    const less = b.ctx.persona.councilTaxSupportMonthly[0];
    for (const i of councilTaxBills(s)) {
      if (i.nominalDate < first.nominalDate) continue;
      i.amount = round2(Math.min(0, i.amount + less));
      i.notes = [...i.notes, `Council Tax Support: about ${formatMoney(less)} less.`];
    }
  },
};

const councilTax12: ActionDefinition = {
  id: "council_tax_12_months",
  type: "timing",
  effortMinutes: 10,
  link: "https://www.manchester.gov.uk/counciltax",
  eligibility: () => "yes",
  applies: (b) => {
    const first = firstNoticedBill(b.schedule, b.today);
    return !!first && ymd(first.nominalDate).m !== 3;
  },
  title: () => "Spread council tax over 12 months",
  summary: (b) => {
    const plan = spreadPlan(b.schedule, b.today);
    if (!plan) return "You can ask to pay council tax in 12 smaller amounts.";
    return `You have the right to pay in 12 smaller amounts. Your ${formatDay(plan.first.date).split(" ").slice(1).join(" ")} payment would drop from ${formatMoney(-plan.first.amount)} to about ${formatMoney(plan.each)}.`;
  },
  needs: () => ["Your council tax account number"],
  steps: (b) => [
    `Call or email ${b.ctx.persona.council} and ask to pay over 12 months.`,
    "What is left this year is spread to March, so February and March are no longer free.",
    "From April the new yearly amount starts.",
  ],
  apply: (s, b) => {
    const plan = spreadPlan(s, b.today);
    if (!plan) return;
    for (const i of plan.bills) {
      i.amount = -plan.each;
      i.notes = [...i.notes, "Spread over 12 months."];
    }
    for (const due of plan.extraMonths) {
      const sh = shiftDebit(due);
      s.items.push({
        key: `ct12:${due}`, date: sh.date, nominalDate: due, label: plan.first.label, seriesId: plan.first.seriesId,
        category: "council_tax", kind: "bill", amount: -plan.each, notes: ["Spread over 12 months.", ...(sh.note ? [sh.note] : [])],
      });
    }
    // The 1 February marker no longer applies.
    s.items = s.items.filter((i) => !(i.kind === "info" && i.category === "council_tax" && plan.extraMonths.some((d) => d.slice(0, 7) === i.date.slice(0, 7))));
  },
};

/** Remaining instalments of this council tax year (to March), from the first bill with enough notice, spread evenly to March. */
function spreadPlan(s: Schedule, today: ISODate) {
  const first = firstNoticedBill(s, today);
  if (!first) return undefined;
  const { y, m } = ymd(first.nominalDate);
  const yearEnd = makeISO(m <= 3 ? y : y + 1, 3, 31);
  const bills = councilTaxBills(s).filter((i) => i.nominalDate >= first.nominalDate && i.nominalDate <= yearEnd);
  const total = -bills.reduce((t, i) => t + i.amount, 0);
  const dom = ymd(first.nominalDate).day;
  const months: ISODate[] = [];
  for (let d = first.nominalDate; d <= yearEnd; ) {
    months.push(d);
    const n = ymd(d);
    d = makeISO(n.y, n.m + 1, Math.min(dom, daysInMonth(n.m === 12 ? n.y + 1 : n.y, n.m === 12 ? 1 : n.m + 1)));
  }
  if (months.length <= bills.length) return undefined;
  const each = round2(total / months.length);
  const billMonths = new Set(bills.map((i) => i.nominalDate.slice(0, 7)));
  return { first, bills, each, extraMonths: months.filter((d) => !billMonths.has(d.slice(0, 7))) };
}

// ---- move_klarna -------------------------------------------------------------------------------

function klarnaMove(base: ActionBase): { item: ScheduledItem; to: ISODate } | undefined {
  const w = base.warning;
  if (!w || !w.causes.some((c) => c.id === "klarna")) return undefined;
  const item = base.schedule.items.find((i) => i.seriesId === "klarna" && i.date >= w.startDate && i.date <= w.endDate);
  if (!item) return undefined;
  const nextUC = base.schedule.items.find((i) => i.kind === "uc" && i.date > w.endDate) ?? base.schedule.items.find((i) => i.kind === "uc" && i.date > item.date);
  const to = nextWorkingDay(addDays(nextUC ? nextUC.date : addDays(w.endDate, 1), 3));
  return { item, to };
}

const moveKlarna: ActionDefinition = {
  id: "move_klarna",
  type: "timing",
  effortMinutes: 5,
  link: "https://www.klarna.com/uk/customer-service/",
  eligibility: () => "check",
  applies: (b) => !!klarnaMove(b),
  title: (b) => `Ask Klarna to move the ${shortDay((klarnaMove(b) as NonNullable<ReturnType<typeof klarnaMove>>).item.nominalDate)} payment`,
  summary: (b) => {
    const k = klarnaMove(b) as NonNullable<ReturnType<typeof klarnaMove>>;
    return `Move the ${pounds(-k.item.amount)} payment to ${formatDay(k.to)}, after Universal Credit lands. Klarna may charge a fee.`;
  },
  needs: () => [],
  steps: () => [
    "In the Klarna app, choose \"Extend due date\".",
    "Klarna may charge a fee for this. Check the fee before you confirm.",
  ],
  date: (b) => klarnaMove(b)?.to,
  apply: (s, b) => {
    const k = klarnaMove(b);
    if (!k) return;
    const item = s.items.find((i) => i.key === k.item.key);
    if (!item) return;
    item.date = k.to;
    item.notes = [`Moved from ${shortDay(k.item.date)}.`];
    if (item.ruleId === "debit_after_weekend") delete item.ruleId;
  },
};

// ---- talk_to_someone ---------------------------------------------------------------------------

export const HELP_CONTACTS = [
  "Citizens Advice Manchester: 0808 278 7800",
  "StepChange: 0800 138 1111",
  "MoneyHelper: 0800 138 7777",
];
export const STRUCTURAL_SUMMARY = "Your costs are higher than your income most months. That is not something to fix alone. Free help works.";

const talk: ActionDefinition = {
  id: "talk_to_someone",
  type: "help",
  effortMinutes: 5,
  link: "https://www.citizensadvice.org.uk/debt-and-money/",
  eligibility: () => "yes",
  applies: () => true,
  title: () => "Talk to someone who can help",
  summary: () => "Talking to someone is free and it works. They can look at everything with you.",
  needs: () => [],
  steps: () => [...HELP_CONTACTS],
  apply: () => {},
};

export const ACTION_DEFINITIONS: ActionDefinition[] = [setAside, broadband, schoolMeals, councilTaxSupport, councilTax12, moveKlarna, talk];

export const ACTION_IDS = ACTION_DEFINITIONS.map((a) => a.id);

/** Static metadata for every action (no effects; numbers are zero). */
export function staticCatalogue(): ActionCandidate[] {
  const titles: Record<string, string> = {
    set_aside_payday: "Put money aside on payday",
    broadband_social_tariff: "Switch to a broadband social tariff",
    free_school_meals: "Apply for free school meals",
    council_tax_support: "Check Council Tax Support",
    council_tax_12_months: "Spread council tax over 12 months",
    move_klarna: "Ask Klarna to move a payment",
    talk_to_someone: "Talk to someone who can help",
  };
  const summaries: Record<string, string> = {
    set_aside_payday: "Move some money into a pot on your best payday. It comes back when money runs short.",
    broadband_social_tariff: "A cheaper broadband deal for people on Universal Credit.",
    free_school_meals: "Free school dinners in term time.",
    council_tax_support: "Your council may lower your council tax.",
    council_tax_12_months: "Pay council tax in 12 smaller amounts instead of 10.",
    move_klarna: "Move a payment to after Universal Credit lands. A fee may apply.",
    talk_to_someone: "Free, private help with money.",
  };
  const elig: Record<string, Eligibility> = {
    set_aside_payday: "yes", broadband_social_tariff: "yes", free_school_meals: "likely", council_tax_support: "check",
    council_tax_12_months: "yes", move_klarna: "check", talk_to_someone: "yes",
  };
  return ACTION_DEFINITIONS.map((a) => ({
    id: a.id,
    title: titles[a.id],
    type: a.type,
    summary: summaries[a.id],
    effectByCliff: 0,
    effectMonthly: 0,
    effortMinutes: a.effortMinutes,
    eligibility: elig[a.id],
    needs: [],
    steps: a.id === "talk_to_someone" ? [...HELP_CONTACTS] : [],
    ...(a.link ? { link: a.link } : {}),
    defaultOn: false,
  }));
}
