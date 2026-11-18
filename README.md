# Headroom + Undertow

**Financial time travel for people and for places.** See money trouble coming weeks ahead, understand why it's happening, and fix it before it arrives.

GreatUniHack 2026 · NatWest challenge: *AI-Powered Financial Inclusion & Resilience*

| | **Headroom** | **Undertow** |
|---|---|---|
| For | The customer | Councils, food banks, NatWest's vulnerability team |
| Shows | One person's money, 90 days ahead | Hardship in every Greater Manchester neighbourhood (346 MSOAs), 8 weeks ahead |
| Stack | Next.js · TypeScript | Python · Streamlit |
| Folder | [`headroom/`](headroom) | [`undertow/`](undertow) |

---

## 1. The problem

Bank apps show what you spent last month. None of them tell someone on a tight budget what's going to happen next month. But most of the shocks that push people into overdraft and debt are **predictable, because they're already on the calendar**:

- **Universal Credit drops when an assessment period has five paydays.** For weekly-paid workers that happens four times a year, and UC falls by 55p for every extra £1 earned.
- **Council tax starts again every April** after two free months, and the yearly rise comes with it.
- **The energy price cap changes every quarter.**
- **Benefits are paid early before bank holidays**, so the wait until the next payment is longer.
- **Broadband and mobile prices go up every April.**
- **Christmas, birthdays and school uniforms** come round on the same dates every year.

The scale:

- **24% of UK adults (13.1 million)** have low financial resilience (FCA Financial Lives 2024).
- **£24.1 billion** of benefits and social tariffs go unclaimed every year (Policy in Practice 2025).
- The FCA found that **automatic overdraft alerts cut charges by about 25%**, and alerts sent *before* the money leaves work best.

The warning signs are there weeks in advance. People just aren't told. Communities have the same problem: councils and food banks only see the crisis once it reaches their door.

---

## 2. How we solved it

We built two connected tools around one idea: **deterministic engines do the maths, and AI handles the language, the tool use and the voice.** No AI ever makes up a number that a customer or a council sees.

### Headroom: the customer app

Demo persona: **Aisha**, 34, Levenshulme, Manchester. She's a zero-hours care worker paid weekly, claims Universal Credit and has a six-year-old daughter.

1. **90-day forecast with an honest range.** Shows the day-by-day projected balance with a P20–P80 band that widens further out. A headline figure gives the lowest point (e.g. *"Lowest point: about −£140 on Mon 1 Feb"*), and a weekly strip rates each week Comfortable, Tight or Short.
2. **Time-travel scrubber.** Drag to any day to see what happens and why. Example: *"Thu 31 Dec. Universal Credit lands early because 2 Jan is a Saturday: about £799, which is £154 less than usual."*
3. **One calm warning with named causes.** Causes are measured by ablation and listed biggest first. A **"How we worked this out"** panel lists every transaction and public rule behind each number.
4. **Learning from last year.** Annual repeats (Christmas, birthdays, MOT), "this happened to you in October and last January", and a 12-month history chart with the five-payday months marked.
5. **A ranked plan that moves the line.** Options include saving on the extra payday, the broadband social tariff, free school meals, Council Tax Support, 12-month council tax and moving a BNPL payment. Each is ranked by pounds gained by the shortfall date. Turning one on re-runs the forecast live, and Aisha's lowest point goes from **about −£140 to about +£70**.
6. **AI coach, typed and spoken.** "What if my hours drop to 16 a week in January?" becomes a validated scenario that re-runs the real engine. A voice version runs on ElevenLabs Conversational AI. Structural problems or signs of distress are handed to Citizens Advice, StepChange or MoneyHelper.
7. **"You're not alone."** Shows Undertow's privacy-protected forecast for Aisha's own neighbourhood, built without her personal data.
8. **Built for inclusion.** English, Urdu (right-to-left) and Polish. Reading age about 9–11, adjustable text size, money in pounds rather than percentages, and plans and reminders sent by WhatsApp or SMS.
9. **`/behind` console.** Shows the detected recurring payments, which rules fired, a live activity feed and demo controls.

