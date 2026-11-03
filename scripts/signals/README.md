# Signals pipeline — catalogue and how to run it

Status: **step 1 of 11** (plan rev. 7b, `.kilo/plans/1793705663794-signals-plan.md`).
Nothing here produces data yet. This file is the catalogue of record: every source, its tier,
auth, expected latency, failure mode and the date it was last checked.

Spike state on 2026-11-03:

- **PPS** (IMERG Late / Early GeoTIFF): reachable, basic auth `OK` for both products [V, user terminal].
- **Earthdata token**: valid against LANCE [V, user terminal].
- **GES DISC** (IMERG Final subset): **unreachable from two networks** — gate 0a/0b blocked, so the
  baseline is built from **IMERG Late via PPS** (fallback 1) with a GitHub-Actions build as
  fallback 2. Evidence: `spike_report.md` §5 and §10.
- **Outlook source**: Open-Meteo confirmed by the user; the spike still has to verify the endpoint.

## Sources

`checkedOn` is the date the link was last opened. `[V]` = opened successfully in this project;
`[M]` = not yet opened, the spike must verify it before the source is used.

### Tier A — build now

| ID | Source | Role | Link | Auth | Latency | Failure mode | checkedOn |
|---|---|---|---|---|---|---|---|
| A1 | IMERG Late (Early fallback), 1/3/7-day GeoTIFF | live rain | https://jsimpsonhttps.pps.eosdis.nasa.gov/imerg/gis/ | PPS basic | ~14 h | 401 → stop, `rejected`; missing day → Early fallback, ladder recorded | 2026-11-03 [V] |
| A1b | PPS registration | account | https://registration.pps.eosdis.nasa.gov/registration/ | none | — | n/a | 2026-11-03 [V] |
| A1c | IMERG product docs | reference | https://gpm.nasa.gov/data/imerg | none | — | n/a | 2026-11-03 [V] |
| A2 | IMERG Final daily V07 (`GPM_3IMERGDF`) | baseline candidate / cross-check / replay | https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDF_07/summary | Earthdata token | ~3.5 months, ends **2025-09-30** | GES DISC unreachable → Late baseline (fallback 1) | 2026-11-03 [V, status] |
| A2b | Earthdata Login | token | https://urs.earthdata.nasa.gov/ | none | — | expired → ask for a new token | 2026-11-03 [V] |
| A3 | GIBS WMTS (base + context layers) | map | https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml | none | ~1 day (IMERG rate layer) | absent layer → text alternative only | 2026-11-03 [V] |
| A3c | GIBS colormap for IMERG rate | legend | https://gibs.earthdata.nasa.gov/colormaps/v1.3/GPM_Precipitation_Rate.xml | none | — | 404 if the id is guessed → always read from GetCapabilities | 2026-11-03 [V] |
| A4 | LANCE `MCDWD_L3_NRT` flood water | flood water (beta, "not confirmed" when absent) | https://nrt3.modaps.eosdis.nasa.gov/archive/allData/61/MCDWD_L3_NRT/ | none | ~5–7 day retention | null line, never "no flood" | 2026-11-03 [V] |
| A5 | SMAP NRT soil moisture | **not integrated** | https://n5eil01u.ecs.nsidc.org/SMAP/SPL2SMP_NRT.107/ | Earthdata token | n/a | unreachable on 2026-11-03 [V] | 2026-11-03 [V, failed] |
| A7 | GDACS — the **only working historical** catalogue | replay/backtest events | https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH | none | ~1 day | non-JSON for wide windows → query in ≤ 3-month chunks, retry once | 2026-11-03 [V] |
| A7b | WMO SWIC | one official-warning link | https://severeweather.wmo.int/ | none | — | link-out only | 2026-11-03 [V] |
| A7c | Open-Meteo geocoding | submit-only place search | https://geocoding-api.open-meteo.com/v1/search | none | — | no match → coordinates only; CC-BY 4.0 attribution | 2026-11-03 [V] |
| A7d | Open-Meteo forecast | **7-day outlook, external, never in the status** | https://api.open-meteo.com/v1/forecast | none | hourly model | unavailable → outlook omitted, `/accuracy` says so | [M] verify in step 2 |

### Tier B — probe only, adopt only with approval

| ID | Source | Possible role | checkedOn |
|---|---|---|---|
| B1 | EONET v3 | live cross-check of recent events (closed floods cover ~1 month only [V]) | 2026-11-03 [V] |
| B2 | OPERA DSWx | radar flood extent for replay proof | 2026-11-03 [V, 403 to non-browser clients] |
| B3 | NASADEM | low-lying terrain info line | 2026-11-03 [V] |
| B4 | SEDAC GPWv4 | people exposed (info only) | 2026-11-03 [V, timed out] |
| B5 | NASA POWER | spike-only scale check of IMERG values | 2026-11-03 [V] |
| T | GHCN-Daily (NCEI) | independent station check | 2026-11-03 [V] |

