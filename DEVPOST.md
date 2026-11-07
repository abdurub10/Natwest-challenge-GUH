# Headroom + Undertow

**Tagline:** Financial time travel for people and for places. See the money trouble coming weeks ahead, understand why, and fix it before it lands.

GreatUniHack 2026 · NatWest challenge: AI-Powered Financial Inclusion & Resilience

---

## Inspiration

Bank apps tell you what you spent last month. Nothing tells someone on a tight budget what will happen next month, yet most of the shocks that push people into overdrafts are already on the calendar:

- **Universal Credit drops when a weekly-paid worker's assessment period contains five paydays.** This happens four times a year. UC falls by 55p for every extra £1 earned.
- **Council tax comes back every April** after two free months, with the yearly rise added.
- **The energy price cap changes every quarter.**
- **Benefits are paid early before bank holidays,** which leaves a longer gap until the next payment.
- **Broadband and mobile prices go up every April.**
- **Christmas, birthdays and school uniforms** come round on the same dates every year.

24% of UK adults (13.1 million) have low financial resilience (FCA Financial Lives 2024). £24.1 billion of benefits and social tariffs go unclaimed every year (Policy in Practice 2025). The FCA found that automatic overdraft alerts cut charges by about 25%, and that alerts sent before the money leaves work best.

So the warning signs exist weeks in advance. People just aren't told. We built two connected tools:

1. **Headroom** is for the customer. It shows your money 90 days ahead.
2. **Undertow** is for the community. It shows where hardship is about to hit, neighbourhood by neighbourhood.

---

## What it does

### Headroom (customer app)

Our demo persona is **Aisha**, 34, from Levenshulme in Manchester. She is a care worker on a zero-hours contract, paid weekly, gets Universal Credit and has a six-year-old daughter.

**1. See ahead: a 90-day forecast with an honest range**
- A day-by-day projected balance for the next 90 days. It shows a likely value plus a P20–P80 range that widens the further ahead it looks.
- A **headroom figure** at the top, e.g. "Lowest point: about −£140 on Mon 1 Feb".
- A **weekly strip** that rates each week Comfortable, Tight or Short, like a weather forecast.

**2. Time travel scrubber**
- Drag to any day in the next 90 days. A day card shows what happens that day and why. For example: *"Thu 31 Dec. Universal Credit lands early because 2 Jan is a Saturday: about £799, which is £154 less than usual."*
- You can see the shortfall coming and the exact events that cause it.

**3. One calm warning, with the reasons spelled out**
- The first predicted shortfall appears as a single card showing when it starts, how deep it goes, how long it lasts and its named causes, biggest first.
- Each cause is measured by **ablation**: the engine re-runs the forecast without that cause and reports how much the lowest point changes.
- A **"How we worked this out"** panel lists every transaction and public rule behind each number: the five paydays, the 55% taper, the 33-day gap, last year's Christmas pattern and the energy cap assumption.

