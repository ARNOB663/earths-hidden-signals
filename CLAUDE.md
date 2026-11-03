# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Three parts, connected only through committed JSON under `web/public/data/`:

- `analysis/` — Python pipeline: downloads NASA/NOAA/CRU/GDACS/IBTrACS records, caches raw inputs in `analysis/raw/`, computes trend and hazard statistics, writes the trend/hazard/intelligence datasets, and builds the administrative geography and Signals coverage files.
- `web/` — Next.js 16 App Router site. Reads committed JSON server-side from `web/public/data/` and renders maps, charts, explorers and reports. Runs without the pipeline.
- `scripts/signals/` — a **separate, in-progress live rain-signal pipeline** (plan rev. 7b in `.kilo/plans/`, currently early steps). It downloads NASA IMERG via PPS/Earthdata and writes `web/public/data/signals/` (`grid/`, `evidence/`, `replay/`, `meta.json`, `accuracy.json` …) that power `/watch`, `/accuracy` and `/about`. It has its own venv, its own test suite, and its own committed baseline. Do not confuse it with the analysis pipeline's Signals work below.

Two different things are called "Signals": the analysis pipeline's demo green/yellow/red scores and geoBoundaries geography (`analysis/build_geography.py`, `build_signal_scores.py`, `build_country_signals.py`), and `scripts/signals/`'s live IMERG rain signals. Three different `sources` files exist and must not be conflated: `web/public/data/signals/sources.json` (legacy rain-signal shape, read by `/about`), `web/public/data/signals/provenance.json` (dataset credits for `/signals`), and `web/public/data/intelligence/sources.json` (dataset lineage for `/methods` and `/monitoring`).

Generated JSON is committed. Rerunning a pipeline step means committing changed data and confirming `npm run build` still passes.

## Commands

Run analysis commands from `analysis/`:

```bash
pip install -r requirements.txt        # needs shapely for country aggregation
python -m pytest -q                    # test_stats.py, test_country_signals.py, test_signal_scores.py, tests/
python -m pytest -q tests/             # intelligence engine only
python -m pytest -q test_stats.py::test_clear_trend_is_significant_with_correct_rate
```

Tests import modules directly, so pytest must run from `analysis/` — there is no package/`PYTHONPATH` setup.

Pipeline order (later steps read earlier outputs):

```bash
python build.py                  # trends; also runs build_country_signals.py -> maps/place-signals.json
python build_geography.py        # geoBoundaries gbOpen boundaries (network; --offline to rebuild from raw/)
python build_signal_scores.py    # Signals coverage + demo scores; needs build.py and build_geography.py output
python build_hazards.py
python cyclones.py
python crosscheck.py             # independent CRU TS repeat of regional trends
python latest.py
python intelligence.py           # offline; --reproduce is byte-identical (CI checks), --refresh adds monthly series
python evaluate.py               # --check fails if a false-alarm rate rises >2pp above evaluation_baseline.json
```

Run web commands from `web/`:

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # eslint, flat config
npm run build    # production build; also the type check (no separate typecheck script)
npm run start
```

There is no JS test *framework*, but one TS test file runs under Node's built-in runner and CI executes it:

```bash
node --experimental-strip-types --test src/lib/signals/age.test.ts
```

`scripts/signals/` uses its own virtualenv — the CI runner's system Python has no numpy:

```bash
python -m venv scripts/signals/.venv
scripts/signals/.venv/bin/pip install -r scripts/signals/requirements.txt
scripts/signals/.venv/bin/python -m pytest -q scripts/signals/tests
scripts/signals/.venv/bin/python scripts/signals/build.py --seeded-sample   # also --replay-events, --demo
```

`scripts/signals/build.py --seeded-sample` and `intelligence.py --reproduce` are **determinism gates**: CI asserts their output is byte-identical to what is committed (`git diff --exit-code` plus an untracked-file check).

Auth (never commit): `PPS_USERNAME` / `PPS_PASSWORD` for PPS IMERG, `EARTHDATA_TOKEN` for LANCE/GES DISC. `scripts/signals/run.py --check-auth` probes them and prints status only.

## Architecture and data flow

```text
NASA / NOAA / CRU / GDACS / IBTrACS  →  analysis/raw/ cache  →  source loaders
  →  stats.py  →  build*.py / cyclones.py / crosscheck.py / latest.py
  →  intelligence.py + intel/  →  evaluate.py
  →  web/public/data/**/*.json  →  server-side readers or client fetches  →  App Router pages

