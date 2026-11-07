// Typed fixture: a realistic ForecastResponse for Aisha on 2026-11-07 (plan section 4).
// Used ONLY by frontend scratch checks and as a type-checked example of the API shape.
// The app itself always fetches the real routes; never import this from a screen.
import type {
  ActionCandidate,
  CalendarEvent,
  Cause,
  DayPoint,
  Forecast,
  ForecastResponse,
  ISODate,
  Series,
  Status,
  Warning,
  Week,
} from "@/lib/forecast/types";
import { formatDay, parseISO, toISO } from "@/lib/format";

const TODAY = "2026-11-07";
const HORIZON = 90;
const BALANCE_TODAY = 270;
const BANK_HOLIDAYS = new Set(["2026-12-25", "2026-12-28", "2027-01-01"]);

const addDays = (d: ISODate, n: number): ISODate => {
  const dt = parseISO(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
};
const weekday = (d: ISODate) => parseISO(d).getUTCDay(); // 0 Sun .. 6 Sat
const isWorking = (d: ISODate) => weekday(d) !== 0 && weekday(d) !== 6 && !BANK_HOLIDAYS.has(d);
const prevWorking = (d: ISODate) => {
  let x = d;
  while (!isWorking(x)) x = addDays(x, -1);
  return x;
};
const nextWorking = (d: ISODate) => {
  let x = d;
  while (!isWorking(x)) x = addDays(x, 1);
  return x;
};
const why = (d: ISODate) => (BANK_HOLIDAYS.has(d) ? "is a bank holiday" : weekday(d) === 6 ? "is a Saturday" : "is a Sunday");
const shortName = (d: ISODate) => formatDay(d).split(" ").slice(1).join(" "); // "2 Jan"

const dates: ISODate[] = Array.from({ length: HORIZON }, (_, i) => addDays(TODAY, i));
const lastDate = dates[dates.length - 1];
const inRange = (d: ISODate) => d > TODAY && d <= lastDate;

const events = new Map<ISODate, CalendarEvent[]>();
function add(e: CalendarEvent) {
  if (!inRange(e.date)) return;
  const list = events.get(e.date) ?? [];
  list.push(e);
  events.set(e.date, list);
}
function credit(due: ISODate, amount: number, label: string, seriesId: string, extra: Partial<CalendarEvent> = {}) {
  const date = prevWorking(due);
  add({ date, amount, label, seriesId, ...(date !== due ? { ruleId: "credit_before_weekend", note: `Paid early: ${shortName(due)} ${why(due)}.` } : {}), ...extra });
}
function debit(due: ISODate, amount: number, label: string, seriesId: string, extra: Partial<CalendarEvent> = {}) {
  const date = nextWorking(due);
  add({ date, amount: -amount, label, seriesId, ...(date !== due ? { ruleId: "debit_after_weekend", note: `Taken late: ${shortName(due)} ${why(due)}.` } : {}), ...extra });
}

/** Card spending: happens on the day, no working-day shift. */
function card(date: ISODate, amount: number, label: string, seriesId: string, extra: Partial<CalendarEvent> = {}) {
  add({ date, amount: -amount, label, seriesId, ...extra });
}

// Small deterministic jitter so the line is not perfectly regular.
let seed = 20261107;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100) / 100;

const termBreak = (d: ISODate) => d >= "2026-12-21" && d <= "2027-01-01";

