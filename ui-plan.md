# Headroom UI plan: editorial control desk, laptop demo

> The visual layer for Headroom. A dark, editorial, laptop-first treatment of the app we have already built. Same screens, same data, same copy; new skin and a wide layout so the whole forecast story fits on one laptop screen.

This plan sits alongside `plan.md`. `plan.md` stays the source of truth for product, numbers, copy and ethics. This file replaces the palette, type, phone frame and layout rules in `plan.md` section 19. Everything here is a change to existing components in `headroom/src`; nothing here adds a feature.

**Two decisions this plan makes:**

1. **We demo on a laptop, not a phone.** At 1024 px and wider, `/app` renders in a full-width desktop shell (top navigation, two-column layouts). The 390 x 844 phone frame goes. Below 1024 px the current mobile layout (full screen, bottom tabs) stays exactly as it is, as a fallback, not a demo target.
2. **Dark editorial theme for the customer app.** This reverses the "light, calm" line in `plan.md` section 19. Calm now comes from restraint (one lime action, no glow, no idle motion), not from a light background. If the team prefers light, keep sections 2, 4, 5 and 8 (layout, screens, motion, build order) and skip the palette swap.

---

## 1. What the judges see

The judge sits in front of a laptop. The wordmark sits at the top left, with four quiet nav links next to it. A huge off-white figure says "Lowest point: about −£140", with the date small underneath. The 90-day chart spans two-thirds of the width. The day card sits right next to it, so dragging the scrubber updates the explanation without any scrolling. One lime button, "See what you can do", is the only bright thing on the screen.

On the Plan screen the options are on the left. The before/after chart and the "−£140 → +£70" readout stay pinned on the right. Each toggle visibly lifts the lime line while the judge watches. "Set this up" is the one lime action. A phone propped next to the laptop buzzes with the WhatsApp message.

### Home at 1280-1536 px wide (example values from the seed; the UI always shows engine output)

```text
  Headroom    Home   Plan   Ask   Settings                  [Example data: Aisha Rahman]
  ---------------------------------------------------------------------------------------
  Hi Aisha   01 / Your next 90 days                            SAT 7 NOV -> FRI 5 FEB

  Lowest point: about −£140                                   [Comfortable today: £270]
  Mon 1 Feb

  ---------------------------------------------------------------------------------------
  02 / Day by day                                     |  03 / Thu 31 Dec
  +-----------------------------------------------+   |  Universal Credit lands early
  |  P50 line, range band, dashed zero line,      |   |  because 2 Jan is a Saturday:
  |  short stretch tinted, selected-day marker    |   |  about £799, £154 less than usual.
  +-----------------------------------------------+   |  Projected after today: about £1,100
  [=====================O========================]    |  ------------------------------
  today        1 Dec        1 Jan        1 Feb        |  04 / Coming up
                                                      |  You're likely to be short from
                                                      |  Mon 25 Jan to Mon 1 Feb, by about £140.
                                                      |  [Why]   [See what you can do ->]
  ---------------------------------------------------------------------------------------
  05 / Week by week
  [Comfortable 9 Nov] [Comfortable 16 Nov] [Tight 23 Nov] [Comfortable 30 Nov] ... [Short 25 Jan]
  ---------------------------------------------------------------------------------------
  Figures are estimates from your transactions and public rules. Words are written with AI. ...
```

### Plan at the same width

```text
  01 / What you can do                                 |  02 / With your plan        (sticky)
  Lowest point: −£140 -> +£70 with the ticked options  |  Lowest point
                                                       |  −£140 -> +£70
  [on ] Put £150 aside on Fri 11 Dec    +£150 by Feb   |  +-------------------------------+
        You qualify . 1 min                  Steps v   |  | before: dashed grey           |
  [on ] Broadband social tariff         +£17 a month   |  | with plan: lime, lifts on     |
  [on ] Free school meals               ...            |  | each toggle (300 ms)          |
  [off] 12 council tax instalments      ...            |  +-------------------------------+
  -----------------------------------------------      |  [ Set this up -> ]   <- only lime
  Talk to someone (quiet card, three contacts)         |
```

