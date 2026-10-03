# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Before changing code under `web/`, read `web/AGENTS.md`. It requires consulting the relevant bundled Next.js 16 documentation under `web/node_modules/next/dist/docs/`. `web/CLAUDE.md` imports that file.

### Analysis pipeline

Run these commands from `analysis/`:

```bash
pip install -r requirements.txt
python -m pytest -q
python -m pytest -q test_stats.py
python -m pytest -q test_stats.py::test_clear_trend_is_significant_with_correct_rate
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
```

`build_hazards.py` depends on trend output from `build.py`. `latest.py` also requires `build.py` output. See `analysis/README.md` for source-specific setup and pipeline details.

## Architecture and data flow

```text
NASA / NOAA / CRU / GDACS / IBTrACS sources
    -> analysis/raw/ cache
    -> Python source loaders
    -> analysis/stats.py
    -> build.py / build_hazards.py / cyclones.py / crosscheck.py / latest.py
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
- `analysis/zones.json` defines geographic regions shared by trend and hazard builds.

Primary outputs are `web/public/data/trends/`, `web/public/data/hazards/`, and `web/public/data/latest.json`.

### Web application

App Router entry points live under `web/src/app/`. Main routes are the landing page, `/explore`, `/trends`, `/hazards`, `/findings`, `/methods`, and statically generated `/places/[id]` reports. Place routes use `dynamicParams = false`, so new place IDs must be included in static generation.

Map-heavy client components use dynamic Leaflet imports with SSR disabled. Explorers keep filters and selections in URL query parameters.

Data responsibilities are split as follows:

- `web/src/lib/data.ts` reads committed JSON on the server with Node file APIs and provides cached loaders.
- `web/src/lib/placeReport.ts` assembles place reports server-side from trend and event data.
- `web/src/lib/trends.ts`, `hazards.ts`, and `places.ts` hold domain types, metadata, and geographic helpers.
- `web/src/lib/locale.ts` provides English/Bangla translations. `web/src/contexts/LanguageContext.tsx` exposes language state to client components.
- Large trend and hazard detail files are fetched by client components from `/data/...` when needed.
- `web/src/lib/layers.ts` defines live NASA GIBS and Global Forest Watch map layers. These are separate from the precomputed analysis datasets.
- `web/src/lib/gibs.ts` fetches NASA WMTS metadata server-side with one-day revalidation and fallback metadata.
- `web/src/components/map/forestLossLayer.ts` decodes forest-loss tiles in the browser.

`web/src/app/layout.tsx` owns global metadata, fonts, navigation, tour, footer, and language/theme boot scripts. Shared design tokens and theme styles live in `web/src/app/globals.css`. TypeScript uses strict mode and the `@/*` alias for `web/src/*`.
