# Headroom: Build Plan

GreatUniHack 2026 · University of Manchester · Saturday 7 November 2026
Hacking 12:00 to 18:00 · Judging 18:30 to 20:00
Sponsor challenge: NatWest, "AI-Powered Financial Inclusion & Resilience"

This document is the single source of truth for building Headroom. It is written to be handed to a coding assistant and to the team. Follow it in order. Do not add features that are not listed here. If something is ambiguous, choose the simplest option that keeps the demo working. The Decoy plan it replaces is kept at `decoy-plan.md` for reference only.

Research behind this plan (sources, numbers, competitor landscape) is summarised in section 2 and cited in section 28. Nothing in the pitch should be said without a source from section 28.

---

## 0. How to use this document

1. Read sections 1 to 5 to understand the product, the persona and the demo. The demo is the product for the day: every build decision serves the two-minute demo in section 25.
2. Build in the order of section 24 (timeline). The MVP is defined in section 3. Do not start stretch work until the MVP checklist in section 23 passes end to end.
3. Exact names matter. Use the route paths, type names, action ids, rule ids, environment variable names and UI copy exactly as written so that four people's work fits together.
4. Third-party SDKs change. Where this plan names an SDK method, check it against the current docs before writing the code (Anthropic Messages API tool use, ElevenLabs Agents client tools, Supabase JS, n8n Twilio node). Keep the behaviour described here even if a method name differs.
5. Event rule: all project code is written during the event. This plan is written content (prompts, seed values, copy), which is allowed.
6. Style rules for anything a customer sees: plain English at a reading age of about 9 to 11, short sentences, money as pounds not percentages, no jargon, no emojis, no shaming. The customer UI may say "written with AI" in the transparency line (section 21) because the brief asks for transparency, but never "LLM", "model", "prompt" or "agent".
7. Numbers rule: every pound figure and date a customer sees comes from the forecast engine (deterministic TypeScript). Claude writes words around numbers it is given. It never invents a number. Section 15.4 describes the check that enforces this.

---

## 1. Product summary

**One line:** Headroom shows you your money 90 days ahead, tells you plainly what is coming and why, and helps you fix it before it arrives.

**The problem.** Bank apps tell you what you spent last month. Nothing in a UK bank app tells a person on a tight budget what is going to happen next month. Yet the events that tip people into overdrafts and debt are mostly predictable: they are in the calendar. Universal Credit is cut when a weekly-paid worker's assessment period contains five paydays (four times a year). Council tax restarts every April after two free months. The energy price cap changes every quarter. Benefits move earlier before bank holidays, leaving a longer gap. Broadband and phone prices rise every April. Annual bills repeat on the same month as last year. People on low incomes are hit hardest, have the least buffer, and are the least likely to be warned.

**What Headroom does.**
1. **See ahead.** A day-by-day projected balance for the next 90 days with an honest range, built from the customer's own transaction pattern plus UK calendar rules. A time-travel scrubber lets the customer drag to any day and see what happens that day and why. A weekly strip shows each week as Comfortable, Tight or Short, like a weather forecast.
2. **One calm warning.** The first predicted shortfall is shown as a single card: when, how much, for how long, and the named causes. Every number has a "How we worked this out" panel listing the transactions and public rules used.
3. **A ranked plan.** Three to six options ordered by pounds gained by the date of the shortfall and effort needed: claim what you are owed (broadband social tariff, Council Tax Support, free school meals), change timing (move money on the extra payday, ask for 12 council tax instalments), build a small buffer, or talk to a person. Tapping an option shows the line move. "Set this up" schedules reminders and sends the plan by WhatsApp.
4. **Stay ahead.** Reminders arrive on payday by WhatsApp or SMS, so it works for people without data or without a smartphone. A voice coach answers "what if" questions ("what if my hours drop to 16 a week in January?") by re-running the forecast. Language and text size are switchable.

**Who it is for first.** People on irregular or weekly income, people on Universal Credit, families with children, and anyone who runs out of money before payday. The hero persona is Aisha (section 4).

**How the AI is used, in one sentence for judges.** The maths is deterministic and auditable (recurring-transaction detection, UK calendar rules, a bootstrap uncertainty band); the language model explains the numbers in plain English, answers questions by calling the forecast as a tool, and turns "what if" questions into scenarios; the voice layer makes it usable without reading.

**Why NatWest can ship it.** It uses only data a bank already holds (transactions, direct debits, standing orders) plus public rules. NatWest's app already aggregates other banks' accounts and already piloted Inbest's benefits calculator in 2022, so the entitlement actions have an integration path. Pre-charge alerts are proven: the FCA found automatic overdraft alerts cut charges by about 25%.

---

## 2. What the research says (use these facts in the pitch)

**The problem is large and measured.**
- 24% of UK adults (13.1 million) have low financial resilience; 10% have no cash savings at all. (FCA Financial Lives 2024)
- 4 million people in England and Wales are in a "negative budget": they spend more than they earn before any shock. (Citizens Advice, National Red Index 2025)
- £24.1 billion of income-related benefits and social tariffs go unclaimed every year across more than 7 million households. The most-missed by count are broadband social tariffs, water discounts and Council Tax Support. The barriers are awareness, complexity and stigma. (Policy in Practice, Missing Out 2025)
- 95% of households in poverty pay a poverty premium, averaging £380 a year. (Fair By Design, 2026)
- About half of working-age adults have numeracy at or below primary-school level. (National Numeracy)

