# Headroom + Undertow

**Financial time travel for people and for places.** See money trouble coming weeks ahead, understand why, and fix it before it lands.

GreatUniHack 2026 · NatWest challenge: *AI-Powered Financial Inclusion & Resilience*

## The problem

Bank apps show what you spent last month, not what's coming next month. But most of the shocks that push people into overdraft are already on the calendar: Universal Credit dropping when an assessment period has five paydays, council tax starting again in April, energy cap changes, April price rises, Christmas. 24% of UK adults have low financial resilience (FCA 2024), and £24.1bn of support goes unclaimed every year.

## What we built

| | **Headroom** ([`headroom/`](headroom)) | **Undertow** ([`undertow/`](undertow)) |
|---|---|---|
| For | The customer | Councils, food banks, NatWest's vulnerability team |
| Forecasts | One person's balance, 90 days ahead | Hardship in 346 Greater Manchester neighbourhoods, 8 weeks ahead |
| Key features | Shortfall warning with named causes, ranked fixes you can toggle, typed and voice AI coach, English/Urdu/Polish | Hardship map with a time slider, policy-shock simulator, crisis-fund allocator, AI briefings |
| Stack | Next.js · TypeScript | Python · Streamlit |

Our core rule: **deterministic engines do the maths, and AI does the language.** Claude writes explanations from numbers the engine has already computed. A number checker rejects any £ amount or date that isn't in the facts, and banned words (e.g. "loan", "borrow") stop the coach from pushing people into debt.

## Implementation: Headroom

A pure TypeScript forecast engine (`src/lib/forecast/`), so the same inputs always give the same output.

1. **Recurring detection:** finds wages, benefits, rent, direct debits and weekly spending patterns in 12 months of transactions.
2. **UK calendar rules:** UC assessment periods with the 55% taper and work allowance, early payment before weekends and bank holidays, the quarterly energy cap, council tax in 10 instalments, April rises, annual repeats.
3. **Uncertainty:** 200 bootstrap paths that resample each bill's past amounts and recompute UC from each path's wages, giving P20/P50/P80 bands per day.
4. **Causes:** each driver is removed in turn and the forecast re-run to measure how much it moves the lowest point.
5. **Actions:** each fix is simulated through the same engine and ranked by pounds gained at the shortfall date.

| AI feature | How it works |
|---|---|
| "Why" explanation | Claude turns the engine's facts into plain English, and every number is checked |
| Chat coach | Claude with tools (`get_forecast`, `simulate_scenario`, `list_actions`, …). "What if" questions become zod-validated scenarios |
| Voice coach | ElevenLabs Conversational AI calling the same tools |
| Reminders | n8n + Twilio send the plan and payday reminders over WhatsApp, with a direct Twilio send if n8n fails |

## Implementation: Undertow

**36,000 synthetic households × 200 Monte Carlo futures × 56 days**, built on real government geography and deprivation data.

| Step | Method |
|---|---|
| Geography | ONS MSOA boundaries + English Indices of Deprivation 2019 |
| Population | 6 household types, mix driven by real deprivation; deprived and UC households deliberately under-sampled (like a real bank's customer base) |
| Income | Markov regime model (normal / reduced / lost hours), with shocks shared across area and sector |
| Costs | Bills on real due dates with working-day shifts, Christmas, compound-Poisson surprise costs |
| Universal Credit | Recalculated in every future, per assessment period, from that path's wages |
| Shortfall | Balance + savings below overdraft limit. A driver is *decisive* if removing it alone avoids the shortfall |
| Aggregation | Census post-stratification with shrinkage for small cells |
| Privacy | Laplace differential privacy (ε = 1), areas under 50 customers hidden, only area totals leave the "bank" |

## Results

### Validated against government public data

We checked Undertow's forecast map against **the ONS Claimant Count (Sept 2026)**, official government statistics that the model **never sees**.

| Check | Result |
|---|---|
| Rank agreement with ONS claimant rates (344 neighbourhoods) | **Spearman ρ = 0.84** |
| Overlap with the real top-50 hardest-hit areas | **24 / 50** |

Deprivation alone scores ρ = 0.92, which is expected since the model is built on it. What Undertow adds is *when*, *why*, *what-if* and *where to spend*.

### Backtest on a held-out 6-week future

| Metric | Undertow | Deprivation baseline | Last-period baseline |
|---|---|---|---|
| Area error (pts) | **1.6** | 3.6 | 3.6 |
| Area ranking (ρ) | **0.95** | 0.89 | 0.89 |
| Household AUC | **0.98** | n/a | n/a |
| Brier score | **0.043** | n/a | n/a |

### Policy shocks and crisis funding

| Scenario | Households pushed into shortfall |
|---|---|
| Energy bills +10% | +4,400 |
| Private rents +6% | +11,900 |
| Hospitality hours −20% | +15,800 |
| UC allowance +£20/month | −1,900 |

| £500k crisis fund (£150 grants) | Households protected |
|---|---|
| **Undertow targeting** | **~860** |
| Even split | ~500 |
| Most-deprived-first | ~370 |

On the customer side, demo persona Aisha's lowest balance goes from **−£140 to +£70** with three suggested actions.

## Tech stack

| | |
|---|---|
| Headroom | Next.js, React, TypeScript, Tailwind, Recharts, zod, Vitest |
| Undertow | Python, NumPy, pandas, GeoPandas, Streamlit, pydeck, Plotly, pytest |
| AI & integrations | Claude, ElevenLabs, n8n, Twilio (WhatsApp) |

## Run it

```bash
cd headroom && npm install && npm run dev
```

```bash
cd undertow && pip install pandas numpy pyarrow geopandas shapely streamlit pydeck plotly anthropic elevenlabs python-dotenv pydantic && streamlit run app.py
```

API keys are optional. Without them, every AI feature falls back to templates.

*Household finances are synthetic. Forecasts are for support only, never for credit decisions.*
