# Implement: Signals trust axis (Before / Now / Next / Trust / Action)

You are working in `earth's-hidden-signals`, a NASA Space Apps 2026 entry. Read this whole file
before writing code. Then read `AGENTS.md` and the project `CLAUDE.md`.

## The thesis you are implementing

> We don't just show you the signal. We show you where the signal can be trusted.

Most flood maps show where water goes. This one shows where nobody is watching.

**Evidence you must not contradict.** `analysis/evaluation_baseline.json` currently records a flood
false-alarm rate of **1.0** and a missed-event rate of **0.958**. `web/public/data/signals/accuracy.json`
has **0 of 3** measured reporting events. These are the *finding*, not a bug to hide. Do not write copy
that claims the site warns people in time.

## User flow

```
Home → /signals (map + list) → search or "Use my location" → /signals/place
  → Before / Now / Next / Trust / Action → /signals/evidence → /watch → /accuracy → /about
```

Judge beat (2 minutes): Home → Signals → tap one district → the five strips → /accuracy → /about.

### The five strips (this is the product)

| Strip | Horizon | Question | Source |
|---|---|---|---|
| **Before** | 45 years | Has this place changed? | GISTEMP, GPCP |
| **Now** | today | Is it unusual for this date? | IMERG Late |
| **Next** | 7 days | What rain is coming? | Open-Meteo, or GEOS-FP |
| **Trust** | — | Can this place be warned at all? | Your Sen slope 95% CI |
| **Action** | — | What do I do? | Your text, EN + BN |

**Next is the only "prediction" this project ships.** It is rain, from an external model, walled off
from the signal. Never a flood probability, never a percentage, never in a status.

## Build order — STOP after each step and report

Do these in order. Do not start step N+1 until step N produces real output.

1. **Event count check (do this first, it can invalidate the design).**
   Query GDACS floods (`eventlist=FL`) across all years intersecting the three tiles in
   `scripts/signals/config.json`. Report how many events fall inside each tile. If the total is under
   ~30, stop and report — the Trust axis may collapse to a single colour and the plan needs revisiting.

2. **`/signals/place` on real data, ONE district end to end.** Pick one in-tile district with real
   IMERG. Five strips, real numbers, both languages. This is the milestone that matters. If time runs
   out later, this is what you keep.

3. **`/signals` map + trust badge.** Map view, ranked "Strongest signals now", search, "Use my
   location", status filters. District list gains the Trust badge.

4. **`/accuracy` reframe.** From replay scoreboard to the evidence for the Trust axis. Present the
   1.0 / 0.958 numbers as the measured finding. Keep the existing wording rules below.

5. **`/signals/evidence`.** Past years' rain, flood years marked, gaps shown honestly.

6. **`/watch`.** Real series: districts whose signal rose vs the previous archive entry.

If you fall behind, cut steps 5 and 6. Never cut step 2.

## Page contract

| Page | Shows |
|---|---|
| `/signals` | Map (green/yellow/red, grey = no data), ranked list, search, geolocation, filters |
| `/signals/place` | **Before** 45-year trend + sparkline · **Now** 1/3/7-day rain vs normal for this date · **Next** 7-day outlook, labelled external · **Trust** Detectable / Blind spot / No data · **Action** one line EN + BN. Plus WMO warning link and a share button. |
| `/signals/evidence` | Past years' rain, flood years marked, gaps visible |
| `/watch` | Rises vs previous archive entry, history vs now, labelled outlook |
| `/accuracy` | Hits, misses, "signals with no catalogued event", the measured limits |
| `/about` | Source catalogue with `checkedOn`, the "normal" definition, limits |

## Scope — read this before touching /signals

Real IMERG exists for **three tiles only** (`scripts/signals/config.json`). The geography layer covers
231 countries / 3,236 ADM1 / 49,193 ADM2. These are wildly different footprints and the plan must not
blur them.

| Layer | Coverage | How it renders outside coverage |
|---|---|---|
| Signal (Now) | 3 tiles | Grey, "No data" |
| Trust | 3 tiles | Grey, "No data" |
| Before (trend) | South Asia grids (60–100°E, 5–38°N) | Grey, "No data" |
| Geography (search, names, boundaries) | Global, 231 countries | Always listed — geography is not measurement |

**Do not imply global measurement coverage because the boundary list is global.** A country listed with
"No data" is correct output, not a bug. Compute and display coverage counts from the loaded data; never
hardcode them.

## The demo scores on /signals — decide this explicitly

