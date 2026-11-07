# Undertow

**Forecasting financial hardship before it happens, neighbourhood by neighbourhood.**
GreatUniHack 2026 · NatWest challenge: AI-Powered Financial Inclusion & Resilience

Undertow simulates the next 8 weeks of cash flow for every (synthetic) NatWest customer household in Greater Manchester, then releases a privacy-protected forecast for each of the 346 neighbourhoods of how many households will be unable to cover essentials. Councils, food banks and the bank's vulnerability team can then act **before** the crisis.

## What it does
- **Hardship map:** forecast share of households short at +2, +4, +6 and +8 weeks, with an uncertainty range for every area.
- **Why and who:** the decisive drivers for each area (pay or hours cut, Universal Credit timing, surprise costs, Christmas, costs above income) and the household types affected.
- **Policy shock simulator:** energy bills, private rents, the UC standard allowance and sector hours cuts. The whole city is re-forecast in about 7 seconds.
- **Crisis fund allocator:** where a fixed budget keeps the most households out of shortfall, compared against most-deprived-first and even-split targeting.
- **Policy announcement → scenario:** Claude turns a pasted announcement into a validated scenario.
- **AI briefings:** Claude writes a briefing for each area from area totals only, and every number is checked against the data.
- **Trust tab:** a backtest against a held-out future and two baselines, a calibration curve, a privacy ledger, census reweighting, and what's real vs synthetic.

## How it works
| Step | Method |
|---|---|
| Geography | Real: ONS MSOA 2011 boundaries + English Indices of Deprivation 2019, LSOAs combined into MSOAs (`scripts/prepare_geo.py`) |
| Population | 36,000 synthetic customer households, 6 household types, mix driven by real deprivation; customers deliberately under-sampled in deprived areas |
| Simulation | 200 Monte Carlo futures × 56 days per household: Markov pay regimes, shocks shared by area and sector, **Universal Credit recalculated from each future's wages per assessment period** (the real five-payday cut), bills on real due dates with working-day shifts, Christmas, compound-Poisson surprise costs |
| Shortfall | Balance + savings below the overdraft limit. A driver is *decisive* if removing that shock alone would avoid the shortfall |
| Aggregation | Census reweighting (post-stratification) with shrinkage for small cells; P10/P90 bands across paths |
| Privacy | Laplace noise on each area rate scaled to its sensitivity (ε = 1), suppression under 50 customers, drivers rounded to 5%, only area totals leave the "bank" |
| AI | Claude with forced tool output for briefings and policy parsing; every number in a briefing is checked against the facts, with retry and template fallback |

## Results (held-out synthetic future, 6 weeks)
Shown live on the Trust tab. In the current run: household AUC 0.98, calibration close to perfect, and area-level error about half that of deprivation-rank and persistence baselines. The honest limit: the held-out future comes from the same model family, so this checks the pipeline and its uncertainty, not real-world accuracy. The next step is a hindcast of the 2022 energy crisis against ONS claimant counts, DWP Universal Credit and Citizens Advice data.

## Run it
```bash
python3.12 -m venv .venv && .venv/bin/pip install pandas numpy pyarrow geopandas shapely streamlit pydeck plotly anthropic python-dotenv pytest pydantic
```

```bash
cp .env.example .env   # add ANTHROPIC_API_KEY for live briefings (a template is used without it)
```

```bash
.venv/bin/streamlit run app.py
```

```bash
.venv/bin/python -m pytest -q tests
```

## Real vs synthetic
**Real:** boundaries, deprivation scores and population, Universal Credit rules (taper, work allowance, assessment periods, payment dates), bank holidays.
**Synthetic:** household finances, household-type mix per area, who banks with NatWest, the held-out future used for the backtest.

Forecasts are for directing **support only**, never for credit, pricing or enforcement.
