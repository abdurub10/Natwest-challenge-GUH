// Aisha Rahman, 34, Levenshulme, Manchester M19 (plan section 4).
// Every value here is a persona fact or a labelled tuning knob. The engine never hard-codes outputs:
// the forecast follows from these values through the generator and the rules.
import type { Category, ISODate } from "../types";

export interface DirectDebit {
  id: string;
  description: string; // as it appears on the statement
  label: string; // plain-English label for the customer
  category: Category;
  dayOfMonth: number;
  amount: number;
  /** Amount changes over the history, applied in order: from this date the amount is `amount`. */
  changes?: { from: ISODate; amount: number }[];
  /** Months (1-12) the debit is collected in. Default: every month. */
  months?: number[];
}

export interface WeeklySpend {
  id: string;
  description: string;
  label: string;
  category: Category;
  weekdays: number[]; // 0 Sun … 6 Sat
  range: [number, number]; // uniform amount range
  everyOtherWeek?: boolean;
  termTimeOnly?: boolean;
}

export interface OneOff { date: ISODate; description: string; amount: number; category: Category; label?: string }

export interface SchoolHoliday { from: ISODate; to: ISODate; label: string }

export interface BnplAgreement {
  id: string; provider: string; description: string; label: string; item: string;
  purchased: ISODate; total: number; instalment: number; dueDates: ISODate[];
}

export interface Persona {
  id: string;
  name: string;
  firstName: string;
  childName: string;
  place: string;
  council: string;
  ratesYear: string;
  wage: {
    description: string; label: string; weekday: number; hourlyRate: number; netPerHour: number;
    hours: { min: number; max: number; mode: number };
    /** Earlier spells with different usual hours (zero-hours contract), newest last. Before `until`. */
    hoursHistory?: { until: ISODate; min: number; max: number; mode: number; reason: string }[];
    mileage: { amount: number; chance: number };
  };
  universalCredit: {
    description: string; label: string;
    claimStart: ISODate; periodStartDay: number; payDay: number;
    standardAllowance: number; childElement: number; housingElement: number;
    workAllowance: number; taper: number;
  };
  childBenefit: { description: string; label: string; amount: number; anchor: ISODate; everyDays: number };
  directDebits: DirectDebit[];
  /** BNPL agreements the customer has told us about (instalment dates are known in advance). */
  bnpl: BnplAgreement[];
  /** BNPL payments seen in the history window (an earlier agreement, now finished). */
  pastBnpl: OneOff[];
  weekly: WeeklySpend[];
  summerClub: { description: string; label: string; amount: number; weekday: number; from: ISODate; weeks: number };
  occasional: { merchants: string[]; range: [number, number] };
  christmas: { year: number; items: { day: number; description: string; share: number }[]; railFare: { day: number; description: string; amount: number } };
  /** One-offs that repeat once a year (the `annual` rule learns them from the history). */
  annualOneOffs: OneOff[];
  schoolHolidays: SchoolHoliday[];
  overdraftLimit: number;
  energyChangePct: number; // assumed change at each price cap date
  councilTaxAprilRisePct: number;
  telecomAprilRise: number;
  socialTariffPrice: number;
  councilTaxSupportMonthly: [number, number];
  /** Tuning knobs (plan section 11). Adjust until the section 4 targets hold. */
  knobs: {
    seed: number;
    historyStart: ISODate;
    balanceToday: number;
    occasionalPerMonth: number;
    christmasExtra: number;
    aldiRange: [number, number];
    tescoRange: [number, number];
    potAmount: number;
  };
}