NASA PPS / Earthdata (IMERG, GDACS, Open-Meteo)
  →  scripts/signals/  →  web/public/data/signals/  →  /watch, /accuracy, /about
```

### Analysis

- `stats.py` is the shared statistics layer: Hamed-Rao Mann-Kendall, Sen's slope with a 95% CI, Benjamini-Hochberg FDR.
- `sources.py` (GISTEMP, GPCP monthly), `daily.py` (GPCP 1DD daily, cached as yearly `.npz`), `events.py` (FIRMS fires, NASA landslides, GDACS floods), `power.py` (land mask only — POWER rainfall was rejected for step changes), `monthly.py` (network; used by `intelligence.py --refresh`).
- `zones.json` defines the geographic regions shared by every trend and hazard build. `build_geography.py` writes `geography/index.json`, `geography/admin/{ISO}.json` and `geography/license.json`; `build_signal_scores.py` writes `signals/coverage.json`, `signals/demo-scores.json` and `signals/provenance.json`.
- `intelligence.py` + `intel/` produce `web/public/data/intelligence/`: `current.json` (every indicator, baseline, percentile, class, confidences, input hashes), `locations.json`, `index.json`, `alerts.json`, `history.json`, `sources.json`, `thresholds.json`, `evaluation.json`.
- **Every threshold lives in `analysis/intel/thresholds.py`** and is published to `/methods` via `thresholds.json`. Never re-derive or duplicate a cut-off in TypeScript.
- `intel/` is a package on purpose: a top-level `calendar.py` would shadow the stdlib module that `build.py` and `latest.py` import.

### Web application

- Routes live under `web/src/app/`; `/location/[id]` and `/country/[countrySlug]` set `dynamicParams = false` and generate params from pipeline output, so a new city needs a pipeline run (`analysis/intel/names.py` reads the city list from `web/src/lib/places.ts`). Data pages set `revalidate = 86400`.
- Server components read committed JSON with Node `fs` through `web/src/lib/data.ts`, `lib/intelligence/data.ts`, `lib/geography/data.ts` and `lib/signals/data.ts`. These validate required keys and **throw at build time** — a missing key is a pipeline bug, not a staleness problem. Large per-cell series are instead fetched from `/data/...` by client components.
- `lib/intelligence/conclude.ts` only maps pipeline values to labels; it never classifies. Classification belongs to `analysis/intel/`.
- Map components are Leaflet, dynamically imported with SSR off. `lib/layers.ts` (live GIBS + GFW layers) is independent of the precomputed analysis datasets; `lib/gibs.ts` reads NASA's WMTS catalog server-side with one-day revalidation and fallback metadata; `components/map/forestLossLayer.ts` decodes forest-loss tiles in the browser. Explorer state lives in URL query params so links are shareable.
- i18n is English/Bangla via `lib/i18n.tsx` (`<T>`), `lib/bn.ts`, `lib/names.ts`. `lib/signals/age.ts` is deliberately pure so the server-rendered and hydrated age agree — pass `generatedAt` from `meta.json`, never `new Date()` at render time.
- `web/next.config.ts` is intentionally empty; images and metadata are per route. `lib/signals/data.ts` reads the `/watch` and `/accuracy` payloads and the legacy `signals/sources.json` shape used by `/about`.

## Gotchas

- Before writing web code, read the bundled Next.js 16 docs at `web/node_modules/next/dist/docs/` — Next 16 differs substantially from older versions.
- `AGENTS.md` (root) is the older canonical summary and is partly stale (it references `web/AGENTS.md`, which no longer exists). Prefer this file and the code when they disagree.
- `analysis/raw/`, `analysis/logs/`, `scripts/signals/raw|derived|logs|.venv` are gitignored; `scripts/signals/baseline/` and `web/public/data/**` are committed and are the CI source of truth.
- Regenerating data changes committed JSON — rerun `npm run build` afterwards.
- `DESIGN.md` holds the longer design narrative; `web/README.md` documents the Map Explorer layers and shareable URL shapes.
