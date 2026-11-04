# Implement: `/accuracy` reframe — from replay scoreboard to the evidence for Trust

You are working in `earth's-hidden-signals`, a NASA Space Apps 2026 entry. Read this whole file
before writing code. Then read `AGENTS.md`, the project `CLAUDE.md`, and
`.kilo/plans/IMPLEMENT-signals-trust-axis.md` (still in force; this file does not repeal it).

This plan is scoped to **one file**: `web/src/app/accuracy/page.tsx`, plus a description-string
fix. It does not authorise data regeneration or new pages.

## Why — the diagnosis (measured 2026-11-04, not opinion)

The judge beat is `Home → /signals → one district → the five strips → /accuracy → /about`. The
district page ends on `Trust: Blind spot`. So `/accuracy`'s one job is to **explain that label and
say how many places carry it.** It currently does not. Seven problems, all observed in the code and
the committed data:

1. **The headline numbers belong to a different system.** The big **100%** and **96%** come from
   `analysis/evaluation_baseline.json` — the `analysis/` **hazard-alert** backtest. The page's own
   fine print (`accuracy/page.tsx:165-167`) admits it: *"It measures the earlier hazard alerts on
   the backtest, not the rain signal replayed below."* On a page about the IMERG rain signal they
   read as *"the rain signal is 100% wrong."* Nobody reads the fine print.

2. **This feature's own measurement is empty and looks broken.** The section titled *"Does the
   signal rise before real floods?"* renders `Caught —`, `Missed —`, `Satellite-confirmed —` and
   *"Not enough events yet."* From `accuracy.json`: `measuredEvents: 0`, `hits: null`,
   `misses: null`, `notEnough: true`, and all three events are `status: "pending-real-data"`.

3. **The replay set does not test the covered area.** 2 of the 3 events carry
   `inCoverage: false` (Tanzania `-15.38,35.122`, Brazil `-20.135,-44.173`). See
   `scripts/signals/replay.py:19-23` — only `gdacs-4215` sits in a tile.

4. **The real, computed finding is buried in section 4 of 5.** Trust: **171 detectable, 251
   blind-spot, 0 no-data, of 422 areas** (from `places.json`). That is the project's thesis
   — *"we show you where the signal can be trusted"* — placed below two weaker sections.

5. **The events are anonymous coordinates.** The list shows `7.91, 80.98 · GDACS 4215`. A judge
   cannot tell that is Sri Lanka.

6. **No verdict.** The page enumerates limitations and dead-ends. It never states its conclusion,
   so it converts no scepticism into trust.

7. **The description overclaims.** `accuracy/page.tsx:31-32` promises *"how often it rose before a
   verified flood (misses included)"* when the measured incidence is zero. Also, unlike the other
   five pages, it ends on a paraphrase ("never a live warning") instead of the mandated line.

**The reframe in one line.** Make `/accuracy` the page that argues *why Trust is the honest
answer*, using the 100%/96% as the **reason**, not as this feature's scorecard.

## Non-negotiables — carried from the trust-axis plan, do not paraphrase

- Never the word "safe". Green sentence verbatim: `No unusual signal in our data. Always follow official warnings.`
- Confidence is `Low` / `Medium` / `High` only. **Never percentages.** (The 100%/96% below are
  measured backtest rates, not confidence — see step 3 for how to label them so they stay distinct.)
- Status is icon **plus word**, never colour alone. Grey = no data, never safety.
- The words **"false alarm" are forbidden in user-facing copy.** Label the baseline number
  *"Flood alerts with no flood in the backtest"* — the existing wording; keep it.
- Below 3 measured reporting events show `Not enough events yet.` **Never fabricate numbers.**
- Unmatched replay outcomes keep the verbatim string from `accuracy.json.unmatchedText`:
  `Signals with no catalogued event (upper bound; flood catalogues are incomplete).`