for (const d of dates.concat(addDays(lastDate, 1))) {
  const wd = weekday(d);
  const dom = parseISO(d).getUTCDate();
  const ym = d.slice(0, 7);
  // Wages every Friday (bank holiday Fridays paid the working day before).
  if (wd === 5) credit(d, Math.round(between(262, 300)), "Wage from Brightside Homecare", "wage");
  // Monthly direct debits and standing orders.
  if (dom === 5) debit(d, 725, "Rent to J Patel Properties", "rent");
  if (dom === 5) debit(d, 32, "Virgin Media broadband", "broadband");
  if (dom === 1 && ym !== "2027-02") debit(d, 110, "Council tax", "council_tax");
  if (dom === 1 && ym === "2027-02") add({ date: d, amount: 0, label: "No council tax in February", ruleId: "council_tax_schedule", note: "No council tax in February or March." });
  if (dom === 15) {
    if (ym === "2027-01") debit(d, 114.4, "Octopus Energy", "energy", { ruleId: "energy_cap_change", note: "Assumed +4%, the size of the last price cap change. Your supplier sets the exact amount." });
    else debit(d, 110, "Octopus Energy", "energy");
  }
  if (dom === 20) debit(d, 38, "United Utilities water", "water");
  if (dom === 18) debit(d, 22, "O2 mobile", "mobile");
  if (dom === 22) debit(d, 68, "Admiral car insurance", "insurance");
  if (dom === 3) debit(d, 14.54, "TV licence", "tv");
  if (dom === 9) debit(d, 4.99, "Disney+", "disney");
  if (dom === 28 && (ym === "2026-11" || ym === "2026-12" || ym === "2027-01")) debit(d, 27.33, "Klarna payment", "klarna");
  // Weekly spending.
  if (wd === 6) card(d, Math.round(between(80, 100)), "Aldi groceries", "aldi");
  if (wd === 2 || wd === 4) card(d, Math.round(between(8, 14)), "Tesco Express", "tesco");
  if (wd === 5) {
    card(d, Math.round(between(32, 40)), "Esso fuel", "esso");
    card(d, 20, "Cash", "cash");
    if (Math.round((parseISO(d).getTime() - parseISO("2026-11-13").getTime()) / 86400000 / 7) % 2 === 0) card(d, 18, "Takeaway", "takeaway");
  }
  if (wd === 1 && !termBreak(d)) {
    debit(d, 12, "ParentPay school dinners", "parentpay");
    debit(d, 24, "Kids Club", "kidsclub");
  }
  // Occasional spending, about three times a month.
  if (dom === 7 || dom === 16 || dom === 25) card(d, Math.round(between(20, 45)), "Shopping and school costs", "occasional");
  // Christmas, as last year.
  if (d >= "2026-12-01" && d <= "2026-12-24" && (dom % 4 === 0 || dom === 23)) card(d, 54, "Christmas spending", "christmas", { ruleId: "annual_repeat", note: "Last year you spent about £380 extra in December." });
  if (d === "2027-01-21") card(d, 60, "Zara's birthday", "birthday", { ruleId: "annual_repeat", note: "Last year you spent about £60 on 21 January." });
}

// Universal Credit and Child Benefit.
credit("2026-12-02", 953, "Universal Credit", "uc");
credit("2027-01-02", 799, "Universal Credit", "uc", {
  ruleId: "uc_assessment_period",
  note: "Paid early: 2 Jan is a Saturday. About £154 less than usual: 5 paydays between 27 Nov and 26 Dec.",
});
credit("2027-02-02", 953, "Universal Credit", "uc");
for (const d of ["2026-11-09", "2026-12-07", "2027-01-04", "2027-02-01"]) credit(d, 104.2, "Child Benefit", "child_benefit");

// P50 path, then a gentle linear calibration so the low lands on the section 4 target (−£140).
const raw: number[] = [];
let bal = BALANCE_TODAY;
for (const d of dates) {
  for (const e of events.get(d) ?? []) bal += e.amount;
  raw.push(bal);
}
const lowWindow = dates.map((d, i) => ({ d, i })).filter(({ d }) => d >= "2027-01-25" && d <= "2027-02-01");
const rawLow = lowWindow.reduce((m, x) => (raw[x.i] < raw[m.i] ? x : m), lowWindow[0]);
const rampFrom = dates.indexOf("2026-12-31");
const shift = -140 - raw[rawLow.i];
const p50s = raw.map((v, i) => Math.round((v + (i <= rampFrom ? 0 : (shift * Math.min(1, (i - rampFrom) / (rawLow.i - rampFrom))))) * 100) / 100);
export const mockCalibration = { rawLow: raw[rawLow.i], shift };

function statusOf(p20: number, p50: number): Status {
  if (p50 < 0) return "short";
  if (p20 < 50) return "tight";
  return "comfortable";
}

const days: DayPoint[] = dates.map((date, i) => {
  const p50 = p50s[i];
  const spread = i === 0 ? 0 : 12 + 0.95 * i;
  const p20 = Math.round(p50 - spread);
  const p80 = Math.round(p50 + spread * 0.9);
  return { date, p20, p50: Math.round(p50), p80, events: (events.get(date) ?? []).filter((e) => e.amount !== 0 || e.ruleId), status: statusOf(p20, p50) };
});

