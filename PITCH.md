# Undertow: pitch kit

All numbers below come from the current engine run (seeded, so they are reproducible). Re-check them in the app before you present. If you change anything in `engine/config.py`, they will change.

## Key numbers (6 weeks ahead, baseline)

| What | Number |
|---|---|
| Households forecast unable to cover essentials | **≈ 259,000** of 1.15M in Greater Manchester (22.7%), likely 257,900–260,500 |
| Growth over time | ≈ 59,000 at 2 weeks → 209,000 at 4 → 259,000 at 6 → 300,000 at 8 (Christmas + January) |
| Hardest-hit neighbourhood | **Salford 016**: ≈ 1,960 households (34%), likely 1,820–2,120 |
| Next: | Oldham 035 (1,710), Rochdale 010 (1,650), Manchester 027 and 008 (1,640 each) |
| Energy bills +10% | **+4,400 households** pushed into shortfall; Salford 016, Rochdale 010 and Bolton 019 hit hardest |
| Private rents +6% | +11,900 households |
| Hospitality hours −20% | +15,800 households; Oldham 022 and Manchester 008/002 hit hardest |
| UC standard allowance +£20/month | −1,900 households |
| £500k crisis fund (£150 grants) | Undertow targeting protects **≈ 860 households** vs ≈ 370 most-deprived-first (2.3×) and ≈ 500 even split |
| Backtest: area error | **1.6 points** vs 3.6 for deprivation rank and 3.6 for last period's rate (less than half) |
| Backtest: ranking of areas | Spearman 0.95 vs 0.89 for both baselines |
| Household AUC / Brier | 0.98 / 0.043, with near-perfect calibration |
| Census reweighting | Customers only: 32.6% in the most deprived decile and 12.3% in the least; reweighted: 30.8% and 13.9% |
| Privacy | ε = 1 per area statistic, 2 of 346 areas hidden (under 50 customers) |

## 3-minute demo script

1. **Hook (0:00–0:20).** "Last year Trussell food banks handed out over 2.6 million emergency parcels. Most of those crises showed up in someone's bank account weeks earlier: irregular pay, a shrinking buffer, a Universal Credit payment that dropped because five Fridays fell in one assessment period. Today nobody acts until it's too late."
2. **The map (0:20–0:40).** Show the Map tab at +6 weeks. "This is Greater Manchester: 346 real neighbourhoods, real deprivation data, real Universal Credit rules. Household finances are synthetic, and we say so on every page. Undertow simulates 200 possible futures for each of 36,000 customer households, day by day."
3. **Time travel (0:40–1:10).** Drag the slider from +2 to +8 weeks and watch the city darken through Christmas into January. Click **Salford 016**: "About 1,960 households, likely between 1,820 and 2,120, can't cover essentials within six weeks. Here's why, and who." Click **Write briefing**: "Claude writes this for a food bank manager from area totals only. Every number it writes is checked against the data, so it can't invent one." *(If the ElevenLabs key is set, click **Listen**.)*
4. **Policy shock (1:10–1:40).** Choose the preset **Energy bills +10%**. "The whole city is re-forecast in seconds: 4,400 more households, and these are the areas hit hardest." Optionally, paste the sample announcement in the Policy tab to show Claude turning it into a scenario.
5. **Decision (1:40–2:10).** Allocator tab. "A council has £500,000. Most-deprived-first protects about 370 households. Undertow's targeting protects about 860 for the same money, because it funds the places where a grant actually changes the outcome."
6. **Trust (2:10–2:40).** Trust tab. "We backtest against a future the model never saw. Area error is less than half that of deprivation targeting, and the probabilities are calibrated. Only noisy area totals leave the bank, small areas are hidden, and it's for support only, never for credit."
7. **Close (2:40–3:00).** "Undertow turns NatWest's data into an early warning system for the communities it serves, so help arrives before the crisis, not after."

## Judge Q&A