- Sample data is always labelled `SAMPLE DATA` and never mixed with real.
- Every page carries: source, time, data age, WMO link, and `Not a forecast or an official warning.`
- Never "danger alert" for floods. Rain is an input, not a flood forecast.

## Decisions this plan makes — read before building

| Decision | Why |
|---|---|
| **Trust leads the page.** The 100%/96% move to a clearly-labelled "how we got here" section below it | The computed, in-scope finding is the Trust split; it is currently section 4 of 5 |
| **The 100%/96% are relabelled as the origin story of Trust**, with an explicit "this is the analysis pipeline's hazard-alert backtest, not this feature's score" | They currently read as this feature's accuracy (issue 1) |
| **The empty replay section is kept but demoted and shown as a gap**, with the mechanism visible | It is honest evidence and the plan's own honesty beat; it just must not be the lede |
| **No new statistic and no data regeneration** | Guardrail: "your numbers, not new ones." This is a re-presentation of committed JSON |
| **The description stops promising a measured rate** and gains the verbatim disclaimer | Issue 7; page contract |

### New decisions that need the user's sign-off (do NOT build without a yes)

These contradict `IMPLEMENT-signals-trust-axis.md`'s "Deliberately NOT in this plan" table. Surface
them, then wait:

- **Naming the replayed events** (place / country). The trust-axis plan explicitly excluded
  `/accuracy` naming *"which disaster, which country."* Naming them makes the page far more
  legible to a judge, so it is worth doing — but it is a reversal, not a gap-fill. See step 5.
- **Changing the replay set** to in-tile events. `replay.py` is a pipeline file with a
  determinism/CI surface; this plan does not touch it. See step 6.

## The page contract (target order)

| # | Section | Shows | Source |
|---|---|---|---|
| 1 | **Trust: where the signal can be checked** | The computed split of covered areas: detectable / blind-spot / no-history, with counts | `places.json` |
| 2 | **Why Trust and not a forecast** | The 100% / 96% backtest as the reason the project measures instead of warns | `analysis/evaluation_baseline.json` |
| 3 | **The honest gap: the signal has not been measured against floods yet** | "0 of 3 events replayed", mechanism, `Not enough events yet.`, the verbatim unmatched string | `accuracy.json` |
| 4 | **The replay set** | The 3 events, their outcome, and which fall outside coverage | `accuracy.json` |
| 5 | **Leads we do not measure yet** | 48-hour, urban, landslides, freshness | `config.json` |
| 6 | **How the counts are made** | hit/miss definitions | `accuracy.json` |
| 7 | **Footer** | source, time, age, WMO link, verbatim disclaimer | `meta.json`, `config.json` |

## Build order — STOP after each step and report

Do these in order. Do not start step N+1 until step N produces real output.

1. **Preview check (do this first; it can change the reframe).**
   Run `npm run build` and read the generated `/accuracy` page in a browser at 360 px and 1280 px.
   Confirm the seven issues above as they render (not just as they read in source). If the
   rendered page contradicts the diagnosis, stop and report rather than building on it.

2. **Description fix — the smallest real change.**
   Replace `accuracy/page.tsx:31-32` with copy that describes the page's purpose without asserting
   a measured rate, and ends on the mandated line. Candidate:
   > *"Our rain signal tested against the flood catalogue, and the places that can be warned at all.
   > The replay is not built yet. Not a forecast or an official warning."*
   Confirm it stays true before **and** after the replay set grows.

3. **Reorder + relabel: Trust first, backtest second (the core of this plan).**
   - Move the current `#trust` section (lines 234-263) to the top, above the current `#finding`.
   - Give it a one-line verdict headline stating the split, e.g.
     *"171 of 422 covered areas can be checked against history. 251 cannot be separated from noise."*
   - Move the current `#finding` section below it and retitle it so it reads as the **origin of
     Trust**, not this feature's score. Add one sentence: *"We tried alerting on this data first.
     This is why we measure instead of warn."* Keep the existing 100% / 96% values — they are read
     from `evaluation_baseline.json` at build time, never retyped.
   - Keep the `falseAlarmRate` → "Flood alerts with no flood in the backtest" wording (no "false alarm").

