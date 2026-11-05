# Resource Inventory

Complete inventory of the resources in this repository, discovered from the working tree on
2026-11-06. It exists so that no page removal, merge or refactor drops a dataset, script, component
or translation that is still useful. **Nothing in this file is a licensing opinion; see
[`DATA_SOURCE_CATALOG.md`](DATA_SOURCE_CATALOG.md) for source, licence and limitations.**

Status vocabulary used below:

- **Live** — read by a page or by a pipeline step that writes a page input on every build.
- **Context** — computed and committed, but no current primary route reads it directly. Keep it; it
  is the raw material for the contextual hazard layers the product plan asks for.
- **Dormant** — a working implementation whose caller or UI was retired. Keep the code and data;
  re-wire rather than rewrite when a surface needs it again.
- **Generated** — an output file; its source is the pipeline step named beside it. Never edit by hand.
- **Local only** — code or data that exists on disk but is gitignored (raw downloads, caches).

---

## 1. Repository layout (top level)

| Path | Role | Status |
|---|---|---|
| `analysis/` | Python trend, hazard, geography and intelligence pipeline. Writes committed JSON. | Live |
| `analysis/intel/` | Intelligence engine package (thresholds, classifier, confidence, alerts, evaluation). | Live |
| `analysis/raw/` | Downloaded source records (GISTEMP, GPCP, GPCP 1DD, geoBoundaries, Natural Earth, CRU). | Local only (gitignored) |
| `scripts/signals/` | Rainfall Signal pipeline: tiles, IMERG reader, baseline, status engine, place/frequency/backtest builders. | Live |
| `scripts/signals/raw/` | Cached network responses for `--refresh` runs (GDACS JSON, Open-Meteo, EONET). | Local only (gitignored) |
| `web/` | Next.js 16 site. Reads `web/public/data/` at build and request time. | Live |
| `web/public/data/` | The committed output tree every page reads. | Generated (committed) |
| `.github/workflows/validate.yml` | CI: tests, determinism, build, weekly refresh PR. | Live |
| `docs/` | This inventory and its companions. | New |

---

## 2. Datasets and integrations

Every dataset the repository actually consumes. The full source/format/coverage/licence/freshness
table is in [`DATA_SOURCE_CATALOG.md`](DATA_SOURCE_CATALOG.md); this list is the completeness check.

| # | Dataset | Ingested by | Committed output | Status |
|---|---|---|---|---|
| D1 | NASA GISTEMP v4 (2°, monthly temperature anomaly) | `analysis/sources.py::load_gistemp` | `trends/temperature_*`, `trends/hot-months_*`, `latest.json`, `intelligence/` | Live |
| D2 | GPCP v2.3 monthly precipitation (2.5°) | `analysis/sources.py::load_gpcp` | `trends/rainfall_*`, `latest.json`, `intelligence/`, backtest rain series | Live |
| D3 | GPCP 1DD v1.3 daily precipitation (1°) | `analysis/daily.py` | `trends/heavy-rain_*`, `dry-spell_*`, `wettest-day_*` | Live |
| D4 | CRU TS 4.10 (0.5°, UEA) | `analysis/crosscheck.py` | `trends/crosscheck.json` | Live (cross-check) |
| D5 | NASA FIRMS MODIS active fires C6.1 | `analysis/events.py` | `hazards/fires_grid.json`, `hazards/zones.json` | Context |
| D6 | NASA Global Landslide Catalog (2007–2017) | `analysis/events.py` | `hazards/landslides.json` | Context |
| D7 | GDACS flood alerts (UN/EU) | `analysis/events.py`, `scripts/signals/places_network.py` | `hazards/floods.json`, `signals/flood-catalogue.json`, `signals/backtest.json` | Live (backtest/evidence) |
| D8 | IBTrACS v04r01 North Indian basin | `analysis/cyclones.py` | `hazards/cyclones.json`, `hazards/zones.json` | Context |
| D9 | geoBoundaries gbOpen ADM0/ADM1/ADM2 | `analysis/build_geography.py` | `geography/index.json`, `geography/admin/*`, `geography/license.json` | Live |
| D10 | IMERG Late/Early GeoTIFF (0.1°, PPS) | `scripts/signals/imerg.py` | `signals/grid/*`, `signals/meta.json` (**sample mode only today**) | Live (sample) |
| D11 | Open-Meteo forecast (7-day outlook) | `scripts/signals/outlook.py`, `places_network.py` | `signals/places/*.json` (`next`), `signals/brief.json` (`outlook`) | Context, external, never in status |
| D12 | Open-Meteo historical archive (ERA5-class) | `scripts/signals/places_network.py` | `signals/places/*.json`, `signals/backtest.json` frequency cases | Live (frequency) |
| D13 | Open-Meteo geocoding | `scripts/signals/places_network.py` (place search) | `signals/area-search.json` (name index) | Live |
| D14 | NASA GIBS WMTS (6 imagery layers) | `web/src/lib/gibs.ts`, `layers.ts` | fetched at build/request (1-day revalidate) | Live |
| D15 | Hansen/UMD Global Forest Change v1.13 tiles | `web/src/components/map/forestLossLayer.ts` | decoded in browser | Dormant with the Map Explorer |
| D16 | NASA POWER / MERRA-2 monthly (scale check) | `analysis/power.py` | `analysis/raw/PRECTOTCORR` | Dormant (spike only) |
| D17 | GHCN-Daily station data | `scripts/signals/spike_imerg_probe.py` | `scripts/signals/spike_report.md` | Dormant (spike only) |
| D18 | EONET v3 events | `scripts/signals/` spike + `raw/eonet_*.json` | `spike_report.md` | Dormant (cross-check only) |
| D19 | Natural Earth base boundaries | `analysis/build_geography.py` (fallback geometry) | `analysis/raw/natural_earth` | Dormant |
| D20 | WMO SWIC severe-weather links | `web/src/` official-warning link-out | link only | Live (link-out) |