// Weeks start Monday. 13 weeks from the Monday of this week.
const rank: Record<Status, number> = { comfortable: 0, tight: 1, short: 2 };
const firstMonday = addDays(TODAY, -((weekday(TODAY) + 6) % 7));
const weeks: Week[] = Array.from({ length: 13 }, (_, w) => {
  const startDate = addDays(firstMonday, w * 7);
  const inWeek = days.filter((d) => d.date >= startDate && d.date < addDays(startDate, 7));
  const status = inWeek.reduce<Status>((s, d) => (rank[d.status] > rank[s] ? d.status : s), "comfortable");
  const lowDay = inWeek.reduce((m, d) => (d.p50 < m.p50 ? d : m), inWeek[0]);
  const main = inWeek.flatMap((d) => d.events).reduce<CalendarEvent | undefined>((m, e) => (!m || Math.abs(e.amount) > Math.abs(m.amount) ? e : m), undefined);
  const headline = startDate >= "2026-11-30" && startDate <= "2026-12-21" && main?.seriesId !== "uc" ? "Christmas spending" : main ? `${main.label.split(" ")[0] === "Wage" ? "Wage" : main.label.replace(/ (to|from) .*/, "")} ${formatDay(main.date)}` : "A quiet week";
  return { startDate, status, lowP50: lowDay.p50, lowP20: lowDay.p20, headline };
});

// Warning: the Short stretch from plan section 4 (Mon 25 Jan to Mon 1 Feb), lowest point inside it.
const run = days.filter((d) => d.date >= "2027-01-25" && d.date <= "2027-02-01");
const lowest = run.reduce((m, d) => (d.p50 < m.p50 ? d : m), run[0]);
const warning: Warning = {
  id: `w-${run[0].date}`,
  startDate: run[0].date,
  endDate: run[run.length - 1].date,
  lowestDate: lowest.date,
  depthP50: lowest.p50,
  depthP20: lowest.p20,
  depthP80: lowest.p80,
  confidence: lowest.p80 < 0 ? "high" : "medium",
  causes: ([
    { id: "uc_five_paydays", label: "Universal Credit on Thu 31 Dec is lower", amount: 154, ruleId: "uc_assessment_period", detail: "5 paydays between 27 Nov and 26 Dec, so about £154 less. Then 33 days until the next Universal Credit on Tue 2 Feb." },
    { id: "christmas", label: "Christmas spending", amount: 380, ruleId: "annual_repeat", detail: "Last year you spent about £380 extra in December." },
    { id: "energy_review", label: "Energy direct debit review from 15 Jan", amount: 22, ruleId: "energy_cap_change", detail: "Assumed +4%, the size of the last price cap change. Your supplier sets the exact amount." },
    { id: "birthday", label: "Zara's birthday on 21 Jan", amount: 60, ruleId: "annual_repeat", detail: "Last year you spent about £60 on 21 January." },
    { id: "klarna", label: "Klarna £27 on 28 Dec and 28 Jan", amount: 55, detail: "Two payments left for the school shoes and coat bought on 28 October." },
  ] as Cause[]).sort((a, b) => b.amount - a.amount),
};