export const AISHA: Persona = {
  id: "aisha",
  name: "Aisha Rahman",
  firstName: "Aisha",
  childName: "Zara",
  place: "Levenshulme, Manchester M19",
  council: "Manchester City Council",
  ratesYear: "2025/26 (illustrative)",
  wage: {
    description: "BRIGHTSIDE HOMECARE LTD",
    label: "Wage from Brightside Homecare",
    weekday: 5,
    hourlyRate: 12.21,
    netPerHour: 11.62,
    hours: { min: 20, max: 28, mode: 24 },
    mileage: { amount: 18, chance: 0.25 },
  },
  universalCredit: {
    description: "DWP UC",
    label: "Universal Credit",
    claimStart: "2023-12-27",
    periodStartDay: 27,
    payDay: 2,
    standardAllowance: 400.14,
    childElement: 292.81,
    housingElement: 650.0,
    workAllowance: 411,
    taper: 0.55,
  },
  childBenefit: { description: "HMRC CHILD BENEFIT", label: "Child Benefit", amount: 104.2, anchor: "2026-11-09", everyDays: 28 },
  directDebits: [
    { id: "rent", description: "J PATEL PROPERTIES SO", label: "Rent to J Patel Properties", category: "rent", dayOfMonth: 5, amount: 725 },
    { id: "council_tax", description: "MANCHESTER CITY COUNCIL CTAX", label: "Council tax", category: "council_tax", dayOfMonth: 1, amount: 110, months: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1] },
    { id: "energy", description: "OCTOPUS ENERGY", label: "Octopus Energy", category: "energy", dayOfMonth: 15, amount: 98, changes: [{ from: "2026-01-15", amount: 110 }] },
    { id: "water", description: "UNITED UTILITIES WATER", label: "United Utilities water", category: "water", dayOfMonth: 20, amount: 38 },
    { id: "broadband", description: "VIRGIN MEDIA", label: "Virgin Media broadband", category: "broadband", dayOfMonth: 5, amount: 32 },
    { id: "mobile", description: "O2 MOBILE", label: "O2 mobile", category: "mobile", dayOfMonth: 18, amount: 20.2, changes: [{ from: "2026-04-01", amount: 22 }] },
    { id: "insurance", description: "ADMIRAL INSURANCE", label: "Admiral car insurance", category: "insurance", dayOfMonth: 22, amount: 68 },
    { id: "tv", description: "TV LICENCE MBP", label: "TV licence", category: "subscription", dayOfMonth: 3, amount: 14.54 },
    { id: "disney", description: "DISNEY PLUS", label: "Disney+", category: "subscription", dayOfMonth: 9, amount: 4.99 },
  ],
  bnpl: [
    {
      id: "klarna", provider: "Klarna", description: "KLARNA PAYMENTS", label: "Klarna payment", item: "school shoes and coat",
      purchased: "2026-10-28", total: 82, instalment: 27.33, dueDates: ["2026-11-28", "2026-12-28", "2027-01-28"],
    },
  ],
  pastBnpl: [
    { date: "2025-11-28", description: "KLARNA PAYMENTS", amount: 27.33, category: "bnpl" },
    { date: "2025-12-28", description: "KLARNA PAYMENTS", amount: 27.33, category: "bnpl" },
  ],
  weekly: [
    { id: "aldi", description: "ALDI STORES", label: "Aldi groceries", category: "groceries", weekdays: [6], range: [80, 100] },
    { id: "tesco", description: "TESCO EXPRESS", label: "Tesco Express", category: "groceries", weekdays: [2, 4], range: [8, 14] },
    { id: "esso", description: "ESSO FUEL", label: "Esso fuel", category: "fuel", weekdays: [5], range: [32, 40] },
    { id: "cash", description: "CASH WITHDRAWAL", label: "Cash", category: "cash", weekdays: [5], range: [20, 20] },
    { id: "takeaway", description: "JUST EAT", label: "Takeaway", category: "takeaway", weekdays: [5], range: [18, 18], everyOtherWeek: true },
    { id: "parentpay", description: "PARENTPAY DINNERS", label: "ParentPay school dinners", category: "school", weekdays: [1], range: [12, 12], termTimeOnly: true },
    { id: "kidsclub", description: "KIDS CLUB LEVENSHULME", label: "Kids Club", category: "school", weekdays: [1], range: [24, 24], termTimeOnly: true },
  ],
  summerClub: { description: "SUMMER HOLIDAY CLUB", label: "Summer holiday club", amount: 60, weekday: 1, from: "2026-07-27", weeks: 6 },
  occasional: {
    merchants: ["BOOTS", "PRIMARK", "SMYTHS TOYS", "SCHOOL TRIP", "PARTY PRESENT", "TFGM BUS", "ASDA", "SUPERDRUG", "HAIRCUT"],
    range: [20, 45],
  },
  christmas: {
    year: 2025,
    // Spread over 1 to 24 December, most of it on Christmas Eve (food shop and last presents, after that day's wage).
    items: [
      { day: 5, description: "SMYTHS TOYS XMAS", share: 0.17 },
      { day: 12, description: "AMAZON XMAS", share: 0.11 },
      { day: 18, description: "PRIMARK XMAS", share: 0.07 },
      { day: 20, description: "AMAZON XMAS", share: 0.1 },
      { day: 24, description: "ALDI XMAS FOOD", share: 0.55 },
    ],
    railFare: { day: 19, description: "NORTHERN RAIL BRADFORD", amount: 50 },
  },
  annualOneOffs: [
    { date: "2026-01-21", description: "ZARA BIRTHDAY", amount: 60, category: "birthday", label: "Zara's birthday" },
    // Tuning: the costs below happen outside the November to February window. They keep the past year
    // in balance (the persona's usual months run a surplus) so the history shows overdraft only in
    // January and October 2026, as section 4 describes. The MOT is in March so February stays clear.
    { date: "2026-02-13", description: "HALF TERM HOLIDAY CLUB", amount: 120, category: "school", label: "Half-term holiday club" },
    { date: "2026-03-12", description: "KWIK FIT MOT", amount: 180, category: "car", label: "MOT and service" },
    { date: "2026-03-13", description: "DVLA VEHICLE TAX", amount: 165, category: "car", label: "Car tax" },
    { date: "2026-04-02", description: "EASTER HOLIDAY CLUB", amount: 210, category: "school", label: "Easter holiday club" },
    { date: "2026-05-22", description: "MAY HALF TERM CLUB", amount: 140, category: "school", label: "May half-term club" },
    { date: "2026-06-20", description: "CURRYS", amount: 150, category: "other", label: "Washing machine" },
    { date: "2026-08-08", description: "CHESTER ZOO", amount: 70, category: "other", label: "Summer day out" },
    { date: "2026-09-03", description: "SCHOOLWEAR CENTRE", amount: 58, category: "school", label: "School uniform" },
    { date: "2026-09-05", description: "CLARKS SHOES", amount: 37, category: "school", label: "School shoes" },
    { date: "2026-10-03", description: "HALFORDS AUTOCENTRE", amount: 210, category: "car", label: "Car repair" },
  ],
  schoolHolidays: [
    { from: "2025-10-20", to: "2025-10-24", label: "October half term" },
    { from: "2025-12-21", to: "2026-01-01", label: "Christmas holidays" },
    { from: "2026-02-16", to: "2026-02-20", label: "February half term" },
    { from: "2026-04-03", to: "2026-04-17", label: "Easter holidays" },
    { from: "2026-05-25", to: "2026-05-29", label: "May half term" },
    { from: "2026-07-24", to: "2026-09-01", label: "Summer holidays" },
    { from: "2026-10-19", to: "2026-10-23", label: "October half term" },
    { from: "2026-12-21", to: "2027-01-01", label: "Christmas holidays" },
    { from: "2027-02-15", to: "2027-02-19", label: "February half term" },
    { from: "2027-03-26", to: "2027-04-09", label: "Easter holidays" },
    { from: "2027-05-31", to: "2027-06-04", label: "May half term" },
    { from: "2027-07-23", to: "2027-09-01", label: "Summer holidays" },
    { from: "2027-10-25", to: "2027-10-29", label: "October half term" },
    { from: "2027-12-20", to: "2027-12-31", label: "Christmas holidays" },
  ],
  overdraftLimit: 250,
  energyChangePct: 4,
  councilTaxAprilRisePct: 5,
  telecomAprilRise: 1.8,
  socialTariffPrice: 15,
  councilTaxSupportMonthly: [40, 70],
  knobs: {
    seed: 20261107,
    historyStart: "2025-11-01",
    balanceToday: 285,
    occasionalPerMonth: 3,
    christmasExtra: 380,
    aldiRange: [77, 93],
    tescoRange: [7, 13],
    potAmount: 150,
  },
};

export const PERSONAS: Record<string, Persona> = { aisha: AISHA };

export class UnknownPersonaError extends Error {
  constructor(id: string) {
    super(`Unknown persona: ${id}`);
    this.name = "UnknownPersonaError";
  }
}

export function getPersona(id: string): Persona {
  const p = PERSONAS[id];
  if (!p) throw new UnknownPersonaError(id);
  return p;
}

export function isSchoolHoliday(p: Persona, d: ISODate): boolean {
  return p.schoolHolidays.some((h) => d >= h.from && d <= h.to);
}
