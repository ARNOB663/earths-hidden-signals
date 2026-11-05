# Resource Integration Map

How each repo resource flows from source to a surface, what is live today, and — because the site
was restructured to seven routes — which resources are currently orphaned and must be re-wired rather
than rebuilt. Complements [`RESOURCE_INVENTORY.md`](RESOURCE_INVENTORY.md) (what exists) and
[`DATA_SOURCE_CATALOG.md`](DATA_SOURCE_CATALOG.md) (where it comes from).

Legend: **Live** read by a current route · **Context** committed but orphaned · **Dormant** code with
no caller · **Sample** synthetic, labelled.

---

## 1. Pipeline execution order

```
analysis/build.py ─┬─→ trends/*.json ─┬─→ latest.py ────────────→ latest.json
 (sources.py)       │                  ├─→ build_hazards.py ─┬──→ hazards/zones.json, floods/landslides/fires
 (daily.py)         │  (events.py)     │  (cyclones.py)  ─────┴──→ hazards/cyclones.json
                    │                  ├─→ crosscheck.py ───────→ trends/crosscheck.json
                    │                  └─→ backtest.py (sig) ──→ signals/backtest.json, accuracy.json, brief.json
                    └─→ build_country_signals.py ─────────────→ maps/place-signals.json
build_geography.py ───────────────────────────────────────────→ geography/index.json, admin/*, license.json
build_signal_scores.py (after geography + build) ─────────────→ signals/coverage.json, areas/*, area-search.json, provenance.json
intelligence.py ──(intel/)──→ intelligence/*.json ──→ evaluate.py ──→ intelligence/evaluation.json
scripts/signals/build.py --seeded-sample ─────────────────────→ signals/grid/*, meta.json, watch.json, archive/
scripts/signals/place.py [--refresh] ─────────────────────────→ signals/places/*, places.json, places-map/*
scripts/signals/build_south_asia.py ──────────────────────────→ signals/south-asia/*
scripts/signals/backtest.py ──────────────────────────────────→ signals/frequency/* (gitignored)
```

CI enforces this order and byte-identical re-runs (`validate.yml`).

---

## 2. Live routes

| Route | Engine input | Pipeline source | Dataset |
|---|---|---|---|
| `/` Home | `latest.json`, `brief.json`, `signals/meta.json` | `latest.py`, `backtest.py`, `build.py` | GISTEMP, GPCP |
| `/signal` | `coverage.json`, `areas/*`, `area-search.json`, `model.ts` rows | `build_signal_scores.py`, `place.py`, `backtest.py` | GISTEMP/GPCP series, geoBoundaries, Open-Meteo archive, GDACS |
| `/signal/[id]` | `places.json`, `places/{id}.json` | `place.py` | trends series, Open-Meteo, GDACS |
| `/gap` | `coverage.json`, `provenance.json`, `sources.json` | `build_signal_scores.py`, `build.py` | — |
| `/replay` | `backtest.json` | `backtest.py` | GDACS, GPCP monthly |
| `/accuracy` | `accuracy.json`, `backtest.json` | `backtest.py` | GDACS, GPCP |
| `/act` | `model.ts` rows, `ActionMessages`, `ShareCard` | derived from Signal | — |
| `/watch` | `model.ts` rows, browser localStorage | derived from Signal | — |
| `/methods` | `intelligence/{thresholds,sources,evaluation}.json`, `geography/license.json` | `intelligence.py`, `evaluate.py`, `build_geography.py` | all |
| `/for-organizations` | static contracts | — | — |

---

## 3. Orphaned resources and where they belong

Everything below is present and current but has no live route since the seven-route restructure.
The product plan (§2 "Preserve multi-hazard intelligence") requires keeping them as **separate
contextual layers**, not deleting them.