export const mockActions: ActionCandidate[] = [
  { id: "set_aside_payday", title: "Put £150 aside on Fri 11 Dec", type: "timing", summary: "Move £150 to a January pot on your best payday. It comes back on the first short day.", effectByCliff: 150, effectMonthly: 0, effortMinutes: 1, eligibility: "yes", needs: [], steps: ["One tap. We'll remind you on the day.", "Your pot is still your money."], defaultOn: true, date: "2026-12-11" },
  { id: "broadband_social_tariff", title: "Switch to a broadband social tariff", type: "claim", summary: "Virgin Media £32 a month could be about £15 on Essential Broadband.", effectByCliff: 34, effectMonthly: 17, effortMinutes: 10, eligibility: "yes", needs: ["Your Universal Credit statement"], steps: ["Call or chat with Virgin Media.", "Say \"social tariff\".", "There is no exit fee."], link: "https://www.ofcom.org.uk/phones-and-broadband/saving-money/social-tariffs", defaultOn: true },
  { id: "free_school_meals", title: "Apply for free school meals", type: "claim", summary: "No more ParentPay dinners, about £12 a week in term time.", effectByCliff: 48, effectMonthly: 50, effortMinutes: 15, eligibility: "likely", needs: ["Your National Insurance number"], steps: ["Apply through Manchester City Council.", "It takes about 15 minutes online."], link: "https://www.gov.uk/apply-free-school-meals", defaultOn: true },
  { id: "council_tax_12_months", title: "Spread council tax over 12 months", type: "timing", summary: "Your January payment could drop from £110 to about £55.", effectByCliff: 55, effectMonthly: 0, effortMinutes: 10, eligibility: "yes", needs: [], steps: ["Call or email Manchester City Council.", "Ask to pay over 12 months.", "April restarts at the new rate."], link: "https://www.manchester.gov.uk/counciltax", defaultOn: false },
  { id: "council_tax_support", title: "Check Council Tax Support", type: "claim", summary: "About £40 to £70 a month for a Universal Credit household in Band A.", effectByCliff: 40, effectMonthly: 40, effortMinutes: 20, eligibility: "check", needs: ["Your Universal Credit statement"], steps: ["Apply through the council.", "Have your Universal Credit statement ready.", "For a full check, try the Inbest or Policy in Practice calculator."], link: "https://www.manchester.gov.uk/counciltaxsupport", defaultOn: false },
  { id: "move_klarna", title: "Ask Klarna to move the 28 Jan payment", type: "timing", summary: "Move £27.33 to 5 Feb, after Universal Credit lands.", effectByCliff: 27, effectMonthly: 0, effortMinutes: 5, eligibility: "check", needs: [], steps: ["In the Klarna app, choose \"Extend due date\".", "A fee may apply. Check before you confirm."], defaultOn: false },
  { id: "talk_to_someone", title: "Talk to someone who can help", type: "help", summary: "Free, confidential help with money.", effectByCliff: 0, effectMonthly: 0, effortMinutes: 5, eligibility: "yes", needs: [], steps: ["Citizens Advice Manchester, StepChange or MoneyHelper."], defaultOn: false },
];

