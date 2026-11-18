# Headroom + Undertow

**Financial time travel for people and for places.** See money trouble coming weeks ahead, understand why, and fix it before it lands.

GreatUniHack 2026 · NatWest challenge: *AI-Powered Financial Inclusion & Resilience*

## The problem

Bank apps show what you spent last month, not what's coming next month. But most of the shocks that push people into overdraft are already on the calendar: Universal Credit dropping when an assessment period has five paydays, council tax starting again in April, energy cap changes, April price rises, Christmas. 24% of UK adults have low financial resilience (FCA 2024), and £24.1bn of support goes unclaimed every year.

## What we built

- **Headroom** ([`headroom/`](headroom)) is a customer app that forecasts your balance 90 days ahead with an uncertainty range. It shows the first shortfall and its named causes, then ranks the fixes (social tariffs, Council Tax Support, saving on the extra payday). You can turn each fix on and watch the forecast update. It comes with typed and voice AI coaches and works in English, Urdu and Polish.
- **Undertow** ([`undertow/`](undertow)) is an area view for councils and food banks. It forecasts hardship across all 346 Greater Manchester neighbourhoods up to 8 weeks ahead, simulates policy shocks, and shows where a crisis fund protects the most households.

## How it works

- **Deterministic engines do the maths, and AI does the language.** Claude writes explanations from numbers the engine has already computed. A number checker rejects any £ amount or date that isn't in the facts.
- **Headroom:** detects recurring transactions, applies UK rules (UC taper and assessment periods, bank holidays, council tax, energy cap) and runs 200 bootstrap paths to get P20/P50/P80 bands. Causes are measured by re-running the forecast without each one.
- **Undertow:** simulates 36k synthetic households × 200 Monte Carlo futures × 56 days on real ONS geography and deprivation data. It uses a Markov income model, compound-Poisson shocks and census reweighting, and protects each area's figures with Laplace differential privacy (ε = 1).

## Results

- The forecast map matches **real ONS claimant data at Spearman ρ = 0.84** across 344 neighbourhoods. The model never sees that data.
- Backtest on a held-out future: area error is **1.6 pts vs 3.6** for the baselines, with household **AUC 0.98** and **Brier score 0.043**.
- A £500k crisis fund targeted by Undertow protects **~860 households vs ~370** for most-deprived-first (2.3×).
- Demo persona Aisha's lowest balance goes from **−£140 to +£70** with three suggested actions.

## Tech stack

**Headroom:** Next.js, TypeScript, Tailwind, Recharts, zod, Vitest, Claude, ElevenLabs, n8n, Twilio.

**Undertow:** Python, NumPy, pandas, GeoPandas, Streamlit, pydeck, Plotly, pytest.

## Run it

```bash
cd headroom && npm install && npm run dev
```

```bash
cd undertow && pip install -r <(echo pandas numpy pyarrow geopandas shapely streamlit pydeck plotly anthropic elevenlabs python-dotenv pydantic) && streamlit run app.py
```

API keys are optional. Without them, every AI feature falls back to templates.

*Household finances are synthetic. Forecasts are for support only, never for credit decisions.*
