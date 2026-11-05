# Data Source Catalog

Source, format, geographic and temporal coverage, resolution, licence, freshness and current usage
for every dataset in [`RESOURCE_INVENTORY.md`](RESOURCE_INVENTORY.md). Values are taken from the code
that consumes each dataset (`analysis/*.py`, `scripts/signals/*.py`, `web/src/lib/layers.ts`) and from
the committed metadata (`intelligence/sources.json`, `signals/provenance.json`,
`geography/license.json`). Where a value is not recorded in the repository it is marked **unrecorded**
rather than guessed.

Freshness rule: `intelligence/sources.json` records `retrievedAt` (last download), `checkedAt` (last
link check), `observedThrough` per product and `ageDays` vs `expectedLagDays`. Only GISTEMP, GPCP
monthly, GPCP 1DD, FIRMS, GDACS and IBTrACS are marked `stale: true` at the last check (2026-10-31);
CRU TS and the Global Landslide Catalog are not.

## Observational climate records

### D1 — NASA GISTEMP v4

*Register id: `gistemp` (`intelligence/sources.json`).*

| Field | Value |
|---|---|
| Source | NASA Goddard Institute for Space Studies |
| URL | `https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz` |
| Format | NetCDF4, gridded monthly temperature anomaly |
| Geographic coverage | Global; project reads 5–38°N, 60–100°E (South Asia box) |
| Temporal coverage | 1880–present; project uses 1981–2025 plus 1951–1980 baseline |
| Resolution | 2° × 2° monthly |
| Baseline | 1951–1980 anomalies (product native) |
| Licence | **unrecorded in repo** — GISTEMP is a US Government (NASA) product, public domain; verify |
| Freshness | Product monthly, ~20-day expected lag; last `retrievedAt` 2026-09-29, `stale: true` |
| Current usage | Temperature trends, very-hot-months, basin sea warmth, `latest.json`, intelligence, backtest context |
| Limitations | 2° grid smooths local extremes; anomalies not absolute temperature; ocean + homogenised station mix |

### D2 — GPCP v2.3 monthly precipitation

*Register id: `gpcp-monthly` (`intelligence/sources.json`).*

| Field | Value |
|---|---|
| Source | NASA GSFC-led / NOAA NCEI archive |
| URL | `https://www.ncei.noaa.gov/data/global-precipitation-climatology-project-gpcp-monthly/access` |
| Format | NetCDF, monthly mean rate |
| Geographic coverage | Global; 5–38°N, 60–100°E used |
| Temporal coverage | 1979–present; project uses 1981–2025 |
| Resolution | 2.5° monthly; `precip` in mm/day |
| Baseline | 1991–2020 (`analysis/intel/thresholds.py::BASELINE_ID`) |
| Licence | **unrecorded in repo** — NOAA/NASA open archive; verify terms |
| Freshness | ~90-day expected lag; `stale: true` |
| Current usage | Rainfall trends/totals, `latest.json`, intelligence rainfall, backtest screen rain (tile mean) |
| Limitations | 2.5° monthly cannot resolve individual storms; gauge+satellite product so regional bias possible |

### D3 — GPCP 1DD v1.3 daily precipitation

*Register id: `gpcp-daily` (`intelligence/sources.json`).*

| Field | Value |
|---|---|
| Source | NASA GSFC-led; NCEI daily files |
| Format | NetCDF per day, one daily file per global day |
| Geographic coverage | Global; South Asia box stored as yearly `.npz` |
| Temporal coverage | From October 1996; project uses the 24 full baseline years 1997–2020 for daily indicators |
| Resolution | 1° daily |
| Baseline | 1997–2020 (`DAILY_BASELINE_ID`) |
| Licence | **unrecorded in repo** — verify |
| Freshness | `stale: true` at last check |
| Current usage | Heavy-rain days (≥95th percentile), longest dry spells, wettest day |
| Limitations | Product scaled to GPCP monthly, so daily values are not independent of D2; 1° limits cell-level extremes |

