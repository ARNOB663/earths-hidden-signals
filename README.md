# earths-hidden-signals

**Live site: https://earths-hidden-signals.vercel.app**

**Earth's Hidden Signals: decoding NASA data before disaster.** Our project for the NASA Space Apps Challenge 2026 challenge *Be An Earth System Trend Detective!*

The same global warming shows up differently across South Asia: heavier rain in some places, drying in others, more heat everywhere. We use NASA Earth observation data to show **what** is changing, **where**, **by how much**, and **whether the change is statistically significant**. Then we link those trends to the floods, landslides and wildfires that follow.

## What's inside

| Folder | What it is |
|---|---|
| [`web/`](web/) | Next.js + TypeScript website: Overview, Signals, Map Explorer (NASA GIBS imagery + Landsat forest loss), Trend Analysis, Hazard Signals, Methods |
| [`analysis/`](analysis/) | Python pipeline: downloads NASA records, runs the trend tests, writes JSON for the website |

## Data

- **Temperature:** NASA GISTEMP v4 (GISS)
- **Rainfall:** GPCP v2.3 (NASA GSFC / NOAA)
- **Map imagery:** NASA GIBS, from MODIS land surface temperature, MODIS NDVI, MERRA-2 and GLDAS
- **Forest loss:** Hansen/UMD Global Forest Change, built from NASA/USGS Landsat
- **Hazard events:** NASA FIRMS MODIS fires, NASA Global Landslide Catalog, GDACS flood alerts
- **Administrative geography (Signals):** geoBoundaries `gbOpen` boundaries — **every** published
  ADM0 country/territory (231 at the current release), plus ADM1 and ADM2 wherever the source
  publishes them (198 and 179 countries respectively). Geography only: no weather data, no scores.
  Each file's boundary ID, year, licence and upstream source is recorded. Unit names come from the
  file's `.dbf` attribute table, not the multi-gigabyte geometry.

The Signals page's Signal codes and percentages are **fixed demo scores**, stored in
`web/public/data/signals/demo-scores.json` and labelled DEMO / SIMULATED. They are not predictions,
measurements or alerts, and no model accuracy is claimed. The illustrative bands are Green below
50%, Yellow 50% to below 75%, Red 75% or above. Data coverage per area is measured from the NASA
analysis grids (`analysis/build_signal_scores.py`) and is reported separately as "N of 6 layers"
plus the share of those layers' grid cells carrying data. Those grids cover South Asia only
(60–100°E, 5–38°N), so coverage exists for 6 countries and 59 ADM1 areas; every other country and
area is shown as **No data**, never as Green or safe.

The global directory is split so the page stays light: `geography/index.json` plus
`signals/areas/{ISO}.json` (one file per country, fetched when a country is opened) and
`signals/area-search.json` (a compact name/signal index fetched on the first search). Per-boundary licences are recorded in
`web/public/data/geography/license.json`; dataset credits for the Signals page are in
`web/public/data/signals/provenance.json` (the legacy rain-signal `sources.json` keeps its own shape
for `/about` and `/watch`).

## Method

- Autocorrelation-corrected (Hamed–Rao) Mann–Kendall test for significance
- Sen's slope with a 95% confidence interval for the rate of change
- Benjamini–Hochberg false-discovery-rate control for the map-wide results

Details are in [`analysis/README.md`](analysis/README.md).

## Key findings (1981–2025)

- **Warming everywhere:** all 234 land cells warmed significantly, by about +0.31 °C per decade (+1.4 °C since 1981).
- **Monsoon rain splits:** the Indus plain got wetter, while the Bengal delta, Central Himalaya, Western Ghats and Northeast hills got drier. Most cells show no detectable trend.
- **2025 preparedness signals:** Indus plain floods and Western Himalaya landslides. In both regions, 2025 monsoon rain resembles past high-event years (evidence for readiness, not a forecast).

## Run it

```bash
# analysis (optional: results are already in web/public/data)
cd analysis
pip install -r requirements.txt
python build.py
python build_geography.py        # geoBoundaries gbOpen boundaries (network; then --offline)
python build_signal_scores.py    # Signals coverage and demo scores
python build_hazards.py

# website
cd web
npm install
npm run dev    # http://localhost:3000
```

This project shows evidence-based trends to support preparedness. It is **not** a disaster prediction system.