---

## 2. Demo setup: one laptop, one phone for WhatsApp

This replaces the device table in `plan.md` section 5.3.

| Device | Shows | Owner |
|---|---|---|
| Laptop 1 (demo) | Window 1: `/app`, browser full screen (F11). Window 2: `/behind` (reset, send reminder now, engine view). Switch with Alt+Tab. | A |
| Phone (WhatsApp only) | Joined to the Twilio sandbox, propped beside the laptop, screen timeout set long, other notifications silenced | D |
| Laptop 2 | Backup video in a tab; hotspot | B |

**Laptop setup checklist (do it once, check before each judge):**

- Chrome or Edge, browser zoom 100%. Note the Windows display scaling: a 1920 x 1080 screen at 125% gives a 1536 x 864 CSS viewport, and at 150% gives 1280 x 720. The layout must work at both (section 9).
- Plug in a USB mouse. Judges drag the scrubber more easily with a mouse than a trackpad. Keyboard also works: Tab to the scrubber, then use the arrow keys.
- Charger in, sleep off, Windows notifications off (Focus assist / Do not disturb), editor and terminals hidden, only the two demo windows open.
- `/api/health` green, reset done, scrubber on today, no plan toggles on.
- If a projector is used for the pitch, check the dark UI on the actual projector early. If it washes out, use 110% browser zoom; the layout must hold at 110%.
- The backup video recorded at 15:45 shows the old phone frame. Re-record it only if this restyle lands. The old one is still a valid backup.

**Pitch wording:** say "This is her Headroom," not "this is the app on her phone". If asked: it is a responsive web app; the same screens work at phone width, and WhatsApp reaches her when she is not in the app.

---

## 3. Visual system

### 3.1 Tokens: same names, new values

Customer components already use token classes (`bg-canvas`, `bg-card`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `bg-accentSoft`, `text-comfortable`, `text-tight`, `text-short`). Keep every name and change the values in the `@theme` block of `headroom/src/app/globals.css`, so most of the app re-skins from one edit. Add three new tokens.

| Token | Old | New | Use |
|---|---|---|---|
| `canvas` | `#FBF8F3` | `#10110F` | Page background |
| `card` | `#FFFFFF` | `#191B17` | Cards, header, day card |
| `raised` (new) | | `#22251E` | Selected rows, open accordions, chat bubbles from Headroom |
| `ink` | `#1B1F1D` | `#F1F2EB` | Headings, body, money |
| `muted` | `#5B625E` | `#B2B8A7` | Secondary text, axis labels |
| `line` | `#E6E1D8` | `#34382E` | Decorative dividers and card borders only |
| `lineStrong` (new) | | `#747C69` | Input and switch boundaries, zero line, anything a user must see |
| `accent` | `#0F6E5C` | `#D5F267` | Primary button, scrubber thumb, active nav, focus ring, "with plan" line |
| `accentInk` (new) | | `#171C0B` | Text and icons on lime |
| `accentSoft` | `#DCEFE9` | `rgba(213,242,103,0.14)` | Selected chips, selected week card |
| `comfortable` | `#2E7D4F` | `#9DD6AC` | Status |
| `tight` | `#9A6700` | `#F0C078` | Status |
| `short` | `#B3261E` | `#F1948A` | Status, warning card accent, short stretch tint |
| `band` | `rgba(15,110,92,0.14)` | `rgba(241,242,235,0.10)` | Chart range fill (neutral, so lime stays punctuation) |
| `zero` | `#8A8F8C` | `#747C69` | Dashed zero line |

Also change `themeColor` in `src/app/layout.tsx` to `#10110F`.

**Contrast, computed for these values:**

| Foreground | on canvas | on card | on raised |
|---|---|---|---|
| ink | 16.8:1 | 15.4:1 | 13.8:1 |
| muted | 9.3:1 | 8.5:1 | 7.6:1 |
| accent (lime) | 15.1:1 | 13.8:1 | 12.4:1 |
| comfortable | 11.4:1 | 10.5:1 | 9.4:1 |
| tight | 11.3:1 | 10.3:1 | 9.3:1 |
| short | 8.4:1 | 7.7:1 | 6.9:1 |
| lineStrong (boundaries) | 4.4:1 | 4.0:1 | 3.6:1 |
| `line` | 1.6:1 | decorative only, never the only boundary of a control | |