Research/documentation-only sources recorded in `scripts/signals/README.md` and `spike_report.md`
(IMERG Final/GES DISC, LANCE NRT flood water, SMAP, OPERA DSWx, NASADEM, SEDAC GPWv4) are catalogued
there and in D-catalog §"Probed, not integrated". They have no committed output.

---

## 3. Python pipeline — `analysis/`

| File | Purpose | Status |
|---|---|---|
| `power.py` | South Asia box, year span, POWER tile downloader (scale check). | Dormant |
| `sources.py` | GISTEMP and GPCP loaders with on-disk caching. | Live |
| `daily.py` | GPCP 1DD per-year `.npz` extraction for extreme-rain indicators. | Live |
| `stats.py` | Mann-Kendall / Sen slope with Hamed-Rao correction, FDR. | Live |
| `events.py` | FIRMS, Global Landslide Catalog and GDACS download + normalisation. | Live |
| `build.py` | Trend builder: writes `trends/*`. Runs `build_country_signals.py`. | Live |
| `build_country_signals.py` | Country aggregation onto boundaries → `maps/place-signals.json`. | Live |
| `build_hazards.py` | Links hazard event records to climate drivers → `hazards/`. | Live |
| `cyclones.py` | IBTrACS tracks and basin-warmth test → `hazards/cyclones.json`. | Live |
| `crosscheck.py` | Repeats key trends with CRU TS 4.10 → `trends/crosscheck.json`. | Live |
| `latest.py` | Latest month vs 1951–1980 normals → `latest.json`. | Live |
| `build_geography.py` | geoBoundaries index, per-country admin units, licence file. | Live |
| `build_signal_scores.py` | **Measured coverage** per area + `provenance.json`. (Demo scores removed.) | Live |
| `intelligence.py` | Runs `intel/` engine → `intelligence/*.json`; `--reproduce` byte-stable, `--refresh` adds monthly series. | Live |
| `monthly.py` | Area-weighted monthly GISTEMP/GPCP series → `intelligence/inputs/monthly.json`. | Live (`--refresh`) |
| `evaluate.py` | Backtest/evaluation of intelligence classes → `intelligence/evaluation.json`; `--check` gate. | Live |
| `zones.json` | Nine research regions (bbox, hazard, Bangla name) used by trend and hazard builds. | Live |
| `evaluation_baseline.json` | False-alarm-rate ceilings the `--check` gate enforces. | Live |

`analysis/intel/`: `thresholds.py` (single source of every cut-off), `classifier`/`composite.py`,
`confidence.py` (four separate grades, never combined), `alerts.py`, `anomalies.py`,
`evaluation.py`, `validation.py`, `conclude.py`, `geography.py`, `inputs.py`, `names.py`,
`periods.py`, `engine.py`, `calendar` logic inside `periods.py`.

Tests: `analysis/test_stats.py`, `test_country_signals.py`, `test_signal_scores.py`,
`analysis/tests/` (11 files, intelligence engine).

