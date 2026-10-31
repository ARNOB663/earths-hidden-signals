# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. See `AGENTS.md` for the canonical, verified instruction file.

## Repository overview

This repository has two parts:

- `analysis/` is a Python pipeline that downloads climate and hazard records, caches raw inputs, computes statistical results, and writes JSON datasets for the website.
- `web/` is a Next.js 16 App Router application that reads committed datasets from `web/public/data/` and presents maps, charts, trend explorers, hazard explorers, and place reports.

Generated JSON is committed, so the website can run without rerunning the analysis pipeline. Raw analysis inputs under `analysis/raw/` are ignored.

## Commands

### Web application

Run these commands from `web/`:

```bash
npm install
npm run dev       # Development server at http://localhost:3000
npm run lint      # ESLint
npm run build     # Production build and TypeScript checking
npm run start     # Serve production build
```

There is no JavaScript/TypeScript test suite or test script. Use `npm run lint` and `npm run build` to validate web changes.

Before changing code under `web/`, consult the relevant bundled Next.js 16 documentation under `web/node_modules/next/dist/docs/` (Next 16 differs from older versions).

### Analysis pipeline

Run these commands from `analysis/`:

```bash
pip install -r requirements.txt
python -m pytest -q
python -m pytest -q test_stats.py
python -m pytest -q test_stats.py::test_clear_trend_is_significant_with_correct_rate
python -m pytest -q tests/        # intelligence engine tests
```

General single-test form:

```bash
python -m pytest -q test_stats.py::<test_function_name>
```

Run the data pipeline in this order:

```bash
python build.py
python build_hazards.py
python cyclones.py
python crosscheck.py
python latest.py
python intelligence.py   # offline; --reproduce for a byte-identical rerun, --refresh adds monthly series
python evaluate.py       # --check fails on a false-alarm regression
```

`build_hazards.py` depends on trend output from `build.py`. `latest.py` also requires `build.py` output. `intelligence.py` reads all previous outputs; `evaluate.py` reads `intelligence.py` output. See `analysis/README.md` for source-specific setup and pipeline details.

## Architecture and data flow

```text
NASA / NOAA / CRU / GDACS / IBTrACS sources
    -> analysis/raw/ cache
    -> Python source loaders
    -> analysis/stats.py
    -> build.py / build_hazards.py / cyclones.py / crosscheck.py / latest.py
    -> intelligence.py / evaluate.py (analysis/intel/: classes, composites, confidence, alerts, conclusions)
    -> web/public/data/**/*.json
    -> server-side readers or browser fetches
    -> Next.js routes and interactive components
```

### Analysis

- `analysis/sources.py` downloads and loads NASA GISTEMP and GPCP monthly data.
- `analysis/daily.py` handles GPCP daily rainfall and caches compact yearly `.npz` files.
- `analysis/events.py` loads FIRMS fire, NASA landslide, and GDACS flood records.
- `analysis/stats.py` is the shared statistics layer: Hamed-Rao Mann-Kendall tests, Sen slope confidence intervals, and Benjamini-Hochberg FDR correction.
- `analysis/build.py` is the main climate-trend pipeline.
- `analysis/build_hazards.py` correlates detrended hazard events with climate drivers.
- `analysis/cyclones.py` adds IBTrACS cyclone analysis to hazard outputs.
- `analysis/crosscheck.py` independently repeats regional trends with CRU TS data.
- `analysis/latest.py` generates latest-month comparisons for the home page.
- `analysis/build_country_signals.py` aggregates the grids onto country polygons (`web/public/data/maps/place-signals.json`); `build.py` runs it.
- `analysis/intelligence.py` and `analysis/intel/` produce the screening reports, alerts, confidence grades and history; `analysis/evaluate.py` backtests them. All thresholds live in `analysis/intel/thresholds.py`.
- `analysis/monthly.py` (used by `intelligence.py --refresh`) builds monthly series per location; it needs network.
- `analysis/zones.json` defines geographic regions shared by trend and hazard builds.

Primary outputs are `web/public/data/trends/`, `web/public/data/hazards/`, `web/public/data/maps/`, `web/public/data/latest.json` and `web/public/data/intelligence/`.

### Web application

App Router entry points live under `web/src/app/`. Main routes are the landing page, `/monitoring`, `/locations`, `/location/[id]`, `/explore`, `/trends`, `/hazards`, `/findings`, `/methods`, `/countries` and `/country/[countrySlug]`. `/location/[id]` and `/country/[countrySlug]` use `dynamicParams = false`; location IDs come from the intelligence pipeline output.

Map-heavy client components use dynamic Leaflet imports with SSR disabled. Explorers keep filters and selections in URL query parameters.

Data responsibilities are split as follows:

- `web/src/lib/data.ts` reads committed JSON on the server with Node file APIs and provides cached loaders.
- `web/src/lib/countryReport.ts` assembles country dashboards server-side from trend and event data.
- `web/src/lib/intelligence/` holds the intelligence types, build-time-validated readers (`data.ts`) and render-only label helpers; components live in `web/src/components/intelligence/`.
- `web/src/lib/trends.ts`, `hazards.ts`, and `places.ts` hold domain types, metadata, and geographic helpers.
- `web/src/lib/i18n.tsx` (`<T>`), `web/src/lib/bn.ts`, and `web/src/lib/names.ts` provide English/Bangla translations and language state.
- Large trend and hazard detail files are fetched by client components from `/data/...` when needed.
- `web/src/lib/layers.ts` defines live NASA GIBS and Global Forest Watch map layers. These are separate from the precomputed analysis datasets.
- `web/src/lib/gibs.ts` fetches NASA WMTS metadata server-side with one-day revalidation and fallback metadata.
- `web/src/components/map/forestLossLayer.ts` decodes forest-loss tiles in the browser.

`web/src/app/layout.tsx` owns global metadata, fonts, navigation, tour, footer, and language/theme boot scripts. Shared design tokens and theme styles live in `web/src/app/globals.css`. TypeScript uses strict mode and the `@/*` alias for `web/src/*`.