`accentInk` on lime: 13.9:1. Everything passes WCAG AA, and the boundaries pass 3:1.

**Lime discipline.** Lime appears in at most these places on any one screen: one primary button, the active nav indicator, the scrubber thumb or selected-day marker, the "with plan" line on Plan, and the focus ring. Links and quiet buttons that currently use `text-accent` should switch to `text-ink` with an underline, so lime isn't scattered everywhere. Status never relies on colour alone: the existing `Sun` / `CloudSun` / `CloudRain` icons and the Comfortable / Tight / Short words stay.

### 3.2 Hard-coded colours to fix (the token swap will not catch these)

| File | What | Change to |
|---|---|---|
| `components/ui.tsx` | `buttonClass.primary`: `text-white`, `hover:bg-[#0B5A4B]`, `disabled:bg-[#7FA89F]`; chip `accent` tone at line 119: `text-[#0B5A4B]` (dark green, unreadable on dark) | `text-accentInk`, `hover:bg-[#C6E655]`, `disabled:bg-raised disabled:text-muted`; secondary becomes `border-lineStrong text-ink hover:bg-raised`; accent chip text becomes `text-accent` |
| `components/Chart90.tsx` | `COLORS` object (lines 12-21) and `#E6E1D8` grid at line 209 | `accent #D5F267`, `band rgba(241,242,235,0.10)`, `zero #747C69`, `ink #F1F2EB`, `muted #B2B8A7`, `short #F1948A`, `card #191B17`, `compare #747C69`, grid `#34382E`. Main line: `ink` when there is no `compareDays`, `accent` when there is (so lime means "with your plan"). |
| `components/CoachChat.tsx` | `text-white` at lines 109 and 186; `rgba(15,110,92,0.2)` at 165 | `text-accentInk` on lime; focus or tint uses `accentSoft` |
| `components/Scrubber.tsx` | thumb shadow `rgba(0,0,0,0.25)` | Keep; add a 2 px `canvas` ring around the lime thumb so the focus ring has a gap |
| `components/PhoneFrame.tsx` | `#EDE7DC`, light shadows | Replaced by `AppShell` at 1024 px and wider (section 5) |
| `components/ActivityRail.tsx`, `HistoryChart.tsx`, `app/behind/page.tsx` | Own dark hexes (`#9BA7A1`, `#E8ECE9`, `#5FD3B5`, `#141C19`, ...) | Optional: map to the tokens above so `/behind` and `/app` look like one product. Low priority. |

### 3.3 Typography

| Role | Font | Notes |
|---|---|---|
| Display, titles, headroom figure | **Space Grotesk** 500/600 | Point the existing `--font-serif` variable at it, so `font-serif` classes change without touching components |
| Body and UI | **Space Grotesk** 400/500 | Point `--font-sans` at it |
| Numbered labels, date range, timestamps | **IBM Plex Mono** 400/500 | New `--font-mono` |

- Load both with `next/font/google` in `src/app/layout.tsx`, replacing `Source_Serif_4` and `Inter`. Load only these weights, with `display: "swap"`.
- Fallback stack: `"Segoe UI", system-ui, sans-serif`. Space Grotesk has no Urdu glyphs, so the Urdu language option falls back to Segoe UI. That's fine, but check that it renders.
- Money: `tabular-nums` stays on everything (the `.money` class). Check that tabular figures render in Space Grotesk at the figure size; if they don't, set money in Plex Mono.
- Sizes on a laptop:
  - Headroom figure: `clamp(44px, 5vw, 80px)`, line height 1.0, tracking -0.035em.
  - Screen titles: 32-40 px. Card titles: 20 px.
  - Body: **17 px minimum**. This is `plan.md`'s rule for this audience and overrides the generic kit's 15-16 px.
  - Numbered labels: 13 px Plex Mono, `muted`, tracking 0.04em.