const S = (s: Omit<Series, "anchor" | "lastSeen"> & Partial<Pick<Series, "anchor" | "lastSeen">>): Series => ({ anchor: "2025-11-01", lastSeen: "2026-11-06", ...s });
export const mockRecurring: Series[] = [
  S({ id: "wage", label: "Brightside Homecare wage", category: "wage", cadence: "weekly", weekday: 5, amountP20: 266, amountP50: 280, amountP80: 296, direction: "in", confidence: 0.98, count: 52 }),
  S({ id: "uc", label: "Universal Credit", category: "benefit", cadence: "monthly", dayOfMonth: 2, amountP20: 799, amountP50: 953, amountP80: 960, direction: "in", confidence: 1, count: 12, lastSeen: "2026-11-02" }),
  S({ id: "child_benefit", label: "Child Benefit", category: "benefit", cadence: "four_weekly", weekday: 1, amountP20: 104.2, amountP50: 104.2, amountP80: 104.2, direction: "in", confidence: 1, count: 13, lastSeen: "2026-10-12" }),
  S({ id: "rent", label: "Rent to J Patel Properties", category: "rent", cadence: "monthly", dayOfMonth: 5, amountP20: 725, amountP50: 725, amountP80: 725, direction: "out", confidence: 1, count: 12, lastSeen: "2026-11-05" }),
  S({ id: "council_tax", label: "Manchester City Council tax", category: "council_tax", cadence: "monthly", dayOfMonth: 1, amountP20: 110, amountP50: 110, amountP80: 110, direction: "out", confidence: 0.83, count: 10, lastSeen: "2026-11-02" }),
  S({ id: "energy", label: "Octopus Energy", category: "energy", cadence: "monthly", dayOfMonth: 15, amountP20: 98, amountP50: 110, amountP80: 110, direction: "out", confidence: 1, count: 12, lastSeen: "2026-10-15" }),
  S({ id: "water", label: "United Utilities water", category: "water", cadence: "monthly", dayOfMonth: 20, amountP20: 38, amountP50: 38, amountP80: 38, direction: "out", confidence: 1, count: 12, lastSeen: "2026-10-20" }),
  S({ id: "broadband", label: "Virgin Media broadband", category: "broadband", cadence: "monthly", dayOfMonth: 5, amountP20: 32, amountP50: 32, amountP80: 32, direction: "out", confidence: 1, count: 12, lastSeen: "2026-11-05" }),
  S({ id: "mobile", label: "O2 mobile", category: "mobile", cadence: "monthly", dayOfMonth: 18, amountP20: 20.2, amountP50: 22, amountP80: 22, direction: "out", confidence: 1, count: 12, lastSeen: "2026-10-19" }),
  S({ id: "insurance", label: "Admiral car insurance", category: "insurance", cadence: "monthly", dayOfMonth: 22, amountP20: 68, amountP50: 68, amountP80: 68, direction: "out", confidence: 1, count: 12, lastSeen: "2026-10-22" }),
  S({ id: "tv", label: "TV licence", category: "subscription", cadence: "monthly", dayOfMonth: 3, amountP20: 14.54, amountP50: 14.54, amountP80: 14.54, direction: "out", confidence: 1, count: 12, lastSeen: "2026-11-03" }),
  S({ id: "disney", label: "Disney+", category: "subscription", cadence: "monthly", dayOfMonth: 9, amountP20: 4.99, amountP50: 4.99, amountP80: 4.99, direction: "out", confidence: 1, count: 12, lastSeen: "2026-10-09" }),
  S({ id: "klarna", label: "Klarna", category: "bnpl", cadence: "monthly", dayOfMonth: 28, amountP20: 27.33, amountP50: 27.33, amountP80: 27.33, direction: "out", confidence: 0.67, count: 2, anchor: "2026-10-28", lastSeen: "2026-10-28" }),
  S({ id: "aldi", label: "Aldi", category: "groceries", cadence: "weekly", weekday: 6, amountP20: 84, amountP50: 90, amountP80: 97, direction: "out", confidence: 1, count: 53 }),
  S({ id: "tesco", label: "Tesco Express", category: "groceries", cadence: "weekly", amountP20: 9, amountP50: 11, amountP80: 13, direction: "out", confidence: 0.96, count: 104 }),
  S({ id: "esso", label: "Esso fuel", category: "fuel", cadence: "weekly", weekday: 5, amountP20: 33, amountP50: 36, amountP80: 39, direction: "out", confidence: 1, count: 52 }),
  S({ id: "cash", label: "Cash", category: "cash", cadence: "weekly", weekday: 5, amountP20: 20, amountP50: 20, amountP80: 20, direction: "out", confidence: 1, count: 52 }),
  S({ id: "takeaway", label: "Takeaway", category: "takeaway", cadence: "fortnightly", weekday: 5, amountP20: 18, amountP50: 18, amountP80: 18, direction: "out", confidence: 0.92, count: 26 }),
  S({ id: "parentpay", label: "ParentPay school dinners", category: "school", cadence: "weekly", weekday: 1, amountP20: 12, amountP50: 12, amountP80: 12, direction: "out", confidence: 0.81, count: 36 }),
  S({ id: "kidsclub", label: "Kids Club", category: "school", cadence: "weekly", weekday: 1, amountP20: 24, amountP50: 24, amountP80: 24, direction: "out", confidence: 0.81, count: 36 }),
  S({ id: "christmas", label: "Christmas spending", category: "christmas", cadence: "annual", amountP20: 380, amountP50: 380, amountP80: 380, direction: "out", confidence: 0.5, count: 9, anchor: "2025-12-01", lastSeen: "2025-12-24" }),
  S({ id: "birthday", label: "Zara's birthday", category: "birthday", cadence: "annual", amountP20: 60, amountP50: 60, amountP80: 60, direction: "out", confidence: 0.5, count: 1, anchor: "2026-01-21", lastSeen: "2026-01-21" }),
  S({ id: "mot", label: "MOT and service", category: "car", cadence: "annual", amountP20: 180, amountP50: 180, amountP80: 180, direction: "out", confidence: 0.5, count: 1, anchor: "2026-02-12", lastSeen: "2026-02-12" }),
  S({ id: "uniform", label: "School uniform and shoes", category: "school", cadence: "annual", amountP20: 95, amountP50: 95, amountP80: 95, direction: "out", confidence: 0.5, count: 2, anchor: "2026-09-03", lastSeen: "2026-09-05" }),
];