---

## 4. Python pipeline — `scripts/signals/`

| File | Purpose | Status |
|---|---|---|
| `tiles.py` | 10° tile registry, grid arithmetic, public `config.json` copy. | Live |
| `imerg.py` | IMERG GIS GeoTIFF reader with asserted encoding facts. | Live (sample only) |
| `baseline.py` | Day-of-year empirical percentiles, normality, baseline sufficiency. | Live |
| `engine.py` | Status engine — the only numeric→status mapping in the tree. | Live |
| `sample.py` | Deterministic seeded climatological sample generator. | Live (demo) |
| `writer.py` | Serialises grid, archive, watch and meta files; budget checks. | Live |
| `build.py` | CLI: `--seeded-sample`, `--replay-events`, `--demo`. | Live |
| `place.py` | Per-area Before/Now/Next/Trust payload + map outlines → `signals/places/`, `places-map/`. | Live |
| `place.py` (country index) | `signals/places.json`, `signals/area-search.json`. | Live |
| `build_south_asia.py` | Packed RGB/alpha grids → `signals/south-asia/`. | Live (map context) |
| `backtest.py` | Historical frequency (Wilson) + rainfall-screen backtest → `frequency/` (gitignored), `backtest.json`, `accuracy.json`, `brief.json`. | Live |
| `places_network.py` | Network refresh for outlook and rain archive (Open-Meteo, GDACS). | Live (`--refresh`) |
| `outlook.py` | External 7-day outlook, never in a status. | Live |
| `watch.py` | Rise detection between archive days → `signals/watch.json`. | Live |
| `replay.py` | Replay event registry (GDACS ids, coordinates). | Live |
| `build_south_asia.py` | (see above) | Live |
| `auth.py` | Credential probes; never prints or stores a secret. | Live (keyed runs) |
| `run.py` | Entry point: auth/readme/outlook probes, one-day timing. | Live |
| `spike.py`, `spike_imerg_probe.py` | Measured gates recorded in `spike_report.md`. | Dormant (record of evidence) |
| `spike_report.md`, `README.md` | Catalogue of record: tier, auth, latency, failure mode, `checkedOn`. | Live (documentation) |
| `config.json` | Every Signal threshold (windows, percentiles, budgets, IMERG encoding, outlook). | Live |

Tests: `tests/test_step2.py`, `test_step3.py`, `test_spike.py`, `test_guardrails.py`, `test_place.py`.
`frequency/` output (≈53k per-area JSON files, 211 MB) is generated and **gitignored**; it is rebuilt
by `backtest.py` and is not part of the repository.

---

## 5. Committed data — `web/public/data/`

| File / folder | Written by | Read by | Status |
|---|---|---|---|
| `trends/manifest.json` | `build.py` | trends types, intel inputs, backtest | Live |
| `trends/{variable}_{season}{,_series}.json` (10 variables) | `build.py` | Signal (Before/Trust), backtest, intel | Live |
| `trends/zones.json` | `build.py` / `build_hazards.py` | intel inputs | Live |
| `trends/crosscheck.json` | `crosscheck.py` | intel confidence | Live |
| `hazards/floods.json` (725 records) | `events.py`/`build_hazards.py` | backtest, intel, Evidence | Live |
| `hazards/landslides.json` | `events.py` | intel, contextual hazard | Context |
| `hazards/fires_grid.json` (1779 cells) | `events.py` | contextual hazard | Context |
| `hazards/cyclones.json` (tracks) | `cyclones.py` | contextual hazard | Context |
| `hazards/zones.json` (10 zones) | `build_hazards.py`, `cyclones.py` | intel inputs | Live |
| `latest.json` | `latest.py` | Home, intel | Live |
| `geography/index.json`, `geography/admin/{ISO}.json` (231), `geography/license.json` | `build_geography.py` | Signal search/areas, methods | Live |
| `maps/place-signals.json` | `build_country_signals.py` | intel inputs | Live |
| `maps/south-asia-boundaries.json` | `build_geography.py` | map outlines | Live |
| `intelligence/index.json`, `intelligence/current.json`, `intelligence/history.json`, `intelligence/alerts.json`, `intelligence/locations.json`, `intelligence/sources.json` (source register), `intelligence/thresholds.json` (single threshold source), `intelligence/evaluation.json`, `intelligence/inputs/monthly.json` | `intelligence.py`, `evaluate.py`, `monthly.py` | any intel surface, `/methods` | Live/Context |
| `signals/meta.json`, `grid/*.json` (3) | `build.py` (sample) | Signal Now, model | Live (sample) |
| `signals/config.json` | copied by `tiles.py` | Signal thresholds, Replay | Live |
| `signals/coverage.json`, `areas/{ISO}.json` (231), `area-search.json` | `build_signal_scores.py` | Signal search/Gap/Frequency | Live |
| `signals/provenance.json`, `sources.json` | `build_signal_scores.py`, `build.py` | methods, gap | Live |
| `signals/places.json` | `place.py` | `/signal/[id]` IDs | Live |
| `signals/places/{id}.json` (302) | `place.py`, `places_network.py` | Signal Before/Now/Next/Trust/Evidence | Live |
| `signals/places-map/{ISO}.json` (5 + index) | `place.py` | map outlines | Live |
| `signals/south-asia/*` (RGB/alpha grids) | `build_south_asia.py` | map context | Context |
| `signals/backtest.json` (rules, `replay[]` episodes with `value`, `threshold`, `flagged`), `signals/accuracy.json`, `signals/brief.json`, `signals/flood-catalogue.json` | `backtest.py` | Replay slider, Accuracy, Signal, Evidence | Live |
| `signals/watch.json`, `archive/{date}.json` | `watch.py`, `writer.py` | Watch, rise detection | Live |
| `signals/frequency/{id}.json` (≈53k) | `backtest.py` | frequency API readers | **Generated, gitignored** |