- The large-text setting keeps scaling the root to 112.5%.

### 3.4 Geometry and layout

- Breakpoint: **1024 px**. At 1024 px and wider, use the desktop shell. Below it, use the current mobile layout unchanged.
- Desktop content: max-width 1280 px, centred, 40 px side padding, 12-column grid, 24 px gaps. At 1920 px, centre the content; don't stretch it.
- Radii: controls 8 px, cards 12 px (down from the current 20 px), chips and status pills stay round.
- 44 px minimum targets everywhere, including icon buttons and week cards.
- Thin `line` dividers between sections, solid surfaces, no backdrop blur. Remove `backdrop-blur` from the sticky Plan footer when it becomes the right-hand panel.
- No grain texture, no gradients, no glow.

---

## 4. Screens at 1024 px and wider

Numbered labels are the number plus the **existing translated section title**, for example `02 / {t("home.chartTitle")}`. They need no new copy and switch language automatically. They are decoration: never put instructions in them.

| Screen | Left (main) | Right (supporting) | Notes |
|---|---|---|---|
| **Home** `/app` | Cols 1-8: greeting, headroom figure, then `Chart90` (about 320 px tall) with `Scrubber` aligned under the plot area | Cols 9-12: today status chip at the top; `DayCard` sticky under it, then `WarningCard` | At 1280 x 720, the figure, chart, scrubber and day card are visible without scrolling. This is the time-travel demo beat. `WeekStrip` runs full width below. Keep its horizontal scroll; a 13-column grid is optional (Tier 3). |
| **Why** `/app/why` | Cols 1-7: headline at title size, bullets, two paragraphs, "Best next step" chip | Cols 8-12: `HowWeWorkedItOut`, first item open | "See what you can do" stays the lime action. |
| **Plan** `/app/plan` | Cols 1-7: the `ActionCard` list in rank order, then the quiet "Talk to someone" card | Cols 8-12, `position: sticky; top: 88px`: "Lowest point −£140 → +£70" readout, compact `Chart90` with before/after (240 px), "Set this up" | Replaces the sticky bottom bar at desktop widths. The toggle and the line lift are visible together: the money shot. |
| **Done** `/app/done` | Cols 1-7: "Done. Your plan is set.", what was scheduled, "Back to forecast" and "Ask a question" | Cols 8-12: `ActivityRail` | The phone with WhatsApp sits beside the laptop for this beat. |
| **Ask** `/app/ask` | Cols 1-8: `CoachChat` messages and input, max line length about 70 characters | Cols 9-12: suggested questions as a vertical list of buttons ("Try asking"), then the help contacts | Judges see the suggestions without hunting for them (`plan.md` 5.2). |
| **Settings** `/app/settings` | Single column, max-width 720 px | none | Content unchanged. |
| **`/behind`** | Layout unchanged | | Optional token alignment (3.2). It is now the second window, not the projector. |

Header (`AppShell`, 64 px, `card` background, bottom `line` border):

- Left: "Headroom" wordmark in Space Grotesk 600.
- Next to it: nav links Home, Plan, Ask, Settings, using the existing `tabs.*` i18n keys, `aria-current="page"`, and a 2 px lime underline on the active link.
- Right: a mono pill reading "Example data: Aisha Rahman". The demo uses synthetic data, and the screen should say so.

The skip link and the transparency footer move from `PhoneFrame` into `AppShell` unchanged.

Optional metadata line in mono (Home, top right): the forecast date range taken from `days[0]` and the last day in the response, for example "SAT 7 NOV → FRI 5 FEB". Only show values that come from the response or the clock. Never show invented counts.

---

## 5. Component changes

### Foundation