**4. Learning from the previous year**
- **Annual repeats:** one-off costs from last year (Christmas, Zara's birthday, school uniform, the MOT) are expected again on the same dates this year.
- **"This happened before":** the Why screen points to past overdraft months, e.g. "This happened to you in October and last January."
- **A 12-month history chart** shows each month's lowest balance. The five-payday months are marked and the overdraft days are labelled, so the pattern behind the forecast is easy to see.
- Recurring payments are detected from 12 months of transactions. Their past amounts are re-sampled to build the uncertainty band.

**5. A ranked plan that moves the line**
- Options are ranked by pounds gained by the shortfall date and by effort:
  - Put money aside on the extra payday
  - Broadband social tariff
  - Free school meals
  - Council Tax Support
  - Spread council tax over 12 months
  - Ask Klarna to move a payment
  - Talk to someone who can help
- Turning an option on re-runs the forecast straight away, and the chart and lowest point update. Aisha's lowest point goes from about −£140 to about +£70.
- **"Set this up"** saves the plan, schedules payday reminders and sends the plan to her phone by WhatsApp.

**6. AI coach, typed and spoken**
- Ask "What if my hours drop to 16 a week in January?" The coach turns the question into a scenario, re-runs the real forecast and answers with the new numbers.
- **Voice coach (ElevenLabs Conversational AI):** the same coach by voice, for people who prefer not to read or type.
- If the problem is structural rather than a timing issue, or the person sounds distressed, the coach hands over to free human help: Citizens Advice, StepChange or MoneyHelper.

**7. "You're not alone": the neighbourhood view inside the app**
- A card shows Undertow's privacy-protected forecast for Aisha's own neighbourhood, e.g. "Around 1 in 4 households in Levenshulme could run short in the next 8 weeks. Local help is being planned for this."
- It also gives the main local driver (costs higher than income, surprise costs, pay cuts, UC timing or Christmas). It never uses her personal data.
- This links one person's forecast to their community, and links the customer app to the area view.

**8. Built for inclusion**
- Three languages: **English, Urdu (right-to-left) and Polish**. Claude writes explanations and replies in the chosen language.
- Text size switch, a reading age of about 9–11, money shown in pounds rather than percentages, and no jargon or shaming.
- WhatsApp and SMS delivery, so it works for people with little mobile data.

**9. Behind the scenes (`/behind`)**
- A projector console showing the detected recurring payments, which calendar rules fired, the 12-month history chart and a live activity feed (plan sent, reminder sent, with timestamps).
- Demo controls: reset, "send Friday reminder now", and an n8n on/off switch to test the fallback.

### Undertow (area view for councils, food banks and the bank's vulnerability team)

Undertow scales the same "financial time travel" up to a whole city: **every neighbourhood in Greater Manchester (346 MSOAs)**.

- **Hardship map with time travel:** a slider moves the forecast to +2, +4, +6 or +8 weeks. You can watch the city get darker through Christmas into January. Every area has an uncertainty range.
- **Why and who:** for each area, the decisive drivers (pay or hours cut, UC timing, surprise costs, Christmas, costs above income) and the household types affected.
- **Policy shock simulator:** sliders for energy bills, private rents, the UC standard allowance, and hospitality and retail hours cuts. The whole city is re-forecast in about 7 seconds. For example, energy bills +10% pushes about **4,400 more households** into shortfall.
- **Crisis fund allocator:** shows where a fixed budget keeps the most households out of shortfall. With £500k in £150 grants, Undertow's targeting protects about **860 households**, against about 370 for most-deprived-first (2.3×) and about 500 for an even split.
- **Policy announcement → scenario:** paste a news announcement and Claude turns it into a validated scenario, which you can run on the map.
- **AI briefings plus voice:** Claude writes a briefing for each area for a food bank manager or councillor. ElevenLabs reads it aloud.
- **Trust & method tab:** a backtest, a calibration curve, a privacy ledger, census reweighting, and a clear list of what is real and what is synthetic.

---

## How we used the area view to forecast

Undertow simulates **36,000 synthetic customer households × 200 Monte Carlo futures × 56 days**:

- **Real geography and deprivation:** ONS MSOA boundaries and the English Indices of Deprivation 2019. The household-type mix in each area is driven by real deprivation.
- **Realistic cash flow:** pay follows a Markov model that switches between normal, reduced and lost hours. Shocks are shared within an area and within a sector, so risk is correlated. Bills fall on real due dates and move around weekends and bank holidays. Christmas is included, and surprise costs follow a compound-Poisson process.
- **Universal Credit recalculated in every future:** each path recomputes UC from that path's own wages, assessment period by assessment period. This captures the real five-payday cut.
- **Shortfall and decisive drivers:** a household is short when its balance plus savings falls below its overdraft limit. A driver counts as *decisive* if removing that one shock would have avoided the shortfall.
- **Fair to people NatWest doesn't see:** we deliberately under-sampled deprived areas and gig/UC households, then used census reweighting (post-stratification) with shrinkage for small cells.
- **Privacy:**
  - Laplace differential privacy on each area rate (ε = 1)
  - Areas with fewer than 50 customers are hidden
  - Drivers are rounded to the nearest 5%
  - Only area totals ever leave the "bank"
  - Claude only sees area totals
- **The bridge to Headroom:** `export_headroom.py` exports only the released, noised totals for Aisha's neighbourhood (Manchester 031, Levenshulme) into the customer app. That export powers the "You're not alone" card.

### Results
- **Real-world check:** the forecast map agrees with **independent ONS Claimant Count data (Sept 2026)** across 344 neighbourhoods at **Spearman ρ = 0.84**. 24 of the real top-50 hardest-hit areas are shared. Claimant data is never used in the model. To be upfront, the deprivation input alone scores ρ = 0.92. What Undertow adds is timing, causes, scenarios and targeting, which a static index can't give.
- **Held-out future backtest (6 weeks):** area error of **1.6 points vs 3.6** for both the deprivation-rank and last-period baselines. Area ranking ρ = 0.95 vs 0.89. Household AUC 0.98, Brier score 0.043, and calibration close to perfect.

---

## How we built the personal forecast (Headroom's engine)

The maths is **deterministic, pure TypeScript and auditable**. The same inputs always give the same forecast.

1. **Recurring detection** over 12 months of transactions finds wages, benefits, rent, direct debits, standing orders and weekly spending patterns, along with their cadence and typical amounts.
2. **UK calendar rules:**
   - Universal Credit assessment periods, the 55% taper, the work allowance, and paying early before weekends and bank holidays
   - Energy price cap changes each quarter
   - Council tax paid in 10 instalments, so February and March are free
   - April price rises
   - Annual repeats from last year
   - English bank holidays
3. **200 bootstrap paths:** each event's amount is drawn from that series' past amounts. Wages vary, UC is recomputed from each path's wages, and everyday spending drifts a little so the band widens over time. We take the P20, P50 and P80 of the balance for each day.
4. **Shortfall detection** merges short runs separated by brief recoveries (when a wage lifts the balance for one day) into a single stretch, then names the causes by ablation.
5. **Action ranking:** each option is simulated against the same engine, and the pound gain is measured at the shortfall date.

---

## Every AI feature

| Feature | Where | How |
|---|---|---|
| **Plain-English "Why" explanation** | Headroom | Claude gets a `Facts` object with every number already worked out and returns structured text. It writes words around numbers it is given and never does arithmetic. |
| **Number check (anti-hallucination)** | Headroom + Undertow | Every pound amount, percentage and date in the AI's output is checked against the facts. If one isn't there, the output is rejected, Claude retries, and a template is used if it fails again. Unsafe words ("loan", "borrow", "credit card", "advance") are banned too, so the coach can never push someone into debt. |
| **Tool-using chat coach** | Headroom | Claude with tools: `get_forecast`, `simulate_scenario`, `list_actions`, `accept_actions` and `request_human_help`, with up to 4 tool rounds. "What if" questions become zod-validated scenarios (hours, one-off costs, cancelled payments, energy changes) that re-run the real engine. A deterministic fallback answers common questions if the API is down. |
| **ElevenLabs voice coach** | Headroom | An ElevenLabs Conversational AI agent started with a signed URL. It opens with a forecast summary built by the engine (`{{insights}}`) and calls the **same five tools** as client tools, so spoken answers use the same verified numbers. |
| **Multilingual AI** | Headroom | Claude explains and replies in English, Urdu or Polish. Money and dates keep one format so the number check still works. |
| **AI area briefings** | Undertow | Claude, with forced tool output, writes a briefing for each neighbourhood for councils and food banks from privacy-protected area totals only. Every number is checked. |
| **ElevenLabs spoken briefings** | Undertow | Briefings are read aloud with the `eleven_multilingual_v2` text-to-speech model in a calm British voice. |
| **Policy announcement → scenario** | Undertow | Claude reads a pasted policy announcement and extracts a validated scenario (energy, rent, UC, sector hours) with a forced tool call. The scenario runs on the map. |
| **Automation with n8n + Twilio** | Headroom | n8n workflows `plan-created` and `payday-reminder` (a Friday 09:00 schedule plus a "send now" webhook) send WhatsApp messages through Twilio and report back to the activity feed. Requests are protected by shared secrets. If n8n doesn't reply within 5 seconds, the server sends through Twilio directly. n8n never writes the message: our server builds it from engine numbers. |

**Our AI rule:** *deterministic engines do the maths; AI does the language, the tool use and the voice.* An AI never invents a number shown to a customer or a council.

---

## How it shows financial resilience

Financial resilience means being able to absorb a shock without falling into crisis. Headroom and Undertow build it at three levels:

- **Anticipate.** People are warned weeks before a shortfall, not after an overdraft charge. Our scrubber and Undertow's slider both let you travel forward in time and see what's coming.
- **Understand.** Every warning names its causes and shows how it was worked out. People learn their own patterns: "this happened in October and last January, and here's why."
- **Act.** The plan turns warnings into concrete steps with pound values: claim what you're owed (part of the £24.1bn that goes unclaimed), change when you pay, build a small buffer on the extra payday, or talk to a person. Aisha's January goes from about −£140 to about +£70, and her headroom grows by about £65 a month afterwards. Reminders keep the plan going after she closes the app.
- **Communities.** Undertow lets councils, food banks and NatWest's vulnerability team plan support before demand peaks. It also stress-tests policy changes and spends crisis funds where they keep the most households out of shortfall (2.3× better than deprivation targeting).
- **Inclusion by design.** It works in three languages, by voice and over WhatsApp, at a low reading age, for the people who are usually warned last.
- **Support only.** Forecasts are used for support only, never for credit, pricing or enforcement. That rule is in the AI prompts and stated on every page.

---

## Challenges we ran into
- **Stopping the AI from inventing numbers.** We built the number checker, banned-word filter, retry and template fallback.
- **Getting Universal Credit timing exactly right.** Five-payday assessment periods, wages moved early by bank holidays, and UC paid early before New Year all had to line up.
- **Unbiased privacy noise.** Our first version inflated small areas until we added shrinkage.
- **A fair allocator comparison.** We restricted it to decisions made at area level only.
- **Demo resilience.** Fallbacks for n8n, Twilio, Claude and ElevenLabs keep every step working offline.

## Accomplishments we're proud of
- A forecast that matches real ONS claimant data (ρ = 0.84) without ever seeing it.
- Personal and community forecasts linked through a privacy-safe bridge.
- A voice coach and a typed coach that share one set of tools, so every number they say comes from the engine.

## What we learned
Most financial shocks aren't surprises. They're on the calendar. The hard part is explaining them clearly and kindly, and pairing every warning with a fix.

## What's next
- Run on real transactions inside the bank (NatWest already holds this data and already aggregates other banks' accounts).
- Hindcast the 2022 energy crisis against ONS, DWP and Citizens Advice data.
- Send n8n alerts to councils and food banks when an area's forecast rises.
- Voice outreach to opted-in customers in their own language.
- Integrate a benefits calculator (e.g. Inbest, which NatWest has already piloted).
- A multi-bank data trust.

## Real vs synthetic
- **Real:** ONS boundaries, deprivation scores, population, Universal Credit rules, bank holidays, the energy cap schedule, ONS claimant data (used only for validation).
- **Synthetic:** household finances, Aisha's transactions, who banks with NatWest, and the held-out future used for the backtest.

## Built with
`typescript` `next.js` `react` `tailwind` `recharts` `date-fns` `zod` `vitest` `anthropic-claude` `elevenlabs` `n8n` `twilio` `whatsapp` `supabase` `vercel` `python` `numpy` `pandas` `geopandas` `streamlit` `pydeck` `plotly` `pytest`