### Undertow: the area view

The same "financial time travel" at city scale:

- **Hardship map with a time slider** (+2 / +4 / +6 / +8 weeks) and an uncertainty range for every area.
- **Why and who:** the decisive drivers (hours cut, UC timing, surprise costs, Christmas, costs above income) and the household types affected.
- **Policy shock simulator:** energy, rent, the UC standard allowance and sector hours cuts. The whole city is re-forecast in about 7 seconds.
- **Crisis fund allocator:** shows where a fixed budget keeps the most households out of shortfall.
- **Policy announcement → scenario:** paste in a news announcement and Claude turns it into a validated, runnable scenario.
- **AI briefings plus voice** for food bank managers and councillors, written only from privacy-protected area totals.
- **Trust & method tab:** backtest, calibration curve, privacy ledger, census reweighting, and what's real vs synthetic.

---

## 3. Implementation

### Repository layout

```
.
├── headroom/                 Next.js customer app
│   ├── src/lib/forecast/     deterministic forecast engine (pure TypeScript)
│   │   ├── detect.ts, recurring.ts   recurring-transaction detection
│   │   ├── rules/                    UC, council tax, energy cap, April rises, annual repeats
│   │   ├── calendar/                 English bank holidays, working-day shifts
│   │   ├── project.ts, model.ts      bootstrap projection, shortfall detection
│   │   ├── actions/                  action catalogue + ranking
│   │   └── seed/                     deterministic 12-month history for Aisha
│   ├── src/lib/coach/        Claude prompts, tool-using chat loop, number check
│   ├── src/lib/voice/        ElevenLabs client tools + insights
│   ├── src/app/api/          forecast, whatif, explain, coach, plan, activity, voice, demo
│   ├── n8n/                  plan-created and payday-reminder workflows
│   ├── supabase/schema.sql   plan/activity persistence (optional; in-memory by default)
│   └── tests/                vitest
└── undertow/                 Streamlit area view
    ├── engine/               population, simulate, uc, calendar, aggregate, allocate, backtest, realworld
    ├── llm/                  briefings, policy parsing, number check, voice
    ├── scripts/              prepare_geo, prepare_realworld, export_headroom
    ├── data/                 ONS boundaries, IMD 2019, claimant count (validation only)
    └── tests/                pytest
```

### Headroom's forecast engine (TypeScript, deterministic)

1. **Recurring detection** across 12 months of transactions finds wages, benefits, rent, direct debits, standing orders and weekly spending patterns, along with each one's cadence and typical amount.
2. **UK calendar rules:** UC assessment periods with the 55% taper, the work allowance and early payment before weekends and bank holidays; quarterly energy cap changes; council tax in 10 instalments; April price rises; annual repeats; English bank holidays.
3. **200 bootstrap paths.** Each event's amount is resampled from that series' own history. UC is recomputed from each path's wages, and everyday spending drifts slightly so the band widens. The P20, P50 and P80 are taken per day.
4. **Shortfall detection** joins short runs that are split by a one-day recovery, then **names the causes by ablation**: each cause is removed in turn and the forecast re-run to measure how much it moves the lowest point.
5. **Action ranking:** each option is simulated through the same engine and scored by the pounds it gains at the shortfall date.

Same inputs → same forecast, every time (seeded RNG).

### Undertow's simulation (Python / NumPy)

**36,000 synthetic customer households × 200 Monte Carlo futures × 56 days.**