| Component | Change |
|---|---|
| `globals.css` | New token values and three new tokens (3.1), `--font-mono`, focus ring `outline: 2px solid var(--color-accent); outline-offset: 2px` |
| `ui.tsx` `buttonClass` | Lime primary with `accentInk` text, 8 px radius (`rounded-lg`); secondary with a `lineStrong` border; quiet becomes ink plus an underline. Keep `active:scale-[0.98]`. |
| `ui.tsx` `Card` | `rounded-xl`, `bg-card`, `border-line` (picked up from tokens; change only the radius) |
| `ui.tsx` `ScreenHeader` / `SectionTitle` | Optional `index` prop that renders the `01 /` mono label before the title. Desktop title size 32-40 px. |
| `StatusIcon`, `WeekStrip` | No logic change. On the selected week card, use `accentSoft` with a `lineStrong` border. |

### Layout

| Component | Change |
|---|---|
| `AppShell` (new; replaces `PhoneFrame` in `app/app/layout.tsx`) | Below 1024 px, render exactly what `PhoneFrame` renders now, minus the 390 x 844 frame styles. At 1024 px and wider, render the top header with nav, a page-scrolling `<main>` (no inner scroll container) and the footer. Keep the scroll-to-top on route change. Keep `BottomTabs` below 1024 px only. |
| Page files | Wrap the content of Home, Why, Plan, Done and Ask in a `lg:grid lg:grid-cols-12 lg:gap-6` container, as in section 4. On mobile the order stays as it is now. |

### Signature treatments (three, all already half-built)

| Treatment | Where | What to add |
|---|---|---|
| **Time travel**: scrubber, chart and day card side by side | Home | Layout only. The scrubber and day card update immediately, as now. The lime selected-day marker and a thin ink vertical line on the chart. |
| **Plan lift**: toggle, lime line lifts, readout changes | Plan | Lime "with plan" line over the dashed "before" line (existing `compareDays`). The "−£140 → +£70" value crossfades in 220 ms and moves up to 8 px. |
| **Activity rail**: plan saved, then sent by WhatsApp | Done, `/behind` | Existing polling. New rows fade and rise 6 px in 180 ms. A thin connecting line between rows, with mono timestamps. |

**Cut:** shared-layout `ExpandableSurface`, command palette, pointer spotlight, grain texture, Radix, Motion for React. **No new npm dependencies after MVP freeze.** Everything here is Tailwind and CSS transitions over the existing Recharts animation.

---

## 6. Motion

One curve everywhere: `ease-calm` = `cubic-bezier(0.22, 1, 0.36, 1)` (already in `globals.css`).

| Interaction | Treatment | Timing |
|---|---|---|
| First load of Home | Figure fades and rises 10 px; the chart line and band draw once (existing); the right column follows | 360 ms per item, 50 ms stagger, chart 600 ms; first load only |
| Scrubber drag, week card click | **Immediate**: no animation on the day card, marker or text (`plan.md` 19) | 0 ms |
| Plan toggle | Switch thumb slides; the Recharts line morphs (existing); the readout crossfades | 160 ms / 300 ms / 220 ms |
| Nav link change | The lime underline appears on the new link (static is fine; a sliding underline only if it takes under 15 minutes) | 200 ms |
| Primary button | Background shifts on hover, 0.98 scale on press, arrow moves 3 px on hover | 120-160 ms |
| Action card expand ("Steps") | Height via `grid-template-rows: 0fr → 1fr`, content fades | 220 ms |
| New activity row | Fades and rises 6 px | 180 ms |
| Coach reply | Fades in. No typewriter effect, no fake "thinking" delay. | 160 ms |
| Warning card | **No motion.** No pulse, no shake, no glow. | none |

Reduced motion: already handled. The global rule in `globals.css` zeroes transition and animation durations, and `Chart90` turns its animation off under `prefers-reduced-motion`. New CSS transitions get this for free. No idle motion when nothing has changed.

---

## 7. Content and tone

- The `plan.md` section 21 copy deck wins over anything in this file. No new customer-facing strings except "Example data: Aisha Rahman" (add an i18n key).
- Every pound figure and date comes from the forecast engine. The mockups in this file are illustrations, not values to hard-code.
- No "unlock", "revolutionise", "seamless", or "AI-powered" on customer screens. The transparency footer stays on every screen.
- The editorial scale is used once per screen: the headroom figure on Home and the readout on Plan. Everything else stays modest.