**The shocks are predictable.**
- Universal Credit and non-monthly pay: paid weekly means four assessment periods a year contain five paydays; fortnightly means two periods with three paydays; four-weekly means one period with two paydays. UC falls by 55p for every extra £1 earned. (gov.uk, Universal Credit and earnings)
- UC is paid 7 days after the assessment period ends, on the same date each month; if that is a weekend or bank holiday it is paid the working day before. (gov.uk, How you're paid)
- The energy price cap changes every 1 January, 1 April, 1 July and 1 October. October to December 2026 is £1,723 a year for a typical dual-fuel direct debit household, up 4%. The January 2027 level is announced around 25 November. (Ofgem)
- Council tax is normally collected in 10 instalments, April to January, so February and March are free and April brings a restart plus the annual rise. Customers have the right to ask for 12 instalments.
- Broadband and mobile mid-contract rises are now fixed pound amounts disclosed up front, typically applied each April. (Ofcom)
- Automatic enrolment into overdraft alerts cut unarranged overdraft charges by about 25%; alerts that arrive before the money leaves work best. (FCA Occasional Paper 36)

**What already exists, so we do not rebuild it.**
- Spending categorisation, averages and subscription lists: NatWest, Lloyds, Barclays, Starling, Snoop, Emma. (Backward-looking.)
- Round-ups and auto-saving: NatWest Round Ups and Digital Regular Saver, Plum, Chip.
- Bill ring-fencing and "balance after bills": Starling Bills Manager.
- FAQ chatbots: NatWest Cora.
- Benefits calculators: Inbest (piloted by NatWest and used by MoneyHelper), Lightning Reach. Headroom links to these; it does not rebuild them.
- Forward shortfall prediction exists in US cash-advance apps (Brigit, Chime) but is tied to lending. No UK bank app forecasts shortfalls ahead, none understands Universal Credit rules or weekly pay, and none chains a forecast to entitlement and poverty-premium fixes delivered over WhatsApp or voice. That is the gap.
- Nobody has used "financial time travel" for forward-looking forecasting. Curve used the phrase in 2017 for retroactively switching which card paid.

---

## 3. Scope

### 3.1 MVP (must work by 15:45)

1. Seeded synthetic transaction history for Aisha (12 months) generated by a deterministic script, including four past five-payday dips (January, May, July, October 2026), two of which went into the overdraft (January and October), and last Christmas.
2. Forecast engine: recurring detection, UK calendar rules, 90-day projection with a P20 to P80 band, weekly status, shortfall detection with named causes.
3. `/app` mobile web app with: Home (headroom figure, 90-day chart, scrubber, weekly strip, warning card), Why panel with "How we worked this out", Plan screen with ranked actions and live what-if toggles, Set-up confirmation with activity rail.
4. Claude explanation of the warning in plain English (structured output, number-checked).
5. Claude chat coach with tools (get_forecast, simulate_scenario, list_actions) answering typed "what if" questions.
6. n8n workflow `plan-created`: receives the accepted plan, sends the WhatsApp message through Twilio, writes an activity entry back. Built-in fallback sends the same message directly if n8n is down.
7. `/behind` laptop page for the projector: detected recurring payments, rules that fired, past 12 months with the four five-payday months marked, activity rail, demo controls (reset, send Friday reminder now).

### 3.2 Stretch (only after the MVP checklist passes, in this order)

1. Voice coach: ElevenLabs agent "Headroom coach" with client tools that call the same APIs. (ElevenLabs prize.)
2. Language switch (English, Urdu, Polish) and text size switch; Claude writes explanations and replies in the chosen language; UI labels switch from a small dictionary.
3. History insight on the Why panel: "This happened to you in October and last January" with the past overdraft days.
4. `payday-reminder` n8n workflow with a schedule trigger plus the "send now" demo button.
5. "Share with an adviser": one-page summary (print to PDF) for Citizens Advice or StepChange, and the `handoff` n8n workflow that emails it.
6. Second persona toggle on `/behind` (Derek, 71, state pension, unclaimed Pension Credit, energy rise) if everything else is done.

### 3.3 Out of scope

Login, real Open Banking connections, moving real money, any credit product, native apps, a second persona in the MVP, full benefits calculation (we estimate and link), notifications for anything other than the demo phone.

---

## 4. The persona: Aisha

Use these values in the seed script, the copy and the pitch. Everything in the forecast follows from them. Rates are 2025/26 published rates, labelled "illustrative" in the UI footer; if someone has time, update to 2026/27.

| Item | Value |
|---|---|
| Name, age, place | Aisha Rahman, 34, Levenshulme, Manchester M19 |
| Family | One child, Zara, 6, Year 2 at a local primary school. Birthday 21 January. |
| Work | Domiciliary care worker, Brightside Homecare Ltd. Zero-hours contract, usually 24 hours a week, range 20 to 28. £12.21 an hour. Paid every Friday. Net pay median £280, range £255 to £310. Occasional mileage top-up £18. Drives a small car between clients. |
| Universal Credit | Claimed 27 December 2023. Assessment period runs from the 27th to the 26th of the next month. Paid on the 2nd, or the working day before if the 2nd is a weekend or bank holiday. Elements: standard allowance £400.14, child element £292.81, housing element £650.00 (maximum £1,342.95). Work allowance £411 (has housing costs). Taper 55%. |
| Child Benefit | £26.05 a week, paid every 4 weeks on a Monday (£104.20). Next: 9 November, 7 December, 4 January, 1 February. |
| Rent | £725 standing order on the 5th to "J Patel Properties" (landlord agreed the 5th so it lands after Universal Credit on the 2nd). |
| Council tax | Manchester City Council, Band A, 25% single-person discount, £110 direct debit on the 1st, April to January only. |
| Energy | Octopus Energy, £110 direct debit on the 15th. Rose from £98 to £110 last January after the winter review. |
| Water | United Utilities, £38 on the 20th. |
| Broadband | Virgin Media, £32 on the 5th. Eligible for a social tariff at about £15. |
| Mobile | O2, £22 on the 18th. Fixed rise of £1.80 every April. |
| Car insurance | Admiral, £68 on the 22nd, paid monthly (annual price would be £690, so paying monthly costs about £126 a year more: the poverty premium). |
| TV licence | £14.54 on the 3rd. |
| Streaming | Disney+ £4.99 on the 9th. |
| Buy now pay later | Klarna £27.33 on 28 November, 28 December, 28 January (school shoes and coat, £82, bought 28 October). |
| Weekly spending | Aldi groceries Saturday £80 to £100. Tesco Express top-ups Tuesday and Thursday £8 to £14. Esso fuel Friday £32 to £40. ParentPay school dinners £12 Monday in term time. Kids Club after-school care £24 Monday in term time (two afternoons). Cash £20 Friday. Takeaway every other Friday £18. |
| Occasional | Children's clothes, pharmacy, haircuts, school trips, parties: £20 to £45 about three times a month. |
| Last Christmas | About £380 more than a normal month between 1 and 24 December (toys, food, train to family in Bradford). |
| Last January | Energy direct debit rose; UC on 2 January 2026 was about £150 lower (five Fridays between 27 November and 26 December); overdraft used 26 to 31 January. |
| Overdraft | Arranged £250 at about 39% a year. Used in October 2026 (seven days, lowest minus £96, after a lower UC on 2 October plus school uniform and shoes) and in January 2026 (six days, lowest minus £130). |
| Balance today | About £270 on Saturday 7 November 2026 (UC landed Monday 2 November, rent went out Thursday 5 November, wage landed Friday 6 November). |

**Why Aisha.** One person covers irregular income, a Universal Credit family and overdraft risk. Her five-Friday problem is documented by gov.uk, happens to every weekly-paid UC claimant four times a year, and no app warns them. It also produces the most honest demo moment: December feels better than usual because five wages land in it, and those five wages are exactly why the Universal Credit paid on 31 December is lower.

**The maths the demo rests on.**
- Four-payday period: wages 4 × £280 = £1,120. UC = £1,342.95 − 0.55 × (1,120 − 411) = £953 (rounded).
- Five-payday period: wages 5 × £280 = £1,400. UC = £1,342.95 − 0.55 × (1,400 − 411) = £799. Difference about £154.
- Assessment period 27 November to 26 December 2026 contains Fridays 27 November, 4, 11, 18 and 25 December: five paydays. The 25 December wage is paid on Thursday 24 December (bank holiday), still inside the period.
- UC for that period is due Saturday 2 January 2027. That is a weekend and Friday 1 January is a bank holiday, so it is paid Thursday 31 December 2026, about £154 lower. The next UC is Tuesday 2 February: a 33-day gap instead of 31.
- Period 27 December to 26 January has wages on 31 December (early for 1 January), 8, 15 and 22 January: four paydays, so UC on 2 February is normal.
- Period 27 October to 26 November has four Fridays (30 October, 6, 13, 20 November), so UC on Wednesday 2 December is normal.
- Past five-payday periods in the seed history (employer pays the previous working day when Friday is a bank holiday): 27 November to 26 December 2025 (UC Friday 2 January 2026 lower), 27 March to 26 April 2026 (Good Friday wage moved to 2 April; UC paid Friday 1 May lower), 27 May to 26 June 2026 (UC Thursday 2 July lower), 27 August to 26 September 2026 (UC Friday 2 October lower). Four a year, exactly as gov.uk says.

**The headline forecast (tune the seed until it lands here; the UI always shows what the engine says, never these numbers hard-coded).**
- Today: about £270.
- Late November is Tight (about £20 to £60 on 1 December before UC lands on 2 December). This is normal for Aisha: the end of every month is tight.
- Lowest point in the next 90 days: about −£140 between Thursday 28 January and Monday 1 February 2027 (acceptable range for the seed: −£100 to −£180), with a band of roughly −£230 to −£60. The Short stretch starts around Monday 25 January and ends when normal UC lands on Tuesday 2 February.
- Named causes, in order of size: UC on 31 December about £154 lower (five paydays between 27 November and 26 December) and then 33 days until the next UC; Christmas spending (about £380 extra last year); energy direct debit review from 15 January (assumed +4%, the size of the last price cap change); Zara's birthday on 21 January (£60 last year); Klarna £27 on 28 December and 28 January.
- After the recommended plan (put £150 aside on Friday 11 December, broadband social tariff, free school meals): lowest point about +£70, and headroom grows by about £65 a month afterwards.

---

## 5. User journeys and demo setup

### 5.1 Aisha (customer, on the phone)

1. Opens Headroom. Sees "Your next 90 days" with the headroom figure: "Lowest point: about −£140 on Mon 1 Feb". The 90-day chart shows a calm line with a shaded range dipping below zero in the last week of January. The weekly strip shows most weeks Comfortable, the week of 23 November Tight, the week of 18 January Tight, the week of 25 January Short.
2. Drags the scrubber to 31 December. The day card reads: "Thu 31 Dec. Universal Credit lands early because 2 Jan is a Saturday: about £799, which is £154 less than usual. Your wage also lands today. Projected balance after today: about £1,100." Drags to 28 January: "Thu 28 Jan. Klarna £27.33 is due. Projected balance: about −£140 (between −£230 and −£60). You are in the Short stretch that started on 25 Jan. Universal Credit lands on Tue 2 Feb."
3. Taps the warning card. The Why panel explains in plain English (Claude, from engine facts) and lists "How we worked this out": the five paydays, the 55p taper, the 33-day gap, the Christmas pattern, the energy assumption. A line under it says "This happened to you in October and last January" (stretch).
4. Taps "See what you can do". The Plan screen lists the ranked options with pound chips. She toggles "Put £150 aside on Fri 11 Dec" and the line lifts; toggles "Broadband social tariff" and "Free school meals" and the lowest point reads +£70.
5. Taps "Set this up". Confirmation: reminders scheduled for Fri 11 Dec and each Friday, plan sent by WhatsApp. The activity rail shows "Plan sent by WhatsApp 14:32".
6. Taps "Ask" and types or says: "What if my hours drop to 16 a week in January?" The coach answers with the new lowest point, one suggestion, and offers to send the plan to Citizens Advice because that change is structural, not timing.

### 5.2 The judge (second run)

Reset from `/behind`. Hand the phone to the judge with the scrubber on today. Invite them to drag to January and ask the coach one question of their own. Suggested chips are on the Ask screen so they do not have to think of one.

### 5.3 Devices and choreography

| Device | Shows | Owner |
|---|---|---|
| Phone 1 (presenter) | `/app` in the browser, full screen | A |
| Laptop 1 on the projector | `/behind` on the left, phone mirror (browser responsive mode of `/app`) on the right | D |
| Phone 2 or Phone 1 | WhatsApp, joined to the Twilio sandbox, receiving the plan message live | D |
| Laptop 2 | Backup video ready in a tab; hotspot | B |

Checks before each judge: hotspot on, `/api/health` green, WhatsApp sandbox session still active (the sandbox needs the phone to have sent the join message within the last 24 hours; re-send it at 17:30), reset done.

### 5.4 Hidden demo controls (on `/behind`, never on the phone)

- Reset: clears plans and activity, restores the default settings.
- Send Friday reminder now: fires the `payday-reminder` workflow so the WhatsApp message arrives on stage without waiting for Friday.
- n8n off: forces the built-in fallback so the demo survives an n8n outage.
- Persona switch (stretch only).

---

## 6. Architecture

```
 Phone: /app (customer)                     Laptop: /behind (projector)
   chart, scrubber, plan, ask, voice          rules fired, recurring, history,
        |                                     activity rail, demo controls
        v                                            |
 +-----------------------------------------------------------------+
 |  Next.js on Vercel (API routes in src/app/api)                  |
 |   /api/forecast     deterministic engine, cached per persona    |
 |   /api/whatif       engine with a Scenario applied              |
 |   /api/explain      Claude writes the Why from engine facts     |
 |   /api/coach        Claude chat with tools                      |
 |   /api/plan         accept actions -> n8n plan-created          |
 |   /api/activity     n8n callbacks (secret) + read               |
 |   /api/voice/token  ElevenLabs signed url (stretch)             |
 |   /api/demo/*       reset, reminder-now, n8n toggle             |
 +-----------------------------------------------------------------+
        |                    |                        ^
        v                    v                        | HTTP callback with secret
 Supabase Postgres     Anthropic API              n8n Cloud
 (plans, activity,     (Claude)                   plan-created, payday-reminder,
  settings)                                       handoff  -> Twilio WhatsApp
```

Principles:
1. **The engine is pure.** `src/lib/forecast/*` has no I/O. Given a persona seed, a date and a scenario, it returns the same `Forecast` every time. API routes, the chat tools and the voice tools all call the same functions.
2. **Claude never does arithmetic.** It receives a `Facts` object with every number already computed and labelled, and returns structured text. A checker rejects any output containing a pound amount or date not in the facts.
3. **All writes go through API routes** with the Supabase service key. The browser only reads. If Supabase is not ready by 14:00, `src/lib/store.ts` falls back to an in-memory store; the interface is the same.
4. **Business actions live in one module** (`src/lib/actions/run.ts`): `acceptPlan`, `recordActivity`, `sendPlanMessage`. API routes, n8n callbacks and the fallback path call the same functions.
5. **Polling, not realtime.** The activity rail polls `/api/activity` every 3 seconds. Supabase Realtime is not needed.
6. **One shared demo profile** with id `aisha`. No login, no pairing.

---

## 7. Stack and setup

| Concern | Choice | Reason |
|---|---|---|
| Web framework | Next.js (App Router), TypeScript | One repo for the app, the projector page and the API |
| Styling | Tailwind CSS | Fast, tokens in section 19 |
| Charts | Recharts | Range areas for the band in minutes |
| Dates | date-fns | Reliable date arithmetic for assessment periods and bank holidays |
| Icons | lucide-react | Sun, CloudSun, CloudRain, Calendar, MessageCircle, Mic |
| Fonts | next/font/google: Source Serif 4 (headline only), Inter (everything else) | Calm, readable, tabular numerals |
| Database | Supabase (Postgres) | Hosted, service key for server writes |
| Language | Anthropic API (`@anthropic-ai/sdk`), Claude with tool use | Structured output, sponsor |
| Voice | ElevenLabs Agents with `@elevenlabs/react` | Client tools call our API, sponsor prize |
| Workflows | n8n Cloud with Twilio node | WhatsApp delivery, sponsor prize |
| Validation | zod | API bodies, Claude output |
| Tests | vitest | Calendar rules and detection only |
| Hosting | Vercel | HTTPS for microphone, instant deploys |

### 7.1 Setup commands (B runs at the start, everyone pulls)

```bash
npx create-next-app@latest headroom --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
cd headroom
npm install @supabase/supabase-js @anthropic-ai/sdk @elevenlabs/react recharts date-fns zod clsx lucide-react
npm install -D vitest
```

Then:
1. Create the GitHub repository `headroom`, push, add all team members.
2. Import into Vercel. Add the environment variables from section 9. Every push to `main` deploys.
3. Supabase: new project, run `supabase/schema.sql` (section 10).
4. Twilio: enable the WhatsApp sandbox; from the demo phone send the join message to the sandbox number; copy the from number.
5. n8n Cloud: build the `plan-created` workflow (section 17) and paste its webhook URL into Vercel.
6. ElevenLabs (stretch, C): create the agent "Headroom coach" (section 16).

Working rule: everyone works on `main` in separate folders, pulls often, commits small.

---

## 8. Repository structure

```
headroom/
  README.md
  .env.example
  supabase/schema.sql
  src/
    app/
      layout.tsx                      fonts, tokens, footer line
      page.tsx                        redirect to /app
      app/
        layout.tsx                    phone frame on desktop, full width on mobile; bottom tabs Home / Plan / Ask / Settings
        page.tsx                      Home: headroom, chart, scrubber, weekly strip, warning card
        why/page.tsx                  Why panel and "How we worked this out"
        plan/page.tsx                 Ranked actions with what-if toggles, Set this up
        done/page.tsx                 Confirmation and activity rail
        ask/page.tsx                  Chat coach (and mic button in stretch)
        settings/page.tsx             Language, text size, what we use, talk to a person
      behind/page.tsx                 Projector page and demo controls
      api/
        health/route.ts
        forecast/route.ts             GET ?persona=aisha
        whatif/route.ts               POST Scenario
        explain/route.ts              POST { warningId, language }
        coach/route.ts                POST { messages, language }
        plan/route.ts                 POST { actionIds }
        activity/route.ts             GET list; POST from n8n with x-callback-secret
        voice/token/route.ts          GET signed url (stretch)
        demo/reset/route.ts
        demo/reminder-now/route.ts
        demo/n8n/route.ts             POST { enabled }
    lib/
      forecast/
        types.ts                      all shared types (section 12)
        seed/aisha.ts                 persona constants from section 4
        seed/generate.ts              deterministic generator (section 11)
        calendar/bankHolidays.ts      England and Wales list 2025 to 2027
        calendar/dates.ts             previousWorkingDay, nthWeekday, addMonthsClamped
        rules/universalCredit.ts      assessment periods, payday counting, award
        rules/energyCap.ts            cap change dates and assumed change
        rules/councilTax.ts           10-instalment schedule, April rise
        rules/aprilRises.ts           telecoms fixed rises
        rules/annual.ts               repeat last year's one-offs
        recurring.ts                  detect recurring series from history
        project.ts                    90-day projection with band
        detect.ts                     shortfalls, causes, confidence
        actions/catalogue.ts          action definitions and effects
        actions/rank.ts               deterministic ranking
        scenario.ts                   apply Scenario to the schedule
        facts.ts                      build Facts for Claude
        index.ts                      runForecast(personaId, today, scenario)
      coach/
        client.ts                     Anthropic client and model name
        explain.ts                    structured explanation + number check
        chat.ts                       tool definitions and loop
        prompts.ts                    system prompts (section 15)
        numberCheck.ts
      actions/run.ts                  acceptPlan, recordActivity, sendPlanMessage
      store.ts                        Supabase or in-memory store
      n8n.ts                          webhook calls with fallback
      twilio.ts                       direct WhatsApp send (fallback)
      i18n.ts                         UI dictionary for en, ur, pl (stretch)
    components/
      Chart90.tsx, Scrubber.tsx, DayCard.tsx, WeekStrip.tsx, WarningCard.tsx,
      ActionCard.tsx, HeadroomFigure.tsx, ActivityRail.tsx, HowWeWorkedItOut.tsx,
      CoachChat.tsx, VoiceButton.tsx (stretch), PhoneFrame.tsx, BottomTabs.tsx
  tests/
    universalCredit.test.ts, dates.test.ts, recurring.test.ts, numberCheck.test.ts
```

## 9. Environment variables

`.env.example` (copy to `.env.local`; add the same to Vercel):

```
NEXT_PUBLIC_APP_URL=https://headroom.vercel.app
DEMO_TODAY=2026-11-07              # the engine's "today"; never use the real clock in the demo
STORE_MODE=supabase                # supabase | memory
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
CLAUDE_MODEL=                      # newest Sonnet-class model id on the day
ELEVENLABS_API_KEY=                # stretch
ELEVENLABS_AGENT_ID=               # stretch
N8N_PLAN_CREATED_URL=
N8N_REMINDER_URL=                  # stretch
N8N_HANDOFF_URL=                   # stretch
N8N_SHARED_SECRET=                 # we send it to n8n as header x-headroom-secret
CALLBACK_SECRET=                   # n8n sends it back as header x-callback-secret
TWILIO_ACCOUNT_SID=                # fallback path only
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
DEMO_WHATSAPP_TO=whatsapp:+447XXXXXXXXX
DEMO_SMS_TO=+447XXXXXXXXX          # optional SMS fallback
```

Only `NEXT_PUBLIC_*` variables reach the browser. Never put the Anthropic, Supabase service or Twilio keys in client code.

---

## 10. Data model

`supabase/schema.sql`:

```sql
create table profiles (
  id text primary key,                       -- 'aisha'
  display_name text not null,
  language text not null default 'en',       -- en | ur | pl
  text_size text not null default 'normal',  -- normal | large
  whatsapp_to text,
  created_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references profiles(id),
  action_ids text[] not null,
  lowest_before numeric not null,
  lowest_after numeric not null,
  lowest_date date not null,
  created_at timestamptz not null default now()
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references profiles(id),
  kind text not null,      -- plan_created | message_sent | reminder_sent | handoff_sent | reset | error
  title text not null,     -- shown in the rail, e.g. "Plan sent by WhatsApp"
  detail text,
  source text not null,    -- app | n8n | fallback
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table plans enable row level security;
alter table activity enable row level security;
-- no policies: only the service key (server) reads and writes

insert into profiles (id, display_name) values ('aisha', 'Aisha');
```

`src/lib/store.ts` exposes one interface used everywhere; `STORE_MODE=memory` swaps in a Map-backed version with the same shape:

```ts
export interface Store {
  getProfile(id: string): Promise<Profile>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<Profile>;
  createPlan(p: Omit<Plan, "id" | "createdAt">): Promise<Plan>;
  listPlans(profileId: string): Promise<Plan[]>;
  addActivity(a: Omit<Activity, "id" | "createdAt">): Promise<Activity>;
  listActivity(profileId: string, limit?: number): Promise<Activity[]>;
  reset(profileId: string): Promise<void>;
}
```

Transactions are not stored in the database. They are generated deterministically at request time from the seed (fast: about 1,500 rows) and cached in module scope.

---

## 11. Seed generator (`src/lib/forecast/seed/`)

`aisha.ts` holds the constants from section 4 as one typed object. `generate.ts` turns them into `Transaction[]` from 1 November 2025 to `DEMO_TODAY − 1` using a seeded PRNG (mulberry32, seed `20261107`). The same rules the engine uses forward are applied backward, so past dips are consistent with future ones.

Generation rules, in order:
1. **Wages**: every Friday. Hours drawn from a triangular distribution 20 to 28, mode 24; net = `round(hours × 12.21 − tax − NI)` approximated as `hours × 11.62`; mileage £18 added on about one Friday in four. If Friday is a bank holiday, pay on the previous working day. Description `BRIGHTSIDE HOMECARE LTD`.
2. **Universal Credit**: for each assessment period (27th to 26th), sum the wage payments dated inside it, apply `award = max(0, 1342.95 − 0.55 × max(0, wages − 411))`, pay on the 2nd of the following month shifted to the previous working day. Description `DWP UC`. Use the 2025/26 rates for the whole history (simplification; label "illustrative").
3. **Child Benefit**: £104.20 every 4 weeks on Monday, anchored to 9 November 2026 (so past dates fall out of the 28-day cycle), shifted earlier for bank holidays. Description `HMRC CHILD BENEFIT`.
4. **Direct debits and standing orders**: fixed amounts on fixed days (section 4). A debit due on a weekend or bank holiday is taken on the next working day. Council tax only April to January. Energy was £98 until 15 January 2026, then £110. Mobile was £20.20 until April 2026, then £22. Klarna only on 28 November and 28 December 2026 in the history window (the plan continues it on 28 January).
5. **Weekly spending**: Aldi Saturday uniform £80 to £100; Tesco Express Tuesday and Thursday £8 to £14; Esso Friday £32 to £40; cash Friday £20; takeaway alternate Fridays £18; ParentPay £12 and Kids Club £24 on Mondays in term time (Manchester term dates approximated: half terms 20 to 24 October 2025 and 2026, 16 to 20 February 2026, 25 to 29 May 2026; Christmas break 21 December to 1 January; Easter 3 to 17 April 2026; summer 24 July to 1 September 2026). Summer holiday club £60 a week for six weeks in place of ParentPay and Kids Club.
6. **Occasional**: three debits a month, £20 to £45, random merchants from a list (Boots, Primark, Smyths, school trip, party present, bus fares, Asda).
7. **Annual one-offs** (the `annual` rule learns these): Christmas spending spread 1 to 24 December 2025 totalling £380 (Smyths, Amazon, Aldi extra, Northern Rail £50); Zara's birthday 21 January 2026 £60; school uniform and shoes September 2026 £95; MOT and service 12 February 2026 £180.
8. **Overdraft interest**: ignore in the seed. (The forecast shows overdraft days; interest is not needed for the story.)

Tuning knobs in `aisha.ts`: `occasionalPerMonth` (default 3), `christmasExtra` (380), `aldiRange`, `tescoRange`. Adjust until the targets in section 4 ("The headline forecast") hold. Also check the history shows negative balances only in late January 2026 and late October 2026.

The generator also returns `openingBalance` so that the balance on `DEMO_TODAY` is about £270 (compute backwards: set the final balance and derive the opening one).

---

## 12. Shared types (`src/lib/forecast/types.ts`)

```ts
export type ISODate = string; // YYYY-MM-DD

export interface Transaction { date: ISODate; amount: number; description: string; category: Category; }
export type Category = "wage" | "benefit" | "rent" | "council_tax" | "energy" | "water" | "broadband" | "mobile" | "insurance" | "subscription" | "bnpl" | "groceries" | "fuel" | "school" | "cash" | "takeaway" | "occasional" | "christmas" | "birthday" | "car" | "other";

export interface Series {
  id: string; label: string; category: Category;
  cadence: "weekly" | "fortnightly" | "four_weekly" | "monthly" | "annual";
  anchor: ISODate; dayOfMonth?: number; weekday?: number;
  amountP50: number; amountP20: number; amountP80: number;
  direction: "in" | "out"; confidence: number; lastSeen: ISODate; count: number;
}

export interface CalendarEvent {
  date: ISODate; amount: number; label: string; seriesId?: string;
  ruleId?: RuleId; note?: string;         // e.g. "Paid early: 2 Jan is a Saturday"
}
export type RuleId = "uc_assessment_period" | "credit_before_weekend" | "debit_after_weekend" | "energy_cap_change" | "council_tax_schedule" | "april_telecom_rise" | "annual_repeat";

export interface DayPoint { date: ISODate; p20: number; p50: number; p80: number; events: CalendarEvent[]; status: Status; }
export type Status = "comfortable" | "tight" | "short";
export interface Week { startDate: ISODate; status: Status; lowP50: number; lowP20: number; headline: string; }

export interface Cause { id: string; label: string; amount: number; ruleId?: RuleId; detail: string; }
export interface Warning {
  id: string; startDate: ISODate; endDate: ISODate; lowestDate: ISODate;
  depthP50: number; depthP20: number; depthP80: number; causes: Cause[]; confidence: "high" | "medium" | "low";
}

export type ActionType = "claim" | "timing" | "save" | "help" | "understand";
export type Eligibility = "yes" | "likely" | "check";
export interface ActionCandidate {
  id: string; title: string; type: ActionType; summary: string;
  effectByCliff: number; effectMonthly: number; effortMinutes: number;
  eligibility: Eligibility; needs: string[]; steps: string[]; link?: string;
  defaultOn: boolean; date?: ISODate;
}

export interface Scenario {
  actionIds?: string[];
  income?: { hoursPerWeek?: number; weeklyNetDelta?: number; fromDate: ISODate };
  extraExpenses?: { date: ISODate; amount: number; label: string }[];
  removeSeriesIds?: string[];
  energyChangePct?: number;
}

export interface Forecast {
  personaId: string; today: ISODate; horizonDays: number; balanceToday: number;
  headroom: { lowest: number; lowestDate: ISODate; lowestP20: number; lowestP80: number; afterPlan?: number };
  days: DayPoint[]; weeks: Week[]; warnings: Warning[]; actions: ActionCandidate[];
  rulesFired: { ruleId: RuleId; date: ISODate; note: string }[];
  recurring: Series[];
  history: { months: { month: string; low: number; lowDate: ISODate; overdraftDays: number; fivePayday: boolean }[] };
  scenario?: Scenario;
}

export interface Facts {               // everything Claude is allowed to say a number about
  today: ISODate; balanceToday: number; horizonDays: number;
  warning?: Warning; headroom: Forecast["headroom"];
  keyEvents: CalendarEvent[];          // max 8, the ones that matter
  actions: ActionCandidate[];          // max 6
  pastEpisodes: string[];              // "October 2026: 7 days in overdraft, lowest −£96"
  allowedNumbers: string[];            // every £ figure and date rendered as text, for the checker
  language: "en" | "ur" | "pl";
}

export interface Explanation { headline: string; why: string[]; whatThisMeans: string; reassurance: string; nextStep: string; language: string; }
```

---

## 13. Forecast engine (`src/lib/forecast/`)

Entry point: `runForecast(personaId, today, scenario?) => Forecast`. Pure, synchronous, about 50 ms. Steps:

### 13.1 Calendar (`calendar/`)

- `bankHolidays.ts`: England and Wales. 2025: 1 Jan, 18 Apr, 21 Apr, 5 May, 26 May, 25 Aug, 25 Dec, 26 Dec. 2026: 1 Jan, 3 Apr, 6 Apr, 4 May, 25 May, 31 Aug, 25 Dec, 28 Dec. 2027: 1 Jan, 26 Mar, 29 Mar, 3 May, 31 May, 30 Aug, 27 Dec, 28 Dec.
- `isWorkingDay`, `previousWorkingDay`, `nextWorkingDay`.
- Shift rules: credits (wages, UC, Child Benefit) due on a non-working day move to the previous working day (`credit_before_weekend`); debits (direct debits, standing orders, Klarna) move to the next working day (`debit_after_weekend`). Each shift adds a `note` to the event ("Paid early: 2 Jan is a Saturday").

### 13.2 Recurring detection (`recurring.ts`)

1. Normalise description (upper case, strip digits and punctuation, first two words).
2. Group transactions by normalised description and direction.
3. For each group with 3 or more items: compute gaps between dates. Classify cadence: median gap 7 ± 1 weekly; 14 ± 2 fortnightly; 28 ± 2 four-weekly; 28 to 31 with the same day-of-month (± 3 days to allow weekend shifts) monthly. Otherwise, if one or two items in the same calendar month a year ago, mark as `annual` candidate.
4. Amounts: P20, P50, P80 from the group (use the last 6 months for weekly groups).
5. Confidence = fraction of expected occurrences that were observed in the last 6 months.
6. Output `Series[]`. Expected result for Aisha: wage, UC, Child Benefit, 9 monthly debits, Klarna (monthly, 2 seen), Aldi, Tesco, Esso, cash, takeaway (fortnightly), ParentPay, Kids Club, and annual candidates for Christmas, birthday, MOT, uniform.

### 13.3 Rules (`rules/`)

- `universalCredit.ts`: `assessmentPeriods(startDay=27, from, to)`, `countPaydaysInPeriod(wageEvents, period)`, `ucAward(wagesTotal)`, `ucPayDate(period, payDay=2)` with the credit shift. Fires `uc_assessment_period` with note "5 paydays between 27 Nov and 26 Dec, so about £154 less". For the forecast it uses projected wage events (including shifted ones). Rates and allowances come from `aisha.ts`, labelled `ratesYear: "2025/26 (illustrative)"`.
- `energyCap.ts`: cap change dates 1 Jan, 1 Apr, 1 Jul, 1 Oct. For the first energy debit on or after a change date, apply `energyChangePct` (default +4, the last published change) and fire `energy_cap_change` with note "Assumed +4%, the size of the last price cap change. Your supplier sets the exact amount."
- `councilTax.ts`: debits only April to January; the April debit rises by 5% (assumption, note it). Fires `council_tax_schedule` for 1 February ("No council tax in February or March") and 1 April.
- `aprilRises.ts`: broadband and mobile +£1.80 from the first debit in April. Fires `april_telecom_rise`. (Outside the 90-day window today; included for correctness and for the `/behind` rules list.)
- `annual.ts`: for each annual candidate, repeat last year's total on the same dates shifted by one year (Christmas 1 to 24 December, birthday 21 January). Fires `annual_repeat` with note "Last year you spent about £380 extra in December".

### 13.4 Projection (`project.ts`)

1. Build the schedule: for each `Series`, generate events across the horizon by cadence, apply calendar shifts, then apply the rules (UC amounts, energy change, council tax gaps, annual repeats). Apply the `Scenario` (section 13.6).
2. Run 200 bootstrap paths: for each event, sample the amount from the series' observed amounts (plus the hours variation for wages; UC recomputed per path from the sampled wages). Weekly spend samples carry a small drift so the band widens with time.
3. For each day take P20, P50, P80 of the cumulative balance across paths. `events` on a day are the P50 schedule events.
4. Status per day: `comfortable` if p20 ≥ 50; `tight` if p50 ≥ 0 and p20 < 50; `short` if p50 < 0. Weeks start Monday; the week status is the worst day status; `headline` is the main event of the week ("Universal Credit Wed 2 Dec", "Christmas spending", "Rent Tue 5 Jan").

### 13.5 Detection (`detect.ts`)

1. Find contiguous day runs with p50 < 0. The first run is the `Warning`. Depth = min p50; P20 and P80 at the same date.
2. Causes: recompute the P50 path with each rule or series switched to its "normal" value one at a time (UC at the four-payday amount; no annual repeats; no energy change; no Klarna; no birthday). The improvement in the lowest point is that cause's `amount`. Sort descending, keep those ≥ £20. This is simple, deterministic and fully explainable ("if your UC had been normal, the low point would be £154 higher").
3. Confidence: `high` if the warning holds at P80 too (p80 < 0 at the lowest date); `medium` if it holds at P50 only; `low` if the run is shorter than 3 days.
4. `history.months`: from the seeded transactions, monthly low, lowest date, overdraft days, and whether the UC paid in that month came from a five-payday period.

### 13.6 Scenario (`scenario.ts`)

Applied before projection:
- `actionIds`: apply each action's `effect` function from the catalogue (adds a credit, removes or reduces a series, moves a date).
- `income.hoursPerWeek`: replace wage sampling with `hours × 11.62` from `fromDate`; UC recomputes automatically through the rule.
- `extraExpenses`: add one-off debits.
- `removeSeriesIds`: drop a series (for "what if I cancel Disney+").
- `energyChangePct`: override the assumption.

---

## 14. Actions catalogue and ranking (`actions/`)

Each action has an `effect(schedule, persona) => schedule` and an `eligibility(persona)`. Pound effects are computed by the engine by re-running the projection with the action applied (`effectByCliff` = change in the lowest point before the warning's `endDate`; `effectMonthly` = change in the average monthly net after that date). Values below are what the engine should produce for Aisha; if it does not, fix the seed or the effect, not the copy.

| id | title | type | effect | eligibility | effort | steps / link |
|---|---|---|---|---|---|---|
| `set_aside_payday` | Put £150 aside on Fri 11 Dec | timing | Move £150 to a "January pot" on the payday with the highest P20 before the warning; it returns on the first short day. By cliff +£150. | yes | 1 min | One tap. "We'll remind you on the day. Your pot is still your money." |
| `broadband_social_tariff` | Switch to a broadband social tariff | claim | Virgin Media £32 → Essential Broadband about £15 from the next bill. By cliff about +£34 (two bills); monthly +£17. | yes (on UC) | 10 min | Call or chat with Virgin; say "social tariff"; no exit fee. Link: ofcom.org.uk social tariffs. |
| `free_school_meals` | Apply for free school meals | claim | Removes ParentPay £12 a week in term time. By cliff about +£48; monthly about +£50 in term time. | likely (all UC households in England from September 2026; verify) | 15 min | Apply through Manchester City Council. Link: gov.uk/apply-free-school-meals. |
| `council_tax_support` | Check Council Tax Support | claim | Manchester scheme; estimate £40 to £70 a month for a UC household in Band A. Shown as a range; effect uses the low end. By cliff about +£40; monthly +£40. | check | 20 min | Apply through the council; have UC statement ready. Link: manchester.gov.uk council tax support. Also mention the Inbest or Policy in Practice calculator for a full check. |
| `council_tax_12_months` | Spread council tax over 12 months | timing | Remaining balance (Dec, Jan) spread over Dec to Mar: January payment £110 → about £55. By cliff about +£55; monthly 0 over the year. | yes (statutory right to ask) | 10 min | Call or email the council. Note April restarts at the new rate. |
| `move_klarna` | Ask Klarna to move the 28 Jan payment | timing | Moves £27.33 to 5 Feb (after UC). By cliff +£27. | check | 5 min | In the Klarna app, "Extend due date" (fee may apply; say so). Only shown if the warning includes a Klarna cause. |
| `talk_to_someone` | Talk to someone who can help | help | None (always listed last). | yes | 5 min | Citizens Advice Manchester, StepChange, MoneyHelper. "Share my summary" sends the one-page summary (stretch). |

Never in the catalogue: any overdraft, loan, credit card, BNPL or salary-advance product. If the forecast is in deficit even after all `claim` and `timing` actions, `talk_to_someone` moves to the top with `summary: "Your costs are higher than your income most months. That is not something to fix alone. Free help works."`

**Ranking** (`rank.ts`), deterministic:

```
score = effectByCliff + 2 × effectMonthly − 0.5 × effortMinutes
eligibility tie-break: yes > likely > check
talk_to_someone always last unless the structural-deficit condition holds
defaultOn = the top three by score whose eligibility is yes or likely
```

`afterPlan` in `headroom` is computed with the `defaultOn` actions applied. The Plan screen's toggles call `POST /api/whatif` with the current `actionIds`; the chart and the headroom figure update from the response (debounce 150 ms).

## 15. Claude: explanation and coach (`src/lib/coach/`)

### 15.1 Client

`client.ts`: `new Anthropic({ apiKey })`, `model = process.env.CLAUDE_MODEL`, `max_tokens` 600 for explanations, 800 for chat. Temperature 0.3. Timeout 12 s; on timeout or error, fall back to the template explanation in 15.5 so the demo never shows a spinner forever.

### 15.2 Explanation (`explain.ts`)

Input: `Facts` (section 12) built by `facts.ts` from the `Forecast`. Output: `Explanation`, validated with zod. Use a single tool `write_explanation` with the `Explanation` JSON schema and `tool_choice: { type: "tool", name: "write_explanation" }` so the output is always structured.

System prompt (`prompts.ts`, `EXPLAIN_SYSTEM`):

```
You write short, calm explanations of a person's money forecast for Headroom, a tool inside a UK bank app.
Rules:
- Write for a reading age of 9 to 11. Short sentences. Everyday words. No jargon: say "money coming in", not "income"; say "Universal Credit", not "UC"; never say "deficit", "liquidity", "cash flow", "taper".
- Use ONLY the numbers and dates in the facts you are given. Never calculate, round differently, or add a number that is not there. If you need a number that is missing, leave it out.
- Money as pounds with no pence, e.g. "about £154". Dates as "Thu 31 Dec".
- Name the causes in the order given. The biggest cause first.
- Never blame the person. Never mention overdraft fees as a threat. Never suggest borrowing, an overdraft, a loan, a credit card or buy-now-pay-later.
- This is guidance, not financial advice. Do not tell the person what they must do; say what they can do.
- If the facts say the person is short in most months even after all the options, say clearly that free help exists and name it (Citizens Advice, StepChange, MoneyHelper).
- Write in the language given in facts.language (en = English, ur = Urdu, pl = Polish). Keep money and dates in the same format.
Fields:
- headline: at most 20 words, states what will happen and when.
- why: 2 to 4 bullets, one cause each, each with its pound amount from the facts.
- whatThisMeans: 1 or 2 sentences on what the person would notice.
- reassurance: 1 sentence that is true and calm, e.g. that this is predictable and there are options.
- nextStep: 1 sentence pointing to the best option by name.
```

User message: `JSON.stringify(facts)` preceded by "Here are the facts. Write the explanation."

### 15.3 Chat coach (`chat.ts`)

Tool-use loop (Messages API, max 4 tool rounds). Tools:

| name | input | returns |
|---|---|---|
| `get_forecast` | `{}` | `Facts` for the current forecast |
| `simulate_scenario` | `Scenario` | `Facts` for the forecast with the scenario applied, plus `delta` (change in lowest point) |
| `list_actions` | `{}` | the ranked `ActionCandidate[]` |
| `accept_actions` | `{ actionIds: string[] }` | result of `acceptPlan` (section 17) |
| `request_human_help` | `{ reason: string }` | triggers the handoff activity; returns the contact list |

System prompt (`COACH_SYSTEM`): the same rules as 15.2, plus:

```
You are the Headroom coach. You answer questions about the person's next 90 days.
- Always call get_forecast or simulate_scenario before you state any number. Say only numbers returned by tools.
- When the person describes a change ("my hours drop to 16 a week in January", "car repair £300 in December", "cancel Disney+"), turn it into a Scenario and call simulate_scenario. Dates: if they say a month, use the 1st of that month.
- Keep replies under 80 words unless they ask for detail. One suggestion per reply, by its action title.
- If they ask you to set something up, call accept_actions and confirm what was sent.
- If they sound distressed, mention money for food or heating, or debt collectors, stop forecasting and call request_human_help, then give the contacts gently.
- You do not give regulated financial advice: no products, no investments, no borrowing.
```

The chat route keeps the message history in the request body (stateless server). Suggested chips on the Ask screen: "What if my hours drop to 16 a week in January?", "What happens if I cancel Disney+?", "Can I afford £120 for a school trip in January?", "Why is my Universal Credit lower in January?".

### 15.4 Number check (`numberCheck.ts`)

After every Claude response (explanation fields and chat text):
1. Extract all `£\d[\d,]*` tokens and all date-like tokens (`\b\d{1,2} (Jan|Feb|...)\b`, `\b(Mon|Tue|...) \d{1,2} (Jan|...)\b`).
2. Compare against `facts.allowedNumbers` (built by `facts.ts`: every pound figure and date in the facts rendered in the same formats, with a ±£1 tolerance for rounding).
3. If any token is not allowed: for explanations, retry once with the message "Your text used a number that is not in the facts: X. Rewrite using only the numbers given."; if it fails again, use the template (15.5). For chat, replace the reply with "I can only quote the numbers in your forecast. Here is what it shows:" followed by the template summary.
4. Log every rejection to `activity` as `kind: "error"`, `source: "app"` so `/behind` can show "numbers checked: 14, rejected: 0" (judges like this).

### 15.5 Template fallback

If Claude is unavailable, render from the facts:

- headline: `"You may be short by about £{depth} from {startDate} to {endDate}."`
- why: one line per cause: `"{label}: about £{amount}."`
- whatThisMeans: `"Your balance is likely to go below zero for {days} days unless something changes."`
- reassurance: `"This is predictable and there are {n} things you can do."`
- nextStep: `"The biggest help is: {topAction.title}."`

---

## 16. Voice coach (stretch, ElevenLabs Agents)

1. Create an agent "Headroom coach" in the ElevenLabs dashboard. Voice: a calm British voice. First message: "Hi, I'm your Headroom coach. Ask me anything about your next few months." System prompt: the `COACH_SYSTEM` text from 15.3 adapted: "Say numbers in words a person would say aloud: 'about one hundred and fifty pounds'. Keep answers to two sentences unless asked for more."
2. Client tools in the agent config (names and parameters must match exactly): `get_forecast()`, `simulate_scenario(scenario_json: string)`, `list_actions()`, `accept_actions(action_ids: string)`. Mark them as waiting for a response.
3. In `VoiceButton.tsx` use `useConversation` from `@elevenlabs/react` with `clientTools` that call our API routes (`/api/forecast`, `/api/whatif`, `/api/plan`) and return the `Facts` as a JSON string. Start the session with a signed URL from `GET /api/voice/token` (server-side call to the ElevenLabs API with `ELEVENLABS_AGENT_ID`).
4. Microphone permission: Vercel HTTPS is required. Show a text transcript under the button so the room can follow. If the agent fails to connect within 5 s, show "Voice is unavailable, type instead" and open the chat.
5. Demo line: "What if my hours drop to sixteen a week in January?"

---

## 17. n8n, WhatsApp and the fallback

### 17.1 Twilio WhatsApp sandbox (D, at 13:00 and again at 17:30)

1. Twilio Console → Messaging → Try it out → Send a WhatsApp message. Note the sandbox number and the join code.
2. From the demo phone, send `join <code>` to the sandbox number on WhatsApp. The session lasts 24 hours; re-send before judging.
3. Sandbox messages are free-form inside the session, so no template approval is needed.
4. If WhatsApp fails on the day, flip to SMS: same Twilio node, `from` your Twilio number, `to` `DEMO_SMS_TO`.

### 17.2 Workflow `plan-created` (MVP)

Trigger: Webhook (POST). Steps:
1. **Webhook** `/webhook/headroom-plan`. Check header `x-headroom-secret` equals the shared secret (IF node; respond 401 otherwise).
2. **Set** fields: `to`, `message` (built by our server; n8n does not compose copy).
3. **Twilio** node: send WhatsApp `from` the sandbox number `to` the customer.
4. **HTTP Request** to `{APP_URL}/api/activity` with header `x-callback-secret` and body `{ profileId, kind: "message_sent", title: "Plan sent by WhatsApp", detail: "<first 60 chars>", source: "n8n" }`.
5. **Respond to Webhook** `{ ok: true }`.

Payload our server sends:

```json
{
  "profileId": "aisha",
  "to": "whatsapp:+447XXXXXXXXX",
  "message": "Headroom: your plan.\n1. Put £150 aside on Fri 11 Dec (we'll remind you).\n2. Switch to a broadband social tariff: about £17 a month.\n3. Apply for free school meals: about £12 a week.\nWith these, your lowest point goes from about −£140 to about +£70.\nReply HELP to talk to a person.",
  "reminders": [{ "date": "2026-12-11", "text": "Payday. Move £150 to your January pot today." }]
}
```

### 17.3 Workflow `payday-reminder` (stretch)

Trigger: Schedule (Fridays 09:00) and a second Webhook trigger `/webhook/headroom-reminder-now` for the demo button. Steps: HTTP GET `{APP_URL}/api/forecast?persona=aisha` → Code node picks today's events and the week status → Twilio WhatsApp → callback `kind: "reminder_sent"`. Message shape: "Fri 13 Nov. Wage due today. This week looks Comfortable. Lowest point ahead: about −£140 on Mon 1 Feb. Your plan is on track."

### 17.4 Workflow `handoff` (stretch)

Webhook → Gmail or SMTP node sends the one-page summary to a demo adviser inbox → callback `kind: "handoff_sent"`.

### 17.5 Fallback (`src/lib/n8n.ts`, `src/lib/twilio.ts`)

`sendPlanMessage()` posts to `N8N_PLAN_CREATED_URL` with a 5 s timeout. If the URL is unset, the demo toggle is off, or the call fails, it sends the same message with the Twilio REST API directly (`twilio.ts`, plain `fetch` with basic auth to `https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json`) and records activity with `source: "fallback"`. The customer UI never shows which path ran; `/behind` does.

---

## 18. API routes (`src/app/api/`)

All responses JSON. Errors `{ error: string }` with 4xx/5xx. Bodies validated with zod.

| Route | Method | Body / query | Returns | Notes |
|---|---|---|---|---|
| `/api/health` | GET | | `{ ok, store, n8n, claude, today }` | `/behind` polls it |
| `/api/forecast` | GET | `?persona=aisha&lang=en` | `Forecast` + `explanation` | explanation cached per (persona, lang, warning id) |
| `/api/whatif` | POST | `Scenario` | `Forecast` (no explanation) | used by toggles and chat tool |
| `/api/explain` | POST | `{ persona, lang }` | `Explanation` | re-run on language change |
| `/api/coach` | POST | `{ persona, lang, messages: {role, content}[] }` | `{ reply, toolCalls: string[], facts? }` | runs the tool loop |
| `/api/plan` | POST | `{ persona, actionIds }` | `{ plan, activity, lowestAfter }` | calls `acceptPlan` |
| `/api/activity` | GET | `?persona=aisha` | `Activity[]` (latest 20) | rail polls every 3 s |
| `/api/activity` | POST | `Activity` fields | `{ ok }` | requires `x-callback-secret` |
| `/api/voice/token` | GET | | `{ signedUrl }` | stretch |
| `/api/demo/reset` | POST | | `{ ok }` | clears plans and activity |
| `/api/demo/reminder-now` | POST | | `{ ok }` | calls `N8N_REMINDER_URL` or fallback |
| `/api/demo/n8n` | POST | `{ enabled: boolean }` | `{ enabled }` | in-memory flag |

`acceptPlan(persona, actionIds)` in `src/lib/actions/run.ts`: run the forecast with and without the actions → `createPlan` → `addActivity(plan_created)` → `sendPlanMessage` → return. The WhatsApp message text is built in `buildPlanMessage(forecast, actions)` with the engine's numbers only.

---

## 19. Design system (customer app)

Light, calm, high contrast. Do not use the dark palette from `ui-plan.md`; do reuse its component discipline, 44 px targets, visible focus rings, motion easing `cubic-bezier(0.22, 1, 0.36, 1)` and `prefers-reduced-motion` handling.

Tokens (Tailwind `theme.extend`):

| Token | Value | Use |
|---|---|---|
| `canvas` | `#FBF8F3` | page background |
| `card` | `#FFFFFF` | cards |
| `ink` | `#1B1F1D` | text |
| `muted` | `#5B625E` | secondary text (contrast 7:1 on canvas) |
| `line` | `#E6E1D8` | borders |
| `accent` | `#0F6E5C` | buttons, links, scrubber handle |
| `accentSoft` | `#DCEFE9` | selected chips |
| `comfortable` | `#2E7D4F` | status |
| `tight` | `#9A6700` | status |
| `short` | `#B3261E` | status |
| `band` | `rgba(15,110,92,0.14)` | chart range fill |
| `zero` | `#8A8F8C` dashed | zero line |

Type: Source Serif 4 for the headroom figure and screen titles (28 to 34 px); Inter for everything else, body 17 px minimum, `font-variant-numeric: tabular-nums` on all money. Large text setting scales the root to 112.5%.

Status is never colour alone: each status has an icon (lucide `Sun`, `CloudSun`, `CloudRain`) and a word (Comfortable, Tight, Short).

Money format: `formatMoney(n)` → "£154", "−£140" (true minus sign U+2212), "about £154" when the band is wider than £40. Dates: `formatDay(d)` → "Thu 31 Dec".

Phone frame: on screens wider than 480 px, render `/app` inside a 390 × 844 frame with a 28 px radius on the canvas; on phones, full screen. Bottom tabs: Home, Plan, Ask, Settings.

Motion: chart line and band animate once on load (600 ms); scrubber updates are immediate (no animation); toggles animate the line change in 300 ms. Everything off under reduced motion.

---

## 20. Screens

### `/app` Home: "Your next 90 days"
- Top: "Hi Aisha" small; headroom figure in serif: "Lowest point: about −£140" with "Mon 1 Feb" under it; a status chip for today ("Comfortable today: £270").
- `Chart90`: Recharts `ComposedChart`, `Area` for the P20 to P80 band, `Line` for P50, `ReferenceLine y=0`, `ReferenceLine x=scrubberDate`. X axis ticks: today, 1 Dec, 1 Jan, 1 Feb. Dots on event days with an amount ≥ £100.
- `Scrubber`: `<input type="range" min=0 max=90>` styled with a 44 px thumb; keyboard works by default; `aria-valuetext` is the day card headline. Dragging updates `DayCard` below: date, events with amounts and notes, projected balance with band, status sentence.
- `WeekStrip`: 13 cards, horizontally scrollable, each with icon + word + the week headline. Tapping a card moves the scrubber to that week's lowest day.
- `WarningCard` (one only): "You're likely to be short from Mon 25 Jan to Mon 1 Feb, by about £140." + "Why" button → `/app/why`, "See what you can do" button → `/app/plan`.
- Footer line (every screen): "Figures are estimates from your transactions and public rules. Words are written with AI. Illustrative 2025/26 benefit rates."

### `/app/why`
- `Explanation` fields rendered as headline, bullets, two paragraphs, a "Best next step" chip.
- `HowWeWorkedItOut`: accordion listing each `Cause` with its `ruleId` in words ("Universal Credit rule: 5 paydays in the period 27 Nov to 26 Dec") and the underlying transactions count ("based on 52 wages and 12 Universal Credit payments").
- Stretch: "This happened before" row from `history.months`.

### `/app/plan`
- Subtitle: "Lowest point: −£140 → +£70 with the ticked options" (live).
- `ActionCard` list in rank order: title, pound chip ("+£150 by Feb", "+£17 a month"), effort ("1 min", "10 min"), eligibility label ("You qualify", "Likely", "Worth checking"), expandable steps and link, toggle switch.
- Sticky "Set this up" button → `POST /api/plan` → `/app/done`.
- `talk_to_someone` renders as a quiet card with three contacts, always visible at the bottom.

### `/app/done`
- "Done. Your plan is set." List of what was scheduled and sent. `ActivityRail` (polls `/api/activity`): "Plan saved 14:32", "Plan sent by WhatsApp 14:32". Buttons: "Back to forecast", "Ask a question".

### `/app/ask`
- `CoachChat`: message list, suggestion chips, input, send. Each reply shows a small "checked against your forecast" tick when the number check passed. Stretch: `VoiceButton` with transcript.

### `/app/settings`
- Language (English, Urdu, Polish), text size (Normal, Large), "What Headroom uses" (your transactions from the last 12 months; public rules: Universal Credit, bank holidays, energy price cap dates, council tax; nothing is shared without you asking), "Talk to a person" (contacts), "Delete my forecast".

### `/behind` (projector)
Two columns. Left: "What the engine found" (recurring series table with cadence, amount, confidence), "Rules that fired" (list with dates and notes), "Last 12 months" (bar chart of monthly lows with five-payday months marked and overdraft days). Right: `ActivityRail` large, health badges (store, n8n, Claude, numbers checked/rejected), demo controls (Reset, Send Friday reminder now, n8n on/off, persona switch disabled unless stretch). Dark background is fine here (reuse `ui-plan.md` palette).

## 21. Copy deck and tone

Tone: a calm friend who is good with money. Short. Specific. Never "you should". Never "unfortunately". Never exclamation marks.

| Place | Copy |
|---|---|
| Home title | Your next 90 days |
| Headroom label | Lowest point |
| Today chip | Comfortable today: £270 |
| Status words | Comfortable · Tight · Short |
| Status sentences | "You have room this week." · "Money is tight this week. Nothing is due that you cannot cover." · "You are likely to go below zero this week." |
| Warning card | You're likely to be short from Mon 25 Jan to Mon 1 Feb, by about £140. |
| Warning buttons | Why · See what you can do |
| Day card, event note | Paid early: 2 Jan is a Saturday. |
| Why title | Why this is happening |
| How we worked it out | How we worked this out |
| Plan title | What you can do |
| Plan subtitle | Lowest point: −£140 → +£70 with the ticked options |
| Eligibility labels | You qualify · Likely · Worth checking |
| Effort | 1 min · 10 min · 20 min |
| Set up button | Set this up |
| Done title | Done. Your plan is set. |
| Ask placeholder | Ask about your next few months |
| Ask chips | What if my hours drop to 16 a week in January? · What happens if I cancel Disney+? · Can I afford £120 for a school trip in January? · Why is my Universal Credit lower in January? |
| Help card | Talking to someone is free and it works. Citizens Advice Manchester 0808 278 7800 · StepChange 0800 138 1111 · MoneyHelper 0800 138 7777 (check numbers on the day) |
| Transparency footer | Figures are estimates from your transactions and public rules. Words are written with AI. Illustrative 2025/26 benefit rates. |
| Empty / error | We couldn't load your forecast. Try again in a moment. |
| Reset (behind) | Reset demo |

WhatsApp plan message and reminder text: section 17.2 and 17.3. Keep under 320 characters each so SMS fallback is two segments at most.

---

## 22. Ethics, safety and transparency

- **Guidance, not advice.** Budgeting, timing and entitlement guidance sits outside regulated financial advice. The FCA targeted support regime (live April 2026) covers pensions and investments; Headroom offers no products. Say this if asked.
- **Never recommend credit.** No overdraft, loan, card, BNPL or salary advance is ever suggested, including by the coach (enforced by prompt and by a word filter on replies: "overdraft", "loan", "borrow", "credit card", "advance" trigger a rewrite).
- **Structural deficit handoff.** If the forecast is negative in most months after all claim and timing actions, the top action becomes talking to a free adviser, with a shareable summary. Headroom does not pretend timing fixes a budget that does not add up.
- **Deterministic numbers, explainable rules.** Every figure traces to transactions and named rules ("How we worked this out"). The language model is confined to words, checked against a whitelist of numbers, and logged.
- **Uncertainty shown honestly.** Bands, "about", and confidence labels. No false precision.
- **Vulnerability.** Reading age 9 to 11, large text, voice, language switch, WhatsApp and SMS for people without data or a smartphone, no shaming language, distress triggers a human route.
- **Data.** Only the person's own transactions and public rules. No third-party data brokers, no credit bureau pull, nothing shared without an explicit tap. Synthetic data in the demo. Delete option in settings.
- **Fairness.** The same rules apply to everyone; no model scores people. Entitlement prompts work against the £24.1bn unclaimed and the poverty premium rather than selling anything.
- **Not a substitute.** Headroom complements Citizens Advice, StepChange and MoneyHelper and links to them.

---

## 23. Testing and the MVP checklist

Unit tests (vitest, B writes while building):
- `dates.test.ts`: `previousWorkingDay("2027-01-02") === "2026-12-31"`; `nextWorkingDay("2026-12-05") === "2026-12-07"`; Good Friday 2026 is not a working day.
- `universalCredit.test.ts`: period 27 Nov to 26 Dec 2026 contains 5 paydays (with the 25 Dec wage on 24 Dec); award(1120) ≈ 953; award(1400) ≈ 799; pay date for that period is 2026-12-31; period 27 Dec to 26 Jan has 4 paydays.
- `recurring.test.ts`: the seed produces a weekly wage series, a monthly UC series on day 2, and a four-weekly Child Benefit series.
- `numberCheck.test.ts`: rejects "£999" when not in facts; accepts "about £154" when 154 is; accepts "Thu 31 Dec".

MVP checklist (run at 15:30; freeze at 15:45):
1. `GET /api/forecast?persona=aisha` returns in < 1 s with a warning whose `lowestDate` is between 2027-01-25 and 2027-02-01 and `depthP50` between −100 and −180.
2. Home renders chart, band, scrubber, 13 week cards, one warning card on a phone and in the desktop frame.
3. Scrubber keyboard and touch both move the day card; the day card for 31 Dec shows the early-payment note.
4. Why screen shows a Claude explanation with no rejected numbers; template fallback renders if the key is removed.
5. Plan screen: toggling the top three actions changes the lowest point to a positive figure; the chart updates.
6. Set this up → activity rail shows "Plan saved" and "Plan sent by WhatsApp"; the WhatsApp message arrives on the demo phone.
7. n8n off toggle → the same flow completes through the fallback.
8. Ask: "What if my hours drop to 16 a week in January?" returns a reply with the new lowest point and one suggestion.
9. `/behind` shows recurring series, rules fired, 12-month history with four marked months, live activity.
10. Reset works. Footer line present on every screen. Lighthouse accessibility on Home ≥ 90.

Record the backup video right after this passes.

---

## 24. Team and timeline

Roles:
- **A, front end**: `/app` screens, `Chart90`, `Scrubber`, `WeekStrip`, `WarningCard`, `ActionCard`, design tokens, phone frame, accessibility.
- **B, engine and API**: setup commands, seed, calendar, rules, recurring, projection, detection, actions, scenario, API routes, store, tests.
- **C, AI and voice**: `facts.ts`, explain, number check, template fallback, coach tool loop, `/api/coach`, Ask screen logic with A; ElevenLabs in stretch.
- **D, integrations and story**: Supabase project and schema, Twilio sandbox, n8n workflows, fallback send, `/behind`, Devpost text, pitch deck (4 slides), backup video, NatWest workshop attendance.

| Time | A | B | C | D |
|---|---|---|---|---|
| 12:00 | Read plan sections 1 to 5 together (15 min). Agree names. | Run setup commands, push, Vercel. | Read sections 12, 15. | Twilio sandbox join, Supabase project, n8n account. |
| 12:30 | Tokens, layout, phone frame, bottom tabs, Home skeleton with mock `Forecast` (B shares `types.ts` first). | `types.ts`, calendar, seed generator, print 12-month balance to check dips. | `facts.ts` against the mock, `numberCheck.ts` + tests, prompts. | Schema SQL, `store.ts` both modes, `/api/activity`, `/api/health`. |
| 13:15 | `Chart90` + `Scrubber` + `DayCard`. | Recurring, UC rule, energy and council tax rules. | `explain.ts` with tool-forced JSON, template fallback, `/api/explain`. | n8n `plan-created` workflow end to end with a curl. |
| 14:00 | `WeekStrip`, `WarningCard`, Why screen. | Projection with band, detection with causes, `/api/forecast`. **Tune seed to targets.** | Coach tool loop against `/api/whatif`, `/api/coach`. | NatWest workshop 14:00 to 14:45 (one person; questions in section 27). |
| 14:30 | **Integration 1**: Home runs on real `/api/forecast`. | Actions catalogue, ranking, scenario, `/api/whatif`. | Ask screen wiring with A. | `/behind` skeleton, activity rail, demo controls. |
| 15:00 | Plan screen with live toggles, Done screen, footer. | `/api/plan`, `acceptPlan`, `buildPlanMessage`, fallback send with D. | Number-check logging to activity; chips. | Fallback path test (n8n off), reset, reminder-now. |
| 15:30 | **Integration 2 + MVP checklist (section 23).** Fix only blockers. | | | |
| 15:45 | **MVP freeze.** D records the backup video on the phone + `/behind`. | | | |
| 15:50 | Polish, motion, large text. | History months to `/behind`, past-episode line. | ElevenLabs agent + `VoiceButton` (stretch 1). | Devpost draft, slides, `payday-reminder` workflow. |
| 16:30 | Language switch (stretch 2) with C. | Bug fixes from rehearsal. | Language in prompts. | Rehearsal 1 with the script (section 25). |
| 16:45 | **Stretch freeze.** Everything after this is copy, slides and rehearsal. | | | |
| 17:00 | Rehearsal 2, timed. Fix wording only. | | | |
| 17:15 | Devpost submitted as draft with video link. | | | |
| 17:30 | Re-send the WhatsApp join message. Charge phones. Hotspot test. | | | |
| 17:50 | Final Devpost submit. | | | |
| 18:00 | Deadline. | | | |

Rules: commit every 20 minutes; if a stretch item is not working by 16:45, remove it from the demo rather than show it broken; the person presenting (A or D) does not code after 17:00.

---

## 25. Pitch and the two-minute demo script

Slides (4): the problem in three numbers · what Headroom does (one screenshot) · how it works and why it is responsible (engine vs words) · what NatWest could do with it next.

Script (speaker in bold, actions in brackets):

**Open (20 s).** "Thirteen million adults in the UK have low financial resilience, four million spend more than they earn before anything goes wrong, and £24 billion of help they are entitled to goes unclaimed every year. Bank apps tell all of them what they spent last month. Nothing tells them what is coming. Most of what is coming is in the calendar."

**Aisha (20 s).** "Aisha is a care worker in Levenshulme, paid weekly, on Universal Credit with a six-year-old. This is her Headroom." [Phone on screen: Home.] "It takes her own transactions plus public rules: Universal Credit, bank holidays, the energy cap, council tax. It builds her next 90 days with an honest range."

**Time travel (30 s).** [Drag to 31 Dec.] "Because 2 January is a Saturday and 1 January a bank holiday, her Universal Credit lands on 31 December, and it is £154 lower, because five Fridays fall in her assessment period. Gov.uk documents this. It hits every weekly-paid claimant four times a year and no app warns them." [Drag to 28 Jan.] "So late January: about minus £140. The same thing happened to her last January and in October; both times she ended up in her overdraft."

**Plan (30 s).** [Tap Why, then Plan.] "Every number is deterministic and traceable: here is how we worked it out. The AI writes the words and is checked against the numbers; it never invents a figure." [Toggle three actions.] "Put £150 aside on her best payday, switch to a broadband social tariff she already qualifies for, apply for free school meals. Lowest point goes from minus £140 to plus £70, and she gains £65 a month after that." [Tap Set this up; WhatsApp buzzes.] "It arrives on WhatsApp, because many of the people who need this most are not in the app."

**Coach (15 s).** [Ask: "What if my hours drop to 16 a week in January?"] "The coach re-runs the forecast as a tool, and when a change is structural rather than timing, it points to free human help instead of pretending."

**Close (5 s).** "Headroom: your money, 90 days ahead, in plain English, with a plan. NatWest already has the data and the Inbest partnership; this is the missing layer."

Backup: if the live WhatsApp fails, show the activity rail entry and the backup video clip.

---

## 26. Devpost write-up

**Tagline:** See your money 90 days ahead, understand why, and fix it before it happens.

**Inspiration.** 13.1 million UK adults have low financial resilience and 4 million are in a negative budget, yet bank apps only look backward. Reading gov.uk, we found that a weekly-paid Universal Credit claimant loses about £150 four times a year because five paydays fall in one assessment period, and nobody warns them. Then we found £24.1 billion of unclaimed support and a £380-a-year poverty premium. The shocks are predictable; the help exists; the two are never connected.

**What it does.** Headroom projects a person's balance day by day for 90 days from their own transactions plus UK calendar rules (Universal Credit assessment periods and taper, bank-holiday payment shifts, energy price cap dates, council tax schedule, annual repeats). A time-travel scrubber and weather-style weekly cards make it readable in seconds. The first shortfall is explained in plain English with "How we worked this out". A ranked plan combines entitlements (social tariffs, Council Tax Support, free school meals), timing moves (set aside on the best payday, 12 council tax instalments) and free human help. "Set this up" sends the plan and payday reminders by WhatsApp through n8n and Twilio. A coach (Claude, and ElevenLabs voice) answers "what if" questions by re-running the forecast as a tool.

**How we built it.** Next.js and TypeScript on Vercel; a pure deterministic forecast engine (recurring detection, rule modules, 200-path bootstrap for a P20 to P80 band, cause attribution by rule ablation); Supabase for plans and activity; Anthropic Claude with forced tool output for explanations and a tool-use loop for the coach, with a number whitelist check on every reply; ElevenLabs Agents with client tools; n8n workflows with Twilio WhatsApp and callbacks.

**Challenges.** Getting UK calendar rules right (credits move earlier, debits move later; Good Friday moves a wage into the previous assessment period); making a language model useful without letting it near arithmetic; designing for a reading age of 9 to 11.

**Accomplishments.** A forecast that reproduces a real, documented benefits quirk; an explanation pipeline where every number is traceable; a plan that lifts the persona from −£140 to +£70 using only things she is entitled to.

**What we learned.** Most financial stress for low-income households is calendar, not character. Showing the calendar early and plainly is the intervention.

**What's next.** Real Open Banking data, Inbest and Policy in Practice integration for full entitlement checks, employer payroll-timing nudges, Scottish twice-monthly UC option, more languages, opt-out enrolment of alerts (the FCA found opt-in takes up 3 to 8%, opt-out 25% fewer charges).

**Built with:** nextjs, typescript, tailwind, recharts, supabase, anthropic, elevenlabs, n8n, twilio, vercel.

---

## 27. Judge Q&A

- **Is this financial advice?** No. It is budgeting, timing and entitlement guidance using public rules, outside the regulated advice perimeter. It never recommends products.
- **How do you stop the AI making numbers up?** It cannot compute; it only receives computed facts, returns structured text, and every pound figure and date in its output is checked against the facts. Rejections are logged and visible on `/behind`.
- **Why not just a benefits calculator?** Calculators exist (Inbest, Policy in Practice); take-up is the problem. Headroom surfaces the right entitlement at the moment it changes the person's forecast, with the pound effect shown on their own line, then links to the calculator.
- **How accurate is the forecast?** Fixed items are exact; variable spending has a band from the person's own history; assumptions (energy +4%) are labelled. We show ranges and confidence rather than a single number.
- **What about people whose income is not predictable at all?** The band widens; the coach asks about hours; the structural-deficit rule routes to human help rather than false reassurance.
- **Could NatWest ship this?** It needs only transaction data the bank already has, public rules, and existing partners (Inbest, Cora). The alert path mirrors the FCA-proven overdraft alerts.
- **Why WhatsApp?** Reach for people without data plans or smartphones; SMS fallback. Nous proved the channel for bills.
- **Bias and fairness?** Rules, not scores; the same logic for everyone; no demographic inputs.
- **Data protection?** Synthetic data today; in production, consented account data processed within the bank, nothing shared without a tap.
- **Business case?** Fewer unarranged overdrafts and defaults, Consumer Duty evidence, vulnerability support, retention. Headroom costs the customer nothing.

Questions for the NatWest workshop (14:00): How many of your customers are paid weekly or fortnightly and also receive Universal Credit? Does the app have any forward-looking view today? What happened after the Inbest pilot? How does Consumer Duty shape what you can proactively tell a customer about their balance? Would you deliver outside the app (WhatsApp, SMS)?

---

## 28. Sources

- FCA, Financial Lives 2024 survey: https://www.fca.org.uk/financial-lives/financial-lives-2024
- Citizens Advice, National Red Index 2025: https://www.citizensadvice.org.uk/policy/publications/the-national-red-index-2025-negative-budget-households-face-a-debt-crisis/
- Policy in Practice, Missing Out 2025: https://policyinpractice.co.uk/publication/missing-out-2025/
- Fair By Design, The poverty premium in 2026: https://fairbydesign.com/the-poverty-premium-in-2026/
- gov.uk, Universal Credit and earnings: https://www.gov.uk/guidance/universal-credit-and-earnings
- gov.uk, Universal Credit: how you're paid: https://www.gov.uk/universal-credit/how-youre-paid
- Ofgem, energy price cap: https://www.ofgem.gov.uk/your-energy-supply/your-energy-bill/energy-price-cap-unit-rates-and-standing-charges
- Ofcom, social tariffs: https://www.ofcom.org.uk/phones-and-broadband/saving-money/social-tariffs
- FCA Occasional Paper 36, overdraft alerts: https://www.fca.org.uk/publications/occasional-papers/occasional-paper-no-36-sending-out-sms-impact-automatically-enrolling-consumers-overdraft-alerts
- Nest Insight, workplace emergency savings: https://www.inclusivemoney.org.uk/research-projects/workplace-emergency-savings/
- NatWest app features: https://www.natwest.com/banking-with-natwest/natwest-app/appnews.html
- NatWest and Inbest pilot (2022): https://www.fintechscotland.com/new-fintech-collaboration-to-tackle-cost-of-living-crisis/
- National Numeracy, adult numeracy levels: https://www.nationalnumeracy.org.uk/
- gov.uk, bank holidays: https://www.gov.uk/bank-holidays

Extended notes with more sources are in the session research files (`research-verified.md`, `research-landscape.md`, `research-evidence.md`).

---

## 29. Verify on the day (10 minutes, D)

1. 2026/27 Universal Credit standard allowance, child element, work allowance and taper (gov.uk "Universal Credit: what you'll get"). If different, update `aisha.ts` and the footer label; the story does not change.
2. National Living Wage from April 2026 (affects nothing in the window; mention only if asked).
3. Ofgem: current cap level and the date of the January announcement.
4. Free school meals for all Universal Credit households in England: confirm start date (announced for September 2026); if not yet live, change eligibility to `check` and the copy to "Worth checking".
5. Manchester Band A council tax and the Council Tax Support scheme page URL.
6. Helpline numbers in the help card.
7. Twilio sandbox join code; ElevenLabs React SDK hook name and client-tools option; Anthropic SDK `tool_choice` syntax; n8n Twilio node WhatsApp support (if missing, use an HTTP Request node to the Twilio API).

---

## 30. After the hackathon (one paragraph for the slide)

Connect real accounts through Open Banking; plug in Inbest or Policy in Practice for full entitlement checks; let employers push payroll dates so bank-holiday shifts are known in advance; add the Scottish twice-monthly UC option and Alternative Payment Arrangements; opt-out enrolment of Headroom alerts with Consumer Duty reporting; adviser view for Citizens Advice with consent; evaluate with a randomised trial on unarranged overdraft days and entitlement take-up.