- **Isn't this redlining?** It's for support only. That rule is in the AI prompt and stated on every page; in production it would be technically separated from credit systems. The allocator is benchmarked against deprivation targeting so the poorest areas can't be quietly skipped.
- **Is the data real?** Boundaries, deprivation, population and Universal Credit rules are real. Household finances are synthetic. The pipeline is built to run on real transactions inside the bank.
- **NatWest only sees its own customers.** We deliberately under-sampled deprived areas and gig/UC households, then reweighted to the full population. The Trust tab shows the difference this makes.
- **How accurate is it?** On a held-out synthetic future: AUC 0.98, calibrated probabilities, and area error less than half the baselines'. Honest limit: that future comes from the same model family, so it proves the pipeline, not real-world accuracy. Next step: a hindcast of the 2022 energy crisis using only 2021 data, scored against ONS claimant counts, DWP Universal Credit and Citizens Advice data.
- **Why Monte Carlo, not just machine learning?** It's structural: it responds correctly to policy changes nobody has seen before (energy cap, rent, UC rules), and it gives honest uncertainty. Shocks are shared within an area and sector, so the ranges reflect correlated risk.
- **Privacy?** Each area rate gets Laplace noise scaled to the most one household could change it (ε = 1), areas under 50 customers are hidden, drivers are released only to the nearest 5%, and Claude only sees area totals.
- **How is this different from Policy in Practice's LIFT?** LIFT uses council benefit records to show who is at risk now. Undertow uses bank cash-flow patterns to forecast who will be at risk in the coming weeks, and simulates policies. The two are complementary.
- **What would NatWest need to deploy it?** Transaction and postcode data (already held), its existing vulnerability team, and data-sharing agreements with councils for the area forecasts.

## Devpost write-up

**Tagline:** See where financial hardship is about to hit, weeks before it does, so help arrives before the crisis.

**Inspiration.** Food banks, councils and banks all act after the crisis. Yet the warning signs (irregular pay, shrinking buffers, a Universal Credit payment cut because five paydays fell in one assessment period, Christmas, energy bills) are visible in cash flow weeks earlier. We wanted NatWest's "financial time travel" at the scale of a city.

**What it does.** Undertow forecasts, for each of Greater Manchester's 346 neighbourhoods, how many households will be unable to cover essentials in 2–8 weeks, with an uncertainty range, the drivers and the household types affected. It simulates policy shocks (energy, rent, UC, hours cuts) in seconds, tells a council where a fixed crisis budget keeps the most households afloat, writes AI briefings for councils and food banks, and turns pasted policy announcements into scenarios.

**How we built it.** Real ONS boundaries and Indices of Deprivation data; 36,000 synthetic customer households × 200 Monte Carlo futures × 56 days, with Markov pay regimes, shocks shared by area and sector, Universal Credit recomputed per assessment period, bills on real due dates with bank-holiday shifts, and surprise costs. Census reweighting with shrinkage, Laplace differential privacy and small-area suppression. A backtest against a held-out future, beating deprivation and persistence baselines. Claude (structured JSON outputs) for briefings and policy parsing, with every number checked; ElevenLabs for spoken briefings. Python, NumPy, GeoPandas, Streamlit, pydeck, Plotly.

**Challenges.** Calibrating realistic budgets; making privacy noise unbiased (our first version inflated small areas until we added shrinkage); making the allocator comparison fair (area-level decisions only); stopping the AI from inventing numbers.

**What's next.** Run on real transactions inside the bank; a 2022 energy-crisis hindcast against ONS, DWP and Citizens Advice data; n8n alerts to councils and food banks; voice outreach to opted-in customers in their own language; a multi-bank data trust.

**Built with:** python, numpy, pandas, geopandas, streamlit, pydeck, plotly, anthropic-claude, elevenlabs

## Before you present (checklist)

- [ ] Run the app and wait for the first load (about 20 seconds of simulation)
- [ ] Generate the Salford 016 briefing once beforehand, so it's cached (and the audio too, if using ElevenLabs)
- [ ] Run Energy +10% once beforehand, so it's cached
- [ ] Record a 2-minute backup video of the demo flow
- [ ] Check the Trussell 2025 figure (2.6M parcels) against the source