---

## 8. Interaction quality (kept from the generic kit, tailored)

- Visible 2 px lime focus ring with an offset on every control. The skip link stays.
- Tab order on the desktop: nav, then main content in reading order (left column, then right column). The sticky Plan panel comes after the action list in the DOM.
- Scrubber: native `<input type="range">`. Arrow keys move one day; `aria-valuetext` stays the day headline.
- Plan toggles: Space toggles; "Set this up" disables while pending and shows "Setting up..."; failure shows the existing error beside the button and never looks like success.
- The language switch (Urdu RTL) still works in the desktop shell: the grid columns mirror under `dir="rtl"`.
- At the large text setting (112.5%) and at 1280 x 720, nothing overlaps.

---

## 9. Build order (against the `plan.md` timeline)

Work on a branch, `ui-desk`. Merge to `main` only when Tier 1 passes the checks below. If it isn't green by **16:40**, drop the branch and demo the current app on the laptop. Two people work in parallel without touching the same files:

| Tier | Owner | Files | Done when |
|---|---|---|---|
| **1a. Theme** (about 25 min) | A or whoever is free | `globals.css`, `app/layout.tsx` (fonts, `themeColor`), `ui.tsx` button classes, `Chart90` `COLORS`, `CoachChat` and `Scrubber` hex fixes | Every `/app` screen is dark, readable and lime-disciplined at phone and laptop widths |
| **1b. Desktop shell** (about 25 min) | the other person | New `AppShell`, `app/app/layout.tsx`, Home two-column | At 1536 x 864 and 1280 x 720 the Home demo beat needs no scrolling; mobile is unchanged |
| **2. Plan and Done layouts** (about 20 min) | 1b owner | `plan/page.tsx`, `done/page.tsx` | The toggles and the lifting line are visible together; the activity rail is beside the confirmation |
| **3. If time remains** | anyone | Ask side rail, Why two-column, numbered labels, mono date range, week grid, `/behind` tokens | Each item is optional; ship each separately |

Rules: no new dependencies. Commit after each tier. The presenter stops coding at 17:00 and rehearses on whatever is merged.

**Cut first:** week grid, `/behind` tokens, sliding nav underline, readout crossfade, numbered labels.
**Never cut:** readable contrast, focus rings, the no-scroll Home beat at 1280 x 720, the Plan side panel, a working phone-width fallback.

---

## 10. Acceptance checks on the demo laptop

**Walkthrough (matches `plan.md` section 25):**

1. Home: the judge spots "Lowest point" and the lime "See what you can do" within three seconds.
2. Drag to 31 Dec, then to 28 Jan. The day card updates beside the chart, with no scrolling.
3. Why: explanation on the left, "How we worked this out" on the right.
4. Plan: toggle three options. The lime line lifts and the readout reads −£140 → +£70, with no scrolling.
5. Set this up: Done shows the activity rail; the phone beside the laptop buzzes.
6. Ask: the judge clicks a suggestion in the right rail and gets a checked reply.
7. Alt+Tab to `/behind`, reset, Alt+Tab back: Home on today.

**Definition of done:**

- [ ] 1536 x 864 and 1280 x 720 CSS viewports: steps 2 and 4 need no scrolling.
- [ ] 1920 x 1080 at 100%: content is centred at 1280 px and not stretched.
- [ ] 1024 px wide: no horizontal page scroll. 390 px wide: the old mobile layout still works.
- [ ] Browser zoom 110% and the large text setting: no overlap.
- [ ] The whole walkthrough works with keyboard alone (Tab, arrows, Space, Enter).
- [ ] Focus is always visible against the dark canvas, including on the lime thumb.
- [ ] Reduced motion: every state is still clear; the chart does not animate.
- [ ] Loading, error ("We couldn't load your forecast..."), empty activity and plan failure each look distinct.
- [ ] Rapid toggling on Plan leaves no stale readout; rapid nav clicks leave no stuck state.
- [ ] No hard-coded pound figure or date anywhere in the UI code.
- [ ] Projector, if used: legible from the back of the room, or 110% zoom set.