- **Real geography and deprivation:** ONS MSOA boundaries and the English Indices of Deprivation 2019. Real deprivation drives each area's household-type mix (6 types).
- **Cash flow:** a Markov pay regime (normal / reduced / lost hours), with shocks shared within an area and within a sector so risk is correlated. Bills fall on real due dates with working-day shifts. Christmas is included, and surprise costs follow a **compound-Poisson** process.
- **Universal Credit recomputed in every future**, assessment period by assessment period, from that path's own wages. This is what captures the real five-payday cut.
- **Shortfall:** balance plus savings falls below the overdraft limit. A driver is **decisive** if removing that one shock would have avoided the shortfall.
- **Fair to people NatWest doesn't see:** deprived areas and gig/UC households are deliberately under-sampled, then corrected with **census post-stratification** plus **shrinkage** for small cells.
- **Privacy:** **Laplace differential privacy** (ε = 1 per released area statistic), areas with fewer than 50 customers suppressed, drivers rounded to 5%. Only area totals leave the "bank", and Claude only ever sees those totals.
- **Bridge to Headroom:** `scripts/export_headroom.py` exports only the released, noised totals for Aisha's neighbourhood (Manchester 031) into the customer app.

### AI features

| Feature | Where | How |
|---|---|---|
| Plain-English "Why" | Headroom | Claude gets a `Facts` object with every number already computed and returns structured text. It writes words around the numbers and never does arithmetic. |
| **Number check (anti-hallucination)** | Both | Every £ amount, percentage and date in the AI output must match the facts (±£1). If not, the output is rejected, Claude retries, and a template is used as a last resort. Words like "loan", "borrow", "credit card" and "advance" are banned. |
| Tool-using chat coach | Headroom | Tools: `get_forecast`, `simulate_scenario`, `list_actions`, `accept_actions`, `request_human_help` (up to 4 rounds). "What if" questions become zod-validated scenarios. A deterministic fallback answers if the API is down. |
| Voice coach | Headroom | ElevenLabs Conversational AI agent (signed URL) that calls the **same five tools**, so spoken numbers are verified too. |
| Multilingual | Headroom | Claude explains in English, Urdu or Polish. Money and date formats stay fixed so the number check still works. |
| Area briefings | Undertow | Claude with forced tool output, built from privacy-protected totals only, with every number checked. |
| Spoken briefings | Undertow | ElevenLabs `eleven_multilingual_v2` TTS. |
| Policy → scenario | Undertow | Claude extracts a validated scenario from pasted text using a forced tool call. |
| Automation | Headroom | n8n workflows `plan-created` and `payday-reminder` send WhatsApp messages through Twilio, protected by shared secrets. If n8n doesn't respond within 5 s, the server sends through Twilio directly. Message text is always built by the server from engine numbers. |

---

## 4. Tech stack and techniques

**Headroom:** TypeScript, Next.js 16, React 19, Tailwind CSS 4, Recharts, date-fns, zod, Vitest, Anthropic Claude SDK, ElevenLabs React SDK, Supabase (optional), n8n, Twilio (WhatsApp/SMS), Vercel.

**Undertow:** Python 3.12, NumPy, pandas, GeoPandas, Shapely, PyArrow, Streamlit, pydeck, Plotly, Pydantic, Anthropic, ElevenLabs, pytest.

**Statistical and ML techniques**

- Recurring-transaction detection (cadence and amount inference)
- Bootstrap resampling for forecast uncertainty bands (P20/P50/P80)
- Monte Carlo simulation (200 paths per household)
- Markov regime-switching income model
- Compound-Poisson shock process
- Correlated shocks across area and sector
- Ablation / counterfactual attribution of causes and decisive drivers
- Post-stratification (census reweighting) with shrinkage towards city-wide rates
- Laplace-mechanism differential privacy and small-area suppression
- Budget-constrained allocation of crisis grants, benchmarked against baselines
- Evaluation: Spearman rank correlation, AUC, Brier score, calibration curves, held-out backtesting

---

## 5. Results

### Real-world validation
- The Undertow forecast map agrees with **independent ONS Claimant Count data (Sept 2026)** across **344 neighbourhoods at Spearman ρ = 0.84**, and **24 of the real top-50** hardest-hit areas are shared. Claimant data is never used in the model.
- For transparency: the 2019 deprivation score on its own scores **ρ = 0.92** (29/50). Undertow is built from deprivation, so it can't beat its own input on *where* hardship is. What it adds is **when, why, what-if and where to spend**, which a static index can't give.

### Held-out future backtest (6 weeks)