`/signals` currently shows **DEMO / SIMULATED** scores generated as a SHA-256 of the area id
(`web/public/data/signals/demo-scores.json`, written by `analysis/build_signal_scores.py`). They are
not measurements.

| Where | Behaviour |
|---|---|
| Tiles with real data | Show the **real** signal + Trust badge. Do not mix demo and real in one row |
| Everywhere else | Keep the `SAMPLE DATA` label. Never let a demo score sit beside a real one unlabelled |
| The `SAMPLE DATA` banner | Must be visible on any view that renders a demo score |

If you cannot yet compute a real signal for a district, leave it demo-labelled. An honest demo beat is
better than a half-real row.

## Deliberately NOT in this plan — do not re-add without asking

These were considered and excluded for stated reasons. A fresh agent must not silently reintroduce them.

| Excluded | Why |
|---|---|
| Confidence **percentages** on `/signals` | Untested number. `Low`/`Medium`/`High` only |
| "Danger alert" / "flooding will happen" for Red | Rain is an input, not a flood forecast |
| `/watch` "learning a pattern" to predict | 0 of 3 measured events — nothing to learn from |
| `/accuracy` naming "which disaster, which country" | Its job here is evidence for the Trust axis |
| Flood probability of any kind | Contradicts `/accuracy`, which records false-alarm 1.0, missed 0.958 |

If the user asks for any of these later, treat it as a new decision and surface the contradiction with
`analysis/evaluation_baseline.json` before building.



- Never the word "safe". Green sentence verbatim: `No unusual signal in our data. Always follow official warnings.`
- Confidence is `Low` / `Medium` / `High` only. **Never percentages.**
- Status is icon **plus word**, never colour alone. Grey = no data, never safety.
- Unmatched replay outcomes: `Signals with no catalogued event (upper bound; flood catalogues are incomplete).` The words "false alarm" are forbidden in user-facing copy.
- Below 3 measured reporting events show `Not enough events yet.` Never fabricate numbers.
- Sample data is always labelled `SAMPLE DATA` and never mixed with real.
- Every page carries: source, time, data age, WMO link, and `Not a forecast or an official warning.`
- The 7-day outlook is labelled external and **never affects a status** (`usedInStatus: false` already
  holds in `scripts/signals/outlook.py`). It is rain, never flood risk. When the provider is
  unreachable, omit the strip and say so — never substitute or extrapolate.
- Never "danger alert" for floods. Rain is an input, not a flood forecast.

## Technical constraints

- **Your numbers, not new ones.** The Trust axis is derived from the existing Sen slope 95% CI in
  `analysis/stats.py`, aggregated per administrative area. Do not invent a new statistic.
- Reuse `web/public/data/geography/index.json` (231 countries, 3,236 ADM1, 49,193 ADM2) and the
  `geography/admin/{ISO}.json` files. Reuse `web/src/lib/geography/data.ts`.
- Server reads go through the `lib/*/data.ts` readers, which throw at build time on a missing key.
- i18n via `<T>` in `web/src/lib/i18n.tsx`; Bangla strings live beside their English.
- Explorer/filter state lives in URL query params. Leaflet is dynamically imported with SSR off.
- 360 px must work. Validate with `npm run lint` and `npm run build`.
- Do **not** build on `analysis/power.py` — it is rejected South Asia POWER rainfall, kept only for its land mask.
- Data pages set `revalidate = 86400`.

## Nav

Final order: `Home · Signals · Accuracy · Hazards · Trends · Watch · About`.
`/watch` and `/monitoring` keep their routes but have **no nav tab**. `/explore` is the "Watch" tab.
`/about` is the `/methods` page. `scripts/signals/tests/test_guardrails.py` has already been updated to
this nav — keep it passing.

## Known blockers — report, do not work around

- `scripts/signals/tests/test_guardrails.py` fails 2 of 6 because its hardcoded `BASELINE` (`93812d0`)
  predates the geography and intelligence work. **Do not regenerate the baseline to make it pass.**
  Report it.
- PPS credentials (`PPS_USERNAME`, `PPS_PASSWORD`, `EARTHDATA_TOKEN`) come from the environment only —
  never write them to a file, log, commit or chat. `scripts/signals/run.py --check-auth` probes them.

## Working agreement

- **Never commit, merge or push.** Make the edits, then stop.
- End every step with the question: `approve commit N?`
- Keep replies under 40 lines.
- If a step's premise turns out to be wrong, stop and report rather than building on it.