4. **Demote the replay section and show the gap as a gap.**
   Keep the section, move it below the backtest, and lead it with the honest gap rather than the
   three empty counters. Keep `accuracy.notEnoughText` and `accuracy.unmatchedText` verbatim from
   `accuracy.json`. Do not invent a rate.

5. **Event legibility — REQUIRES SIGN-OFF (see above).**
   Two options; pick one only after the user answers:
   - **(a) Name them.** Add the place/country beside each event. This contradicts the trust-axis
     plan's exclusion, so it needs an explicit yes. If yes, prefer reading display names from the
     official GDACS record rather than hardcoding (the trust-axis plan's `replay.py:16-18` note).
   - **(b) Leave coordinates, add a mini-map.** `web/public/data/signals/places-map/{BGD,BTN,IND,NPL,PAK}.json`
     already hold boundaries; a small map plots the 3 events and makes "outside the covered tiles"
     visible without naming anything.
   If the user does not answer, do nothing here and report the section as unbuilt.

6. **Replay-set coverage — REPORT, DO NOT CHANGE.**
   State plainly that 2 of 3 events fall outside the covered tiles (issue 3). Changing
   `scripts/signals/replay.py` is a pipeline change with a CI determinism surface — out of scope
   here. Report it as a follow-up.

7. **Footer provenance.**
   `/accuracy` currently has the age label but **no WMO link and no `Not a forecast or an official
   warning.`** (both count 0 in the page). Add them, matching the `DataProvenance` pattern used by
   `/watch`, `/about`, `/signals/place`.

## Wording rules specific to this page

- The 100%/96% must sit under a heading that says they are the **analysis pipeline's hazard-alert
  backtest**, with the existing fine-print line kept: *"From analysis/evaluation_baseline.json. It
  measures the earlier hazard alerts on the backtest, not the rain signal replayed below."*
- Trust is never called accuracy, a probability, or a confidence percentage. Reuse the existing
  line: *"Trust is not a probability and not a confidence percentage. It answers one question: can
  the data here tell a change from noise?"*
- A replay outcome that is not built is neutral ("Not built yet"), never the Grey "no data".

## Technical constraints

- One file changes: `web/src/app/accuracy/page.tsx`. Server component; `revalidate = 86400`.
- **No new numbers.** Every figure read from committed JSON: `places.json` (Trust counts),
  `analysis/evaluation_baseline.json` (100%/96%, already read via `readBaseline()`),
  `accuracy.json` (replay), `config.json`, `meta.json`.
- i18n via `<T>` in `web/src/lib/i18n.tsx`; Bangla beside every English string. The Bangla for the
  new/relabelled copy must be written, not machine-stubbed.
- 360 px must work. Validate with `npm run lint` and `npm run build`.
- Server reads go through `lib/signals/data.ts`; it throws at build time on a missing key.
- Do **not** regenerate any data. Do **not** touch `scripts/signals/` beyond reading it.

## Known blockers — report, do not work around

- `scripts/signals/tests/test_guardrails.py` fails 3 of 6 because its hardcoded `BASELINE`
  (`93812d0`) predates the geography and intelligence work, and its `NAV_TABS` expectation is
  stale against the shipped nav. **Do not regenerate the baseline to make it pass.** The nav
  failure is the test being out of date, not the page.
- `analysis/evaluation_baseline.json` is regenerated by `evaluate.py --update-baseline`. If that
  runs before implementation, re-verify the 100%/96% rather than trusting this file's copy.
- PPS credentials come from the environment only — never write them to a file, log, commit or chat.

## Working agreement

- **Never commit, merge or push.** Make the edits, then stop.
- End every step with the question: `approve commit N?`
- Keep replies under 40 lines.
- If a step's premise turns out to be wrong, stop and report rather than building on it.