### D4 — CRU TS 4.10 (University of East Anglia)

*Register id: `cru-ts` (`intelligence/sources.json`).*

| Field | Value |
|---|---|
| Source | Climatic Research Unit, UEA |
| URL | `https://crudata.uea.ac.uk/cru/data/hrg/cru_ts_4.10/` |
| Format | NetCDF (`tmp`, `pre`) 0.5° land |
| Geographic coverage | Global land; 5–38°N, 60–100°E used |
| Temporal coverage | 1901–present used for the same 1981–2025 window |
| Resolution | 0.5° monthly |
| Licence | **unrecorded in repo** — CRU data terms apply; verify before redistribution |
| Freshness | `stale: false` at last check |
| Current usage | Independent cross-check of GISTEMP/GPCP trends (`trends/crosscheck.json`), intelligence confidence |
| Limitations | Land only; shares input station family with GISTEMP, so agreement validates processing not raw observations |

## Hazard-event records

### D5 — NASA FIRMS MODIS active fires (C6.1)

*Register id: `firms-modis` (`intelligence/sources.json`).*

| Field | Value |
|---|---|
| Source | NASA FIRMS (Terra + Aqua MODIS) |
| URL | `https://firms.modaps.eosdis.nasa.gov/data/country/modis/{year}/modis_{year}_{country}.csv` |
| Format | Per-country, per-year CSV |
| Geographic coverage | 7 South Asia countries |
| Temporal coverage | 2003–2024 (both satellites flying) |
| Resolution | Per-detection; aggregated to per-country-per-year counts |
| Licence | **unrecorded in repo** — NASA FIRMS terms; verify |
| Freshness | `stale: true` at last check |
| Current usage | Wildfire event record; detrended Spearman link to pre-monsoon heat/dryness in `hazards/zones.json` |
| Limitations | Detections not fire events; sensor overpass sampling; record ends 2024 |

### D6 — NASA Global Landslide Catalog (2007–2017 export)

*Register id: `nasa-glc` (`intelligence/sources.json`).*

| Field | Value |
|---|---|
| Source | NASA Goddard |
| URL | `https://data.nasa.gov/docs/legacy/Global_Landslide_Catalog_Export/Global_Landslide_Catalog_Export_rows.csv` |
| Format | CSV rows (date, coordinates, trigger, fatalities) |
| Geographic coverage | Global media-reported; study box filtered |
| Temporal coverage | 2007–2017 |
| Resolution | Point events |
| Licence | **unrecorded in repo** — NASA open data; verify |
| Freshness | Not `stale` (archive closed in 2017) |
| Current usage | Landslide event record; monsoon-rain link |
| Limitations | News-based, so reporting density biases counts; ends 2017 |

### D7 — GDACS flood alerts (UN/EU)

*Register id: `gdacs` (`intelligence/sources.json`).*

| Field | Value |
|---|---|
| Source | Global Disaster Alert and Coordination System |
| URL | `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH` |
| Format | JSON search response, queried in ≤3-month chunks |
| Geographic coverage | Global; study box filtered (725 records committed) |
| Temporal coverage | 2000–present |
| Resolution | Point events with alert level and start/end |
| Licence | **unrecorded in repo** — GDACS terms (reference required); verify |
| Freshness | `stale: true`; a missing year is a catalogue gap, not a year without floods |
| Current usage | Backtest episodes, Evidence, frequency denominators, official-alert layer |
| Limitations | Level-1 alerts only in the catalogue; alert levels reflect impact estimates, not measurements; detection changes over time |

### D8 — IBTrACS v04r01 (North Indian basin)

*Register id: `ibtracs` (`intelligence/sources.json`).*

| Field | Value |
|---|---|
| Source | NOAA NCEI; tracks from IMD/JTWC |
| Format | CSV tracks |
| Geographic coverage | Bay of Bengal + Arabian Sea |
| Temporal coverage | 1981–2025 |
| Resolution | 6-hourly track points, max wind |
| Licence | **unrecorded in repo** — NOAA open data; verify |
| Freshness | `stale: true` |
| Current usage | Cyclone event record; basin sea-surface-warmth test |
| Limitations | Pre-satellite era track quality varies; basins AS/BB only |