### Tier C — roadmap text only

LHASA / Global Landslide Catalog · GLDAS / NLDAS / MERRA-2 · TRMM TMPA · SWOT · Black Marble ·
GRACE-FO · SMAP NRT numeric averages · GFMS (unverified) · IMERG V08 Final · MODIS→VIIRS flood
migration.

### Not used

NASA Disasters Mapping Portal IMERG ImageServer (404 [V]) · PMM Publisher API · the site's existing
GISTEMP/GPCP/FIRMS data.

## Running the spike (still the only command)

```
python3 scripts/signals/spike.py --check-links
python3 scripts/signals/spike.py --check-auth
python3 scripts/signals/spike.py --gdacs
python3 scripts/signals/spike.py --eonet
python3 scripts/signals/spike_imerg_probe.py --point 23.81,90.41 --window 2024-07-01/2024-07-31
python3 -m pytest -q scripts/signals/tests
```

Fixtures used by the tests live in `scripts/signals/tests/fixtures/` (small, committed cuts of
the real responses). `scripts/signals/raw/`, `derived/` and `logs/` are gitignored.

## Folder rules

- `scripts/signals/baseline/` — committed compact daily series (budget 25 MB total, 8 MB per tile);
  the CI runner has no `derived/`, so this folder is the source of truth.
- `web/public/data/signals/` — committed outputs (`grid/`, `evidence/`, `replay/`, `archive/`,
  `demo/`); size budgets are enforced by the pipeline.
- No country names, country folders or country-specific thresholds anywhere in this tree.

## Step 2 — what exists and what you must run

Files: config.json (thresholds, three launch tiles, budgets), tiles.py (registry and grid maths),
imerg.py (Late/Early GeoTIFF reader), auth.py, outlook.py, run.py.

Encoding asserted from the public IMERG GIS readme (checked 2026-11-03), not from memory:
Early/Late value = **mm x 10**, missing = **29999**, 0.1 deg, 1800x3600, north-up, NW corner 90N 180W.
`run.py --check-readme` re-fetches README.GIS when credentials are set and aborts on any mismatch.

Commands (from the repo root):

```
python3 scripts/signals/run.py --check-auth
python3 scripts/signals/run.py --check-readme
python3 scripts/signals/run.py --check-outlook
python3 scripts/signals/run.py --time-one-day bengal --lag-days 3
```

The last one downloads exactly **one day of one tile**, prints bytes, seconds, valid fraction and the
projected total at 1/4/8 workers, and exits 3 **before any bulk run** if the projection exceeds
30 minutes per tile.

Tests need tifffile:

```
cd scripts/signals && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q tests
```

Outlook source verified 2026-11-03: Open-Meteo at api.open-meteo.com/v1/forecast returns seven daily
precipitation_sum values, CC-BY 4.0, no key, and every stored payload carries usedInStatus: false.

## Per-place payloads (Before / Now / Next / Trust / Action)

`place.py` turns the committed files into the place record the website reads. It needs no network,
so it is safe to run in CI and its output is byte-stable:

    python place.py            # places.json + places-map/{ISO}.json + index.json

It runs from `analysis/.venv` (it imports `numpy` and `shapely`) and reads:

* `web/public/data/trends/*.json` — the analysis pipeline's own Sen slope and 95% interval, averaged
  over the grid cells whose centre lies inside each administrative boundary (Before, Trust).
* `web/public/data/signals/grid/*.json` — the engine's cells for the tile containing the area (Now).
* `analysis/raw/geoboundaries/{ISO}/ADM1|ADM2.geojson` — the boundary itself.

Optional network step, never part of the offline build:

    python place.py --refresh  # places/{area}.json: Open-Meteo 7-day outlook (Next) and the
                               # historical rain archive + GDACS flood years (Evidence)

The map's trend background (`web/public/data/signals/south-asia/`) is built offline from the
committed trend files by `python scripts/signals/build_south_asia.py` (repo root, analysis venv);
it draws the analysis cells at their own spacing, so the grid stays visible as a grid.

Cached downloads live in `scripts/signals/raw/places/` (gitignored). The refresh step resumes, so an
interrupted run continues where it stopped. `test_place.py` checks the Trust rule, the five strips and
the byte-identical rebuild.