const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const lows = [62, 35, -130, 88, 71, 44, 12, 58, 18, 66, 40, -96];
const lowDays = [28, 31, 29, 27, 31, 30, 29, 30, 31, 29, 4, 7];
const overdraft = [0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 7];
const five = new Set(["2026-01", "2026-05", "2026-07", "2026-10"]);

const base: Forecast = {
  personaId: "aisha",
  today: TODAY,
  horizonDays: HORIZON,
  balanceToday: BALANCE_TODAY,
  headroom: { lowest: warning.depthP50, lowestDate: warning.lowestDate, lowestP20: warning.depthP20, lowestP80: warning.depthP80, afterPlan: 70 },
  days,
  weeks,
  warnings: [warning],
  actions: mockActions,
  rulesFired: [
    { ruleId: "uc_assessment_period", date: "2026-12-31", note: "5 paydays between 27 Nov and 26 Dec, so about £154 less" },
    { ruleId: "credit_before_weekend", date: "2026-12-31", note: "Paid early: 2 Jan is a Saturday" },
    { ruleId: "credit_before_weekend", date: "2026-12-24", note: "Paid early: 25 Dec is a bank holiday" },
    { ruleId: "debit_after_weekend", date: "2026-12-07", note: "Taken late: 5 Dec is a Saturday" },
    { ruleId: "energy_cap_change", date: "2027-01-15", note: "Assumed +4%, the size of the last price cap change. Your supplier sets the exact amount." },
    { ruleId: "council_tax_schedule", date: "2027-02-01", note: "No council tax in February or March" },
    { ruleId: "annual_repeat", date: "2026-12-01", note: "Last year you spent about £380 extra in December" },
    { ruleId: "annual_repeat", date: "2027-01-21", note: "Last year you spent about £60 on Zara's birthday" },
    { ruleId: "april_telecom_rise", date: "2027-04-05", note: "Broadband and mobile up £1.80 from April" },
  ],
  recurring: mockRecurring,
  history: {
    months: months.map((m, i) => ({
      month: m,
      low: lows[i],
      lowDate: `${m}-${String(Math.min(lowDays[i], new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate())).padStart(2, "0")}`,
      overdraftDays: overdraft[i],
      fivePayday: five.has(m),
    })),
  },
};

export const mockForecast: ForecastResponse = {
  ...base,
  explanation: {
    headline: `You may be short by about £${Math.abs(warning.depthP50)} from ${formatDay(warning.startDate)} to ${formatDay(warning.endDate)}.`,
    why: warning.causes.slice(0, 4).map((c) => `${c.label}: about £${c.amount}.`),
    whatThisMeans: `Your balance is likely to go below zero for ${run.length} days unless something changes.`,
    reassurance: "This is predictable and there are 6 things you can do.",
    nextStep: "The biggest help is: Put £150 aside on Fri 11 Dec.",
    language: "en",
  },
};

/** A what-if result shaped like POST /api/whatif with the three default actions ticked. */
export function mockWhatIf(actionIds: string[]): Forecast {
  const lift = mockActions.filter((a) => actionIds.includes(a.id)).reduce((s, a) => s + a.effectByCliff, 0);
  const startIdx = days.findIndex((d) => d.date === "2026-12-11");
  const shifted = days.map((d, i) => {
    const add = i >= startIdx ? lift * Math.min(1, (i - startIdx + 1) / 30) : 0;
    const p50 = Math.round(d.p50 + add);
    const p20 = Math.round(d.p20 + add);
    return { ...d, p50, p20, p80: Math.round(d.p80 + add), status: statusOf(p20, p50) };
  });
  const low = shifted.reduce((m, d) => (d.p50 < m.p50 ? d : m), shifted[0]);
  return { ...base, days: shifted, warnings: low.p50 < 0 ? base.warnings : [], headroom: { ...base.headroom, lowest: low.p50, lowestDate: low.date, lowestP20: low.p20, lowestP80: low.p80 }, scenario: { actionIds } };
}