---

## 6. Web application — `web/src/`

### 6.1 Routes (`web/src/app/`)

| Route | Bytes | Reads | Status |
|---|---|---|---|
| `/` `page.tsx` | 1151 lines pre-rewrite | `latest`, `brief`, model | Live |
| `/signal` and `/signal/[id]` | 378 + 113 | model, places, level | Live |
| `/gap` | 387 | coverage, provenance | Live |
| `/replay` | 164 + `ReplayExplorer` | backtest | Live |
| `/accuracy` | 331 | accuracy/backtest | Live |
| `/act` | 389 | model rows, `ActionMessages`, `ShareCard` | Live |
| `/watch` | 140 + `WatchManager` | model rows, local storage | Live |
| `/methods` | 978 | thresholds, sources, licence | Live |
| `/for-organizations` | 301 | static + data contracts | Live |
| `not-found`, `error`, `loading`, `globals.css`, icons, OG/Twitter images | shared | — | Live |

Retired routes (redirected 308 in `web/next.config.ts`): `/trends`, `/hazards`, `/monitoring`,
`/locations`, `/countries`, `/country/:slug`, `/location/:id`, `/explore`, `/findings`, `/signals`,
`/signals/place`, `/signals/evidence`, `/about`.

### 6.2 Components (`web/src/components/`)

| Folder | Components | Reads | Status |
|---|---|---|---|
| `signal/` | `SignalExplorer`, `SignalMap`, `SignalSearch`, `History`, `ReplayExplorer`, `ReplayMap`, `SampleNotice`, `WatchManager`, `ShareCard`, `ActionMessages`, `levels`, `observation` | signals data | Live |
| `map/` | `MapExplorer`, `LeafletMap`, `CompareDivider`, `differenceLayer`, `forestLossLayer`, `ForestLossChart`, `lossColors`, `diffColors`, `baseMap`, `MapPlaceSearch`, `MapSheet`, `MapLoading`, `PlaceClimateContext` | GIBS catalog, trends | **Dormant** with Map Explorer (no current route) |
| `hazards/` | `HazardExplorer`, `HazardMap`, `YearBars`, `hazardColors` | `hazards/*` | **Dormant** with `/hazards` — reusable for contextual hazards |
| `trends/` | `TrendExplorer`, `TrendMap`, `SeriesChart` | `trends/*` | **Dormant** with `/trends` — reusable charts |
| `country/` | `CountryMap`, `CountryMapClient`, `CountryTrends` | area trends | **Dormant** with `/country` |
| `findings/` | `MiniGridMap`, `StoryNav`, `parts`, `visuals` | findings data | **Dormant** with `/findings` |
| `intelligence/` | `IntelligenceStrip`, `LocationsBrowser`, `Locator`, `MethodsIntelligence`, `AlertPreferences`, `parts` | `intelligence/*` | Dormant (pages repurposed) |
| `hero/` | `HeroClimateStory`, `HeroImageSlideshow` | static | Live (Home) |
| `home/` | `EvidenceStory` | brief | Live |
| `site/` | `SiteNav` | — | Live |
| `ui/` | `icons`, `motion-icons`, `toast`, `ToasterHost`, `DataActions`, `ShareButton`, `index` | — | Live |