## Geography

### D9 — geoBoundaries gbOpen

| Field | Value |
|---|---|
| Source | geoBoundaries (Runfola et al. 2020, PLOS ONE) |
| URL | `https://www.geoboundaries.org/` release `9469f09` |
| Format | GeoJSON geometry + `.dbf` attribute table |
| Geographic coverage | 231 countries/territories (ADM0), ADM1 in 198, ADM2 in 179 |
| Temporal coverage | Per-boundary represented year (2007–2023), recorded per file |
| Resolution | Administrative units |
| Licence | **Recorded per file** in `geography/license.json` — CC BY 4.0, Public Domain, etc. |
| Freshness | Pinned release; rebuilt only when the release changes |
| Current usage | Every area name, ID and boundary; coverage measurement; map outlines |
| Limitations | No weather data; area-level aggregation only |

## Rainfall Signal inputs

### D10 — NASA IMERG Late / Early (PPS GeoTIFF)

| Field | Value |
|---|---|
| Source | NASA GPM / PPS |
| URL | `https://jsimpsonhttps.pps.eosdis.nasa.gov/imerg/gis` (PPS basic auth) |
| Format | GeoTIFF, accumulation ×10, missing = 29999 |
| Geographic coverage | Global 0.1° (1800×3600) |
| Temporal coverage | Late/Early V07B/V07C present; **no real window committed** |
| Resolution | 0.1°, 1/3/7-day windows |
| Baseline | IMERG Late, ≥15 years, ≥300 values per cell |
| Licence | **unrecorded in repo** — NASA open data; verify |
| Freshness | `signals/sources.json` → `imerg-late: {sample: true, status: "sample"}` |
| Current usage | Signal grid (`signals/grid/*`), **sample mode only** |
| Limitations | Currently synthetic sample, never described as observation; version mixing forbidden within one window |

### D11 — Open-Meteo forecast (7-day outlook)

| Field | Value |
|---|---|
| Source | Open-Meteo |
| URL | `https://api.open-meteo.com/v1/forecast` |
| Format | JSON |
| Geographic coverage | Per-area centre |
| Temporal coverage | 7 days ahead |
| Resolution | Daily |
| Licence | CC BY 4.0 (attribution required) |
| Freshness | Hourly model; fetched only on `--refresh` |
| Current usage | `places/{id}.json` `next`, `brief.outlook`; **never used in status** (`usedInStatus: false`), not eligible for outlook until evidence gates pass |
| Limitations | Different product from IMERG; external; must always be labelled external |

### D12 — Open-Meteo historical archive

| Field | Value |
|---|---|
| Source | Open-Meteo (reanalysis-derived) |
| URL | `https://archive-api.open-meteo.com/v1/archive` |
| Format | JSON per area |
| Geographic coverage | Per-area centre |
| Temporal coverage | Past complete years |
| Resolution | Daily / yearly totals |
| Licence | CC BY 4.0 |
| Freshness | Refreshed by `place.py --refresh` |
| Current usage | Frequency cases per area, Evidence strip |
| Limitations | Not IMERG; a different product family, so it cannot validate the Signal grid |

### D13 — Open-Meteo geocoding

| Field | Value |
|---|---|
| Source | Open-Meteo |
| URL | `https://geocoding-api.open-meteo.com/v1/search` |
| Format | JSON |
| Coverage | Global place names |
| Licence | CC BY 4.0 |
| Current usage | Submit-only place search; no match → coordinates only |
| Limitations | Name collisions; no boundary disambiguation |

## Map imagery

### D14 — NASA GIBS WMTS

Six layers defined in `web/src/lib/layers.ts`:

| Layer id | GIBS identifier | Mission | Resolution / cadence | Source page |
|---|---|---|---|---|
| `lst-day` | `MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day` | MODIS · Terra | Monthly, Level 6 tiles | `lpdaac.usgs.gov/products/mod11c3v061/` |
| `air-temp` | `MERRA2_2m_Air_Temperature_Monthly` | MERRA-2 · GMAO | Monthly | `gmao.gsfc.nasa.gov/reanalysis/MERRA-2/` |
| `precip` | `GLDAS_Surface_Total_Precipitation_Rate_Monthly` | GLDAS · Noah | Monthly | `ldas.gsfc.nasa.gov/gldas` |
| `soil-moisture` | `SMAP_L4_Analyzed_Root_Zone_Soil_Moisture` | SMAP · JPL | Monthly | `smap.jpl.nasa.gov/` |
| `ndvi` | `MODIS_Terra_L3_NDVI_Monthly` | MODIS · Terra | Monthly | `lpdaac.usgs.gov/products/mod13c2v061/` |

| Field | Value |
|---|---|
| Format | WMTS PNG tiles, EPSG:3857 |
| Coverage | Global |
| Temporal coverage | Per layer; catalog read at runtime (1-day revalidation) |
| Licence | **unrecorded in repo** — NASA open data; cite GIBS |
| Freshness | Catalog queried live; 1-day revalidate; `fallbackTimes` if unreachable |
| Current usage | **Dormant** — Map Explorer has no current route |
| Limitations | Pre-rendered colours, not raw values; a coarse visual context layer only |

### D15 — Hansen/UMD Global Forest Change v1.13

| Field | Value |
|---|---|
| Source | Hansen et al., built from NASA/USGS Landsat; tiles via Global Forest Watch |
| URL | `https://tiles.globalforestwatch.org/umd_tree_cover_loss/v1.13/dynamic/{z}/{x}/{y}.png` |
| Source page | `https://glad.earthengine.app/view/global-forest-change` (as defined in `layers.ts`) |
| Format | Encoded PNG tiles decoded client-side |
| Coverage | Global; 2001–2025 |
| Licence | **unrecorded in repo** — CC BY 4.0 (Hansen et al.); verify |
| Frequency | Annual product |
| Current usage | **Dormant** with Map Explorer |
| Limitations | 30 m annual loss, not live; encoded values need the decoder in `forestLossLayer.ts` |

## Probed, not integrated

These appear in `scripts/signals/README.md` and `spike_report.md` as measured candidates; none has a
committed output. They are retained as documented research, not as live dependencies.

| Source | Role in the catalogue | Outcome |
|---|---|---|
| IMERG Final V07 (`GPM_3IMERGDF`) | Baseline/replay candidate | GES DISC unreachable; Late used instead |
| Earthdata Login | Token for GES | Valid against LANCE at last check |
| LANCE `MCDWD_L3_NRT` flood water | Flood water (beta) | Not integrated; ~5–7 day retention |
| SMAP NRT soil moisture | Context | Unreachable 2026-11-03 |
| EONET v3 | Recent-event cross-check | Closed floods cover ~1 month only |
| OPERA DSWx | Radar flood extent | 403 to non-browser clients |
| NASADEM | Terrain info line | Not integrated |
| SEDAC GPWv4 | Population exposed | Timed out |
| NASA POWER / MERRA-2 | Scale check of IMERG | Rejected as a trend source (jumps ~1997/2015) |
| GHCN-Daily | Station check | Not a grid truth: differs from POWER (zeros) |
| WMO SWIC | Official-warning link-out | Link only, no data |

## Licence and attribution status

Fully recorded: D9 (per boundary, machine-readable) and the attribution text on `/methods`.
Unrecorded in the repository: D1–D8, D10–D16. Every source is public and open, but the exact licence
text is not yet captured. **Phase 3 (§3 of the plan) must record each licence and attribution before
any dataset is presented as redistributable.** `/methods` already credits GISTEMP, GPCP, GIBS,
Hansen/UMD, FIRMS, GLC, GDACS and geoBoundaries in prose.