| Resource | Original surface | Data it renders | Planned home | Status |
|---|---|---|---|---|
| `components/hazards/*`, `lib/hazards.ts` | `/hazards` | `hazards/{floods,landslides,fires_grid,cyclones,zones}.json` | Contextual hazard section on `/signal` or dedicated hazard panel in the Signal detail | Context |
| `components/trends/*`, `lib/trends.ts`, `lib/countryReport.ts` | `/trends`, `/country/[slug]` | `trends/*_series.json`, `maps/place-signals.json` | Historical trend context per place (Before band already reads the same series) | Context |
| `components/country/*` | `/country/[slug]` | area trend summary | Superseded by `/signal/[id]`; keep charts for reuse | Dormant |
| `components/map/*`, `lib/gibs.ts`, `lib/layers.ts` | `/explore` (Map Explorer) | GIBS WMTS, forest-loss tiles | Optional context map on `/signal`; keep decoder and layer defs | Dormant |
| `components/findings/*` | `/findings` | story narratives | Retire UI; keep data story text if reused | Dormant |
| `components/intelligence/{IntelligenceStrip,Locator,LocationsBrowser,AlertPreferences}`, `lib/intelligence/{forecast,guidance}.ts` | `/monitoring`, `/locations` | `intelligence/{current,alerts,locations,history}.json` | Contextual intelligence strip; forecast contract stays a documented gap | Dormant |
| `hazards/cyclones.json` | `/hazards` | IBTrACS tracks | Cyclone context layer | Context |
| `hazards/landslides.json`, `hazards/fires_grid.json` | `/hazards` | GLC, FIRMS | Heat/wildfire/landslide context layers | Context |
| `geography/admin/*` ADM2 (179 countries) | full coverage map | geoBoundaries | Keep; used by Signal search/coverage | Live |
| `analysis/power.py`, `raw/PRECTOTCORR` | spike | NASA POWER | Scale-check reference only | Dormant |
| `scripts/signals/spike*`, `spike_report.md` | evidence | measured gates | Documentation of record | Dormant (keep) |

**Rule:** no dataset in §3 may be deleted because its page was removed. A replacement surface must be
committed in the same change that retires the last reader.

---

## 4. Contracts the plan builds on (already in code)

These existing mechanisms are the foundation for the plan's later phases; do not duplicate them.

| Plan requirement | Existing implementation | Gap to close |
|---|---|---|
| §2 multi-hazard kept separate | `analysis/intel/confidence.py` grades four hazards separately and never combines them; `alerts.py` has per-hazard rules | No route renders hazard context since `/hazards` retired |
| §4 frequency denominator | `backtest.py::level_payload` — cases = complete archive years with a catalogue query; floods = years with a GDACS record ≤150 km of the area centre; Wilson interval; `minIntervalCases: 10` in `config.json` | Denominator wording not surfaced on `/signal` ("3 of 28"); lift null when base rate zero is partly handled (`summarise` returns `null` lift when `base["value"]` falsy) but not labelled "not estimable" |
| §5 backtest validity | `screen_year` excludes the tested year; `baselineMinValues: 8`; GPCP monthly only; fixed 2000–2025 window | No random-date random-location baseline; no recorded seed/bootstrap; no published random baseline |
| §6 dynamic replay | `ReplayExplorer::outcomeOf` recomputes the flag from `row.value` vs a what-if threshold | Slider is a fraction of the committed threshold; no per-event "earlier signal / no earlier signal / unavailable observations" wall; `TestedYear` has no observation series, only `value` |
| §7 trust grades | `signals/level.ts` Watch Level; `analysis/intel/confidence.py` four grades with explicit precedence (`insufficient` first); `engine.py` precedence `no-data > stale > low-coverage > baseline-small > out-of-coverage` | Signal "Data Trust Grade" precedence not written in one preregistered rule doc |
| §8 privacy | `SignalExplorer` geolocation only on explicit button; `WatchManager` local-only | No PlacePicker with manual fallback consent flow; verify nothing logs coordinates |
| §9 demo honesty | `SampleNotice`, `meta.json: basis=sample`, `demo/` outputs from `build.py --demo`, fixed clock 2025-09-10 | Coverage/file naming: `demo/*` committed but routes read `grid/*`; DEMO MODE label not global |
| §10 quality gates | 166+ Python tests, guardrails, client age test | Missing the specific gates listed in plan §10 |

---

## 5. Data freshness and staleness flow

```
intelligence/sources.json (checkedAt, observedThrough, ageDays, expectedLagDays, stale)
        │
        ├─→ /methods (MethodsIntelligence) renders the register
        ├─→ intelligence/evaluation.json gates
        └─→ scripts/signals/age.ts  → statusAfterAge() → Grey "stale" after staleHours (48 h, real runs only)
```

Sample runs never age (`age.notApplicable`); real runs become Grey when older than `config.staleHours`.

---

## 6. What must not be rebuilt

- Trend statistics: `analysis/stats.py` (Mann-Kendall, Sen slope, Hamed-Rao, FDR).
- Hazard-driver linkage: `build_hazards.py` detrended Spearman.
- Geography ingest: `build_geography.py` (`.dbf` name extraction, per-boundary licence).
- Status engine: `scripts/signals/engine.py` (only numeric→status mapper).
- Threshold single source: `analysis/intel/thresholds.py` and `signals/config.json` (no threshold in TS).
- Byte-identical determinism gate: `intelligence.py --reproduce`.