### 6.3 Libraries (`web/src/lib/`)

| File | Purpose | Status |
|---|---|---|
| `data.ts` | Server JSON readers with caching. | Live |
| `signals/{model,level,backtest,data,map,age,types}.ts` | Signal model, Watch Level, backtest readers, age helper. | Live |
| `geography/{data,index,types}.ts` | Shared geo identifiers/readers. | Live |
| `intelligence/{data,conclude,types,forecast,guidance}.ts` | Intel readers and render-only mappings. | Live |
| `gibs.ts`, `layers.ts` | GIBS catalog fetch + 6 layer definitions. | Dormant (map) |
| `hazards.ts` | Types + hazard meta (labels, Bangla). | Dormant |
| `trends.ts`, `countryReport.ts`, `places.ts`, `mapPlaces.ts`, `geo.ts` | Trend types, country report, named places, map places. | Live/Context |
| `i18n.tsx`, `bn.ts`, `names.ts` | English/Bangla switch, numerals, place names. | Live |
| `theme.ts`, `bootScripts.ts`, `dates.ts`, `download.ts`, `plain.ts`, `countries.ts` | Design tokens, theme flash guard, date/format helpers. | Live |

---

## 7. Translations, icons, themes and design tokens

| Resource | Location | Status |
|---|---|---|
| English inline strings | Every page via `<T en=… bn=…>` | Live |
| Bangla strings | Same components + `lib/bn.ts` (digits, numerals) | Live |
| Bangla place/level names | `lib/names.ts`, `geography/index.json` (`nameBn`) | Live |
| Hazard labels (en/bn) | `lib/hazards.ts`, `lib/intelligence/conclude.ts` | Live |
| Design tokens | `web/src/app/globals.css` (Tailwind v4 `@theme`, `ink/line/sunken/accent` tones) | Live |
| Theme handling | `lib/theme.ts`, `lib/bootScripts.ts` | Live |
| Icons | `lucide-react`, `components/ui/icons.tsx`, `motion-icons.tsx` | Live |

---

## 8. Documentation, licences and attribution

| File | Content |
|---|---|
| `README.md` | Project overview (partly stale: still mentions demo scores). |
| `AGENTS.md` | Operating rules for agents; pipeline order and route contract. |
| `CLAUDE.md`, `DESIGN.md` | Longer summaries, partly stale. |
| `analysis/README.md` | Pipeline order, variable table, study area. |
| `scripts/signals/README.md` | Source catalogue of record: tier, auth, latency, failure mode, `checkedOn`. |
| `scripts/signals/spike_report.md` | Measured evidence for IMERG, GDACS, EONET, POWER, GHCN. |
| `web/README.md` | Web-specific notes. |
| `web/public/data/geography/license.json` | Per-boundary licence, represented year, upstream source. |
| `web/public/data/signals/provenance.json` | Dataset → file → variable map and geoBoundaries citation. |
| `web/public/data/intelligence/sources.json` | Machine-readable source register: version, lag, staleness, hashes. |
| `/methods` page | Human-readable credit and licence rendering. |

---

## 9. Automation

| Workflow | Trigger | Does |
|---|---|---|
| `validate.yml: validate` | push/PR | Python tests; intelligence `--reproduce` + `evaluate --check` + git-diff gate; web lint + build. |
| `validate.yml: signals` | push/PR | Guardrails test; signals tests; seeded-sample/replay/demo byte-identical build; client age helper test. |
| `validate.yml: refresh` | weekly cron, manual | Re-download public records, rebuild pipeline, open a data PR only if evaluation does not regress. |

---

## 10. Known gaps and stale statements

- `README.md` still describes the removed demo scores; it predates the coverage rewrite.
- The Map Explorer (GIBS + forest loss) has no route but all of its code and layer definitions remain.
- Hazard contextual components (`components/hazards`, `components/trends`, `components/country`)
  have no live route but their committed data is current.
- `signals/frequency/` is generated, not committed: a fresh clone has no frequency files until
  `scripts/signals/backtest.py` runs.
- IMERG integration is **sample mode only**; no real IMERG observation is committed
  (`signals/meta.json` → `"basis": "sample"`).
- `scripts/signals/.venv/` exists on disk but is gitignored (verify it is never committed).
