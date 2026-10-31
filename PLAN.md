Climate Hazard Intelligence & Resilience System — Implementation Plan (rev. 2)
Repo: earths-hidden-signals — Next.js 16 + TS in web/, Python pipeline in analysis/, committed JSON in web/public/data/. This revision incorporates the reviewer's ten improvements and fixes errors found in rev. 1.

Product rule: no new pages or charts. Work goes into scientific correctness, the conclusion engine, honest evaluation, and reproducibility. Only three thin routes are added (/monitoring, /locations, /location/[id]); everything else extends existing screens.

0. Corrections to rev. 1 (what was wrong)
#	Rev. 1 said / implied	Mistake	Fix in this plan
1	Baseline "1991–2020 … 31 values"	1991–2020 is 30 years (inclusive). A 31-value baseline is a methodological error that changes percentiles.	BASELINE_YEARS = list(range(1991, 2021)); tests assert len == 30.
2	Classification mainly via z (	z	1 / 1.5 / 2)
3	Rainfall current = single monthly value	A single monthly total is fragile and does not answer "is this rain unusual?".	Composite rainfall assessment from monthly anomaly plus GPCP 1DD daily intensity, heavy-rain days, consecutive wet days, percentile and duration; one combined class with a stated dominant signal.
4	"Classification mirrored in the UI"	Duplicating thresholds in TS invites drift between pipeline and display.	Thresholds live only in analysis/thresholds.py; TS renders thresholdsId + the published /methods table.
5	Climate records described as current	GISTEMP/GPCP are monthly analyses published weeks-to-months later; treating them as "what is happening now" is scientifically dishonest.	Every surface shows observedAt, publication lag and ageDays; the conclusion explicitly says these are climate-scale observations, not weather.
6	Confidence as "score 0–4" band	Collapsing observation, anomaly, hazard and validation quality into one grade hides which link failed.	Four separate confidences with reason codes; no percentages.
7	Validation using "GPCP monthly vs GPCP 1DD" and calling CRU vs GISTEMP a full cross-check	GPCP monthly and GPCP 1DD share lineage, so their agreement is a consistency check, not independence. CRU vs GISTEMP share underlying station networks (GHCN) — agreement only checks processing, not raw data.	Explicit source-lineage table; nothing is labelled "independent" unless it is (see §5).
8	Heat hazard from monthly temperature anomaly	The 2° monthly GISTEMP anomaly cannot detect a heatwave.	Heat screening is renamed "Heat: monthly warmth vs baseline" and states that heatwaves are not assessed (no daily temperature record).
9	City pages as "regional estimate centred on region"	Several listed cities (Kathmandu, Pokhara, Thimphu, Kabul, Kandahar, Yangon, Mandalay, Lhasa) lie in no research region, and Hyderabad exists twice (India/Pakistan).	Fallback chain = containing region → containing country → study area, with an explicit label each time; Hyderabad IDs disambiguated.
10	Alert history computed from the same series	Back-filled alerts presented next to computed alerts risks reading as "alerts that were issued".	alerts.json separates computed (this run) from reconstructed (historical replay, labelled as such) — this is the backtest surface.
11	events.py FIRE_YEARS hard-codes 2003–2024	Recent-season fire context needs the latest season; it is currently capped.	Fire uses 2003..latest_available; per-year averages remain over the fixed 2003–2024 window for comparability.
12	New pages assumed fresh data at request time	Build-time static pages would freeze behind a Vercel deployment.	web/next.config.ts stays OS-independent and data pages get revalidate = 86400 so server builds refresh without a redeploy (mirrors /explore).
13	Data pages assumed statically rendered	Next 16 does not guarantee a fully static build for fs-reading pages; rev. 1 asserted "all static".	Plan states the actual requirement: pages must render with zero request-time dynamic APIs; verify with the build output manifest and check bundle size.
1. Decisions (user-confirmed)
Topic	Decision
Sourcing	Python pipeline computes everything; Next.js renders committed JSON. No API routes, DB or auth. Manual/optional CI refresh.
Cities	Fallback chain region → country → study area, labelled; no per-city grid claim.
Navigation	Spec nav (Home · Monitoring · Locations · Hazard Intelligence · Climate Trends · Resilience · Methodology); all existing routes remain reachable and unchanged in behaviour.
Forecast	Not integrated; rendered as an explicit gap with a documented contract.
Alerts & prefs	Pipeline-computed alerts with evidence; client-side subscribe intent only.
Freshness	asOf/retrievedAt/ageDays/stale per dataset; --refresh optional; never invent a month.
2. Scientific methodology (P0)
2.1 Baselines and periods (analysis/calendar.py)
BASELINE_YEARS = 1991..2020 (30 years). GPCP 1DD starts 1996-10, so daily-derived baselines use 1997–2020 (24 years) and carry baselineId: "1997-2020" plus a limitation string. GPCP monthly and GISTEMP cover the full window.
Comparison is same-calendar-period only: month vs that month across the baseline; season vs that season across the baseline.
Minimum sample: an anomaly is computed only if ≥ 20 baseline values exist for the calendar period and the current period has ≥ 1 valid value (monthly aggregates over the location's cells: ≥ 50% of weighted land cells non-null, otherwise available:false with reason).
Leap years, short months and partial latest months are handled by days_in_month; GPCP "mm/day monthly mean" is converted to a monthly total with value × days exactly once (rev. 1 risk of double conversion).
2.2 Classifier (analysis/anomalies.py, thresholds in analysis/thresholds.py)
Empirical percentile is the primary classifier for every variable (one rule set, so skewed rainfall and fire counts are treated correctly):

Class	Rule (relative to baseline, direction from sign of the anomaly)	Documented rationale
normal	10th ≤ P ≤ 90th and |z| < 1.0	Central 80% of the baseline distribution
below-normal / above-normal	P < 10 or P > 90, and |z| < 1.5	Outside the central 80%, but not far in standard deviations
unusually-low / unusually-high	(P < 5 or P > 95) or |z| ≥ 1.5	≈ 95% two-sided / 1.5σ
extreme	(P < 1 or P > 99) or |z| ≥ 2.0	≈ 99% two-sided / 2σ
zScore = (value − baselineMean) / baselineSD is reported as a supplementary field only. With 24–30 baseline values a percentile is discrete, so the UI always shows "P = 96th of 24 years (≈)". The /methods page publishes this table verbatim with the threshold id (class-v1), the baseline id and the sample counts.

2.3 Rainfall composite (spec item 2)
rainfall is not a single number. analysis/composite.py builds one assessment from these components, each with its own percentile and class:

Component	Source	Period
Monthly total vs 1991–2020 same-month baseline	GPCP v2.3 monthly	calendar month
Mean daily intensity (monthly total ÷ days)	GPCP monthly	calendar month
Heavy-rain days (wet day ≥ location's 95th percentile of rainy days, threshold fixed from the full record as in build.py)	GPCP 1DD (1°)	calendar month
Consecutive wet days (runs ≥ 1 mm) around the period	GPCP 1DD	calendar month
Dry days (< 1 mm) vs 1997–2020	GPCP 1DD	calendar month; Jun–Sep season
Duration of the unusual state	all of the above	consecutive months with same class sign
Combined class = highest component class that is supported by at least two components (a single outlier component cannot alone produce extreme); dominantComponent names which one set the level, and the conclusion text quotes that component's numbers. When components disagree (one high, one low), class is normal with conflicting: true and the disagreement is shown. Dependency note: GPCP 1DD is not currently cached locally (analysis/raw/gpcp_daily absent). Plan step B2 must run the downloader once (daily.fetch_year) with network; if that fails, the plan degrades gracefully: rainfall composite falls back to the two GPCP-monthly components and marks dailyComponents: unavailable with the reason on the page (no silent substitution).

2.4 Heat vs heatwaves (spec item 2 and #9)
Assessed: monthly mean surface-temperature anomaly vs same-month baseline (GISTEMP 2°), very-hot-months count, fire-season temperature.
Not assessed: heatwaves (no daily temperature data). /methods and the heat card state this limitation; the card is titled "Heat: monthly warmth" so nobody reads it as a heatwave forecast.
2.5 What each class means for harm
No classification implies a probability of disaster. Each hazard section carries a fixed sentence: "A screening indicator derived from observations; it is not a forecast, a probability, or an official warning."

3. Geography accuracy (P1)
Every location declares geography: {kind: "country"|"region"|"study-area", label, spatialResolution: {latDeg, lonDeg, approxKm}, cellsUsed, coveragePct, fallback: boolean, fallbackReason}.
Weighting: countries use build_country_signals.cell_weights (polygon ∩ cell × cos lat); regions use build.build.zone_weights (box overlap × land share × cos lat); the study area uses the same zone weighting. Validation requires Σw = 1 and coveragePct ≥ 50 (cells inside the polygon), else the indicator is unavailable.
Cities: geometry is the containing research region, else the containing country polygon, else study area; the label reads e.g. "Estimate for the Central Himalaya region (2° grid ≈ 220 km); not a measurement of Kathmandu." City confidence is capped one grade below the region's observation confidence.
Resolution truth table on /methods: GISTEMP 2°×2°, GPCP monthly 2.5°×2.5°, GPCP 1DD 1°×1°, CRU 0.5°, FIRMS 0.5° grid summary, GDACS point events, IBTrACS track points. Converted to km at the study latitude and labelled "grid average", never "measured at".
No region-specific local dataset is added in this iteration; the limitation is explicit per location instead.
4. Intelligence conclusion engine (P0) — the main product feature
analysis/conclude.py emits a structured Conclusion object (schema: "conclusion-v1"); web/src/lib/intelligence/conclude.ts only renders it (no recomputation, no thresholds in TS). Exactly seven required questions:

Question	Field	Example source
What is happening?	situation	"Monthly rainfall was 152 mm, 138% of the 1991–2020 June average."
Is it normal?	normality	class + percentile + baseline id
How unusual?	magnitude	percentile, difference, z (supplementary), rank
Is it worsening?	development	duration, consecutive-month sign, trend context (trend kept strictly separate from the current observation)
What could happen?	hazards[]	screening levels + dominant evidence (with "screening, not forecast")
How reliable?	reliability	the four confidences + the one weakest reason
What should I do?	actions[]	preparedness items, official-guidance-first
Fields: level (quiet|notable|elevated|high), headline (one sentence, ≤ 140 chars), situation, normality, magnitude, development, hazards, reliability, actions, observedThrough, dataAgeDays, evidenceIds[] (each pointing at a current.json indicator), thresholdsId. Both EN and BN strings are generated in the pipeline (BN equivalents added to analysis/ text tables so the language switch keeps working); TS falls back to EN if a BN field is missing. Template validation: unit test asserts every conclusion has all seven fields non-empty and every evidenceId resolves.

5. Validation (P1) — honest independence
analysis/validation.py writes per location and variable:

Check	Sources	Verdict semantics
Temperature consistency	GISTEMP (GISS stations + ERSSTv5 ocean) vs CRU TS 4.10 (station-based)	consistent only if signs agree and magnitudes are within the combined ±1σ of both anomaly estimates; both share GHCN-family stations → labelled "same input family; checks processing, not raw data"
Rainfall provenance	GPCP v2.3 monthly contains GPCP 1DD as an input	Labelled "consistency, not independence"; never counted as validation
Rainfall direction check	GPCP anomaly vs IMD/CWC-family or national met service values — not available offline → unavailable with the exact required source documented	No claim made
Hazard screening vs records	screening fire/wet/dry flags vs GDACS floods, IBTrACS tracks, FIRMS counts at the same period	Reported as hit / miss / false alarm counts over the backtest window (§9), not as validation of a single assessment
Official events	GDACS live feed	Marked official: true, separate from our screening
Every verdict object is {status: "agree"|"partly"|"disagree"|"unavailable", sources[], independence: "independent"|"same-input-family"|"consistency-check", limitations}. The UI shows the independence tag, so no "independently validated" claim can be rendered by accident.

6. Confidence (P1) — four separate grades
analysis/confidence.py, pure functions, output {grade: "high"|"moderate"|"low"|"insufficient", reasons: [{code, textEn, textBn}]}:

Grade	Observation quality	Anomaly assessment	Hazard screening	Validation
Inputs	baseline length ≥ 30 (24 for daily), ≥50% cell coverage, non-stale	percentile distance from the class boundary, sample count, conflicting components	requires a supporting driver/record (region hazard flag, historical events, linked driver)	number and independence of agreeing sources
high	all inputs met	clear margin + full sample	driver + record agree	independent source agrees
moderate	one degraded (24-year baseline, 50–75% coverage, or 5–30 days late)	adequate	driver only, or record only	same-input-family agrees
low	two degraded, or fallback geography	conflicting components or near a boundary	weak/no relationship	sources disagree or unavailable
insufficient	< 20 baseline values, or indicator unavailable	not computable	not computable	none
Each page section displays its own chip with a "why" list. The conclusion's reliability block cites the lowest grade and names it.

7. Alerts (P1) — responsible alerting
analysis/alerts.py + alerts.json:

Kinds: internal (our screening) and official (GDACS: flood, cyclone, landslide; official: true, provider, event id, alert level, URL). They are never merged into one severity scale and are visually separated.
Thresholds (v1, published on /methods with ids): temperature monthly unusually-high 1 month → watch, extreme → warning, 2+ consecutive unusually-high → warning; rainfall ≤ P10 and dry-days unusually-high → dry watch, two consecutive months → warning; rainfall ≥ P90 / ≥ P95 with heavy-rain-days unusually-high → wet watch / wet warning; fire season requires linked driver + above-normal temperature + below-normal rainfall → info/watch; cyclone season requires the basin sea-warmth driver percentile ≥ high-event percentile → watch.
No duplicate alerts: key (locationId, hazard); re-detection updates lastSeenPeriod, appends occurrences. Escalation to a higher severity creates a new id and closes the previous one as superseded.
No confirmation: every alert text begins "Screening indicator, not a confirmed event." Anomaly never implies hazard; GDACS official alerts are the only text allowed to say "official warning" (attributed).
History: alerts.json holds computed[] (active + expired this run) and reconstructed[] (replay of prior periods, labelled "would have triggered", used by the backtest).
Preferences: web/src/components/intelligence/AlertPreferences.tsx — per-location, per-hazard subscription stored in localStorage, plus a generated .ics calendar reminder and a mailto: subscription request. Explicitly labelled "no background notifications; this device only".
8. Timeline (P2) — continuous intelligence
history.json per location, per assessment date (each pipeline run appends one row; capped at the last 24 runs + 36 periods): { asOf, indicators, conclusionLevel, hazardLevels, confidences, alertsOpened, alertsClosed, changedSince[{field, from, to, reason}] }. The report's "Development" block renders a compact timeline (not a new chart): first anomaly detected, intensity changes, hazard-screening changes, new observation, confidence change, assessment update — derived from changedSince rows, not from free text. changedSince is computed by diffing against the previous run's stored row, so UPDATE is visible rather than implied.

9. Evaluation and backtesting (P2, mandatory gate)
analysis/evaluate.py writes web/public/data/intelligence/evaluation.json and /methods renders it:

Metric	Definition (no leakage)
Anomaly detection accuracy	For each cutoff year Y in 2000…last-1, compute the class using only data ≤ Y; compare with the class from the full record for the same period; report agreement % per class
False-alarm rate	Share of periods where the screening flagged (watch/warning) but no GDACS/IBTrACS/landslide record exists within the location and the following 30 days (rain-driven) or same season (fire)
Missed events	Share of recorded events with no screening flag in the 30 days before/window around them
Lead time	Days between the first screening flag and the first matching official record
Confidence calibration	Share of high-confidence assessments that "came true" (agreed with full-record class) vs moderate vs low, per grade
Geographic coverage	% of study-area land cells with ≥ 20 baseline values and ≥ 50% coverage, per variable
Only real records are used (GDACS floods, IBTrACS storms, NASA landslide catalog, FIRMS counts). If a metric cannot be computed (e.g. no events in a location), it is null with a reason. The evaluation summary is displayed on /methods and linked from /monitoring. A CI check fails if evaluation shows a regression in false-alarm rate above the committed baseline (see §10), so the system cannot silently get worse.

10. Reproducibility and CI (P2)
Tests (analysis/tests/, pytest, offline): test_calendar.py, test_classifier.py (every threshold boundary, 30-year baseline, percentile discreteness), test_composite.py (two-component rule, conflict → normal), test_confidence.py (each input demotes exactly one grade; <20 ⇒ insufficient), test_alert_rules.py (thresholds, dedup, supersede, GDACS mapping), test_conclude.py (all seven fields, evidence ids resolve), test_evaluate.py (no-leakage: a fixture where a future value would change the answer and must not).
Deterministic fixtures in analysis/tests/fixtures/: synthetic grids (known z/percentile, skewed rainfall, missing cells) and a hand-built event record.
Dataset version tracking: sources.json gets {datasetId, version (GPCP v2.3, GISTEMP v4, IBTrACS v04r01, CRU TS 4.10, GDACS API, FIRMS MODIS C6.1), sha256 (of cached raw file when available), checkedAt}.
Pipeline log: analysis/logs/intelligence-<utc>.json — step, duration, datasets touched, cache hits/misses, degraded paths, output hashes; intelligence.json embeds pipelineRunId. Logs are gitignored; the summary fields are committed in sources.json.
Reproducible calculation: every indicator stores inputs[] (source id, period, cell indices hash, weights hash), so a researcher can recompute it from the documented raw files.
CI (.github/workflows/validate.yml): on PR — pytest, python analysis/intelligence.py (offline from cache), git diff --exit-code web/public/data (deterministic output), npm run lint, npm run build. On schedule (weekly) — intelligence.py --refresh, evaluate, open a PR only if evaluations do not regress and diff is non-empty.
11. Data contract (summary)
web/public/data/intelligence/: sources.json, current.json (indicators incl. composite rainfall), locations.json + index.json (graph + conclusion), history.json, alerts.json, evaluation.json. All objects carry schema version, observedAt, retrievedAt, ageDays, stale, source, baselineId, thresholdsId, inputs[]. TS readers validate required keys and throw at build time if a field is missing (fail loudly; never render guessed numbers).

Pipeline order: build.py → build_hazards.py → cyclones.py → crosscheck.py → latest.py → intelligence.py [--refresh] → evaluate.py, documented in root AGENTS.md and analysis/README.md.

12. Web changes (no new charts, no speculative pages)
/location/[id]: 10 spec sections using only new presentational primitives (LevelBadge, PercentileBar reused from findings/parts, FreshnessStamp, EvidenceList, four confidence chips, timeline list, AlertCard, PreparednessList, ForecastGap, ImpactPanel). Map uses the existing CountryMap pattern refactored into a reusable canvas with a layers prop.
/monitoring: freshness matrix (dataset × age × stale flag), active internal vs official alerts side by side, anomaly table, evaluation summary link.
/locations: search + filters over index.json.
/country/[slug]: conclusion + status + alert strip prepended; existing sections untouched; links to the /location report.
/methods: adds classification table, baseline rules, missing-data rules, composite rule, independence table, alert thresholds, confidence matrix, evaluation results and forecast contract.
SiteNav tabs per decision; footer links; LocationSearch (wraps CountrySearch); hero text + search on / with an intelligence strip; /hazards links into /locations?hazard=.
next.config.ts untouched; data-reading pages get revalidate = 86400.
13. Ordered task list
#	Task	Gate
A1	calendar.py, thresholds.py, anomalies.py (percentile-primary), composite.py	pytest test_calendar test_classifier test_composite
A2	Cache GPCP 1DD locally (one network run); verify month conversion; record coveragePct behaviour	fixtures + one real location sanity check
A3	confidence.py (4 grades), validation.py (independence tags), alerts.py, conclude.py, evaluate.py	pytest test_confidence test_alert_rules test_conclude test_evaluate
B1	intelligence.py orchestration, location graph (region→country→study fallback, duplicate-ID check), sources.json versioning, log, --refresh	run offline, review 3 locations by hand (Dhaka, Kathmandu, Bengal delta) against manual calculation
B2	evaluate.py over 2000–2024; record baseline metrics; commit evaluation.json	false-alarm/lead-time numbers reviewed for plausibility
B3	Docs: analysis/README.md, root AGENTS.md, /methods content copy	—
C1	TS schema guards + readers + render-only conclude.ts, forecast.ts, guidance.ts	npm run build
D1	/location/[id] sections; /monitoring; /locations; country header; nav/footer/hero/search	lint + build + Playwright 375/430/768/1366/1920, light/dark, EN/BN
E1	CI workflow (offline determinism, tests, lint, build, weekly refresh PR)	workflow runs green
E2	Acceptance pass (§14) and final report	—
14. Acceptance (must hold)
len(BASELINE_YEARS) == 30; classifier selects on percentile; z shown only as supplementary.
Every location states its geography, resolution, fallback and coverage; no city claim without the fallback label.
Conclusion has all seven question fields, EN + BN, each backed by evidenceIds.
Four confidences rendered separately with reasons; no single percentage anywhere.
Validation verdicts carry independence; nothing is called independent unless tagged so.
Alerts: internal vs official separated, no duplicates, history present, "not a confirmed event" in every internal alert.
evaluation.json present with all six metrics (or null + reason), rendered on /methods.
Offline pipeline run reproduces committed JSON byte-for-byte; pytest -q green; npm run lint and npm run build green; no horizontal overflow or clipped menus at the five widths; no console errors.
No fabricated value, forecast, or probability anywhere in the UI.
15. Out of scope (documented gaps)
Forecasts/weather models, daily temperature (heatwaves), soil moisture/vegetation anomalies, population/infrastructure/economic exposure, national met-service rain observations (documented as required for true rainfall independence), user accounts or server notifications.

16. Final report to produce
Implemented stages vs gaps · architecture/data-flow · new & modified files · datasets, versions and limitations · methodology (baseline, classifier, composite, confidence, alerts) · evaluation results · build/test output · known limitations and next priorities.