| Metric | Undertow | Deprivation-rank baseline | Last-period baseline |
|---|---|---|---|
| Area error (percentage points) | **1.6** | 3.6 | 3.6 |
| Area ranking (Spearman ρ) | **0.95** | 0.89 | 0.89 |
| Household AUC | **0.98** | n/a | n/a |
| Household Brier score | **0.043** | n/a | n/a |

Calibration is close to perfect. Caveat: the held-out future comes from the same model family, so this validates the pipeline and its uncertainty, not real-world forecast accuracy.

### City-wide forecast (baseline, 6 weeks ahead)
- **≈ 259,000 of 1.15M households** in Greater Manchester (22.7%) forecast to be unable to cover essentials (likely range 257,900–260,500).
- Growth over time: ≈ 59k at 2 weeks → 209k at 4 → 259k at 6 → 300k at 8 (Christmas into January).
- Hardest-hit neighbourhood: **Salford 016**, ≈ 1,960 households (34%).

### Policy shocks
| Scenario | Change in households in shortfall |
|---|---|
| Energy bills +10% | **+4,400** |
| Private rents +6% | +11,900 |
| Hospitality hours −20% | +15,800 |
| UC standard allowance +£20/month | −1,900 |

### Crisis fund allocation (£500k in £150 grants)
| Strategy | Households protected |
|---|---|
| **Undertow targeting** | **≈ 860** |
| Even split | ≈ 500 |
| Most-deprived-first | ≈ 370 |

That's **2.3×** the households protected by most-deprived-first, for the same money.

### Fairness and privacy
- Census reweighting corrects customer under-sampling: the most-deprived decile moves from 32.6% to 30.8% and the least-deprived from 12.3% to 13.9%.
- ε = 1 per area statistic; 2 of 346 areas hidden for having under 50 customers.

### Individual impact (Headroom)
- Aisha's predicted lowest point goes from **about −£140 to about +£70** with three actions (save £150 on the extra payday, broadband social tariff, free school meals), and her headroom grows by **about £65 a month** after that.

*All figures come from seeded, reproducible engine runs and are shown live in the apps (Undertow's Trust tab). Changing `undertow/engine/config.py` will change them.*

---

## 6. Running it

### Headroom
```bash
cd headroom
npm install
cp .env.example .env.local   # optional: ANTHROPIC_API_KEY, ELEVENLABS_*, TWILIO_*, N8N_*
npm run dev                  # http://localhost:3000
npm test
```
Without API keys, every AI feature falls back to deterministic templates, so the app still works end to end.

### Undertow
```bash
cd undertow
python3.12 -m venv .venv
.venv/bin/pip install pandas numpy pyarrow geopandas shapely streamlit pydeck plotly anthropic elevenlabs python-dotenv pytest pydantic
cp .env.example .env         # optional: ANTHROPIC_API_KEY, ELEVENLABS_API_KEY
.venv/bin/streamlit run app.py   # first load runs the simulation (~20 s)
.venv/bin/python -m pytest -q tests
```

---

## 7. Real vs synthetic

- **Real:** ONS boundaries, deprivation scores, population, Universal Credit rules (taper, work allowance, assessment periods, payment dates), bank holidays, the energy cap schedule, and ONS claimant data (used **only** for validation).
- **Synthetic:** household finances, Aisha's transactions, who banks with NatWest, and the held-out future used for the backtest.

**Support only.** Forecasts are used to direct support, never for credit, pricing or enforcement. This rule is in the AI prompts and stated on every page.

## 8. What's next

- Run on real transactions inside the bank (NatWest already holds this data and aggregates other banks' accounts).
- Hindcast the 2022 energy crisis against ONS, DWP and Citizens Advice data.
- n8n alerts to councils and food banks when an area's forecast rises.
- Voice outreach to opted-in customers in their own language.
- Benefits-calculator integration (e.g. Inbest, already piloted by NatWest).
- A multi-bank data trust.

Further detail: [`DEVPOST.md`](DEVPOST.md), [`plan.md`](plan.md), [`undertow/PITCH.md`](undertow/PITCH.md).
