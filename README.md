# earths-hidden-signals

**Live site: https://earths-hidden-signals.vercel.app**

**Earth's Hidden Signals: decoding NASA data before disaster.** Our project for the NASA Space Apps Challenge 2026 challenge *Be An Earth System Trend Detective!*

The same global warming shows up differently across South Asia: heavier rain in some places, drying in others, more heat everywhere. We use NASA Earth observation data to show **what** is changing, **where**, **by how much**, and **whether the change is statistically significant**. Then we link those trends to the floods, landslides and wildfires that follow.

## What's inside

| Folder | What it is |
|---|---|
| [`web/`](web/) | Next.js + TypeScript website: Home, Signal (search, map, coverage, Watch Level, historical frequency), Gap, Replay, Accuracy, Act, Watch, plus Climate Trends (trend map, per-region and per-square Mann–Kendall / Sen's slope results), Climate Twins (places worldwide with the same trend fingerprint and the disasters they recorded), Methods and For Organizations |
| [`analysis/`](analysis/) | Python pipeline: downloads NASA records, runs the trend tests, writes JSON for the website |

AGENTS.md (root) is the authoritative guide to the code layout, commands and data contracts. The
audit and cleanup notes are in [`docs/CODEBASE_AUDIT.md`](docs/CODEBASE_AUDIT.md) and the resource
inventory in [`docs/RESOURCE_INVENTORY.md`](docs/RESOURCE_INVENTORY.md). `CLAUDE.md` points at
`AGENTS.md`.

## Data

- **Temperature:** NASA GISTEMP v4 (GISS)
- **Rainfall:** GPCP v2.3 (NASA GSFC / NOAA)
- **Hazard events:** NASA FIRMS MODIS fires, NASA Global Landslide Catalog, GDACS flood alerts
- **Administrative geography (Signal):** geoBoundaries `gbOpen` boundaries — **every** published
  ADM0 country/territory (231 at the current release), plus ADM1 and ADM2 wherever the source
  publishes them (198 and 179 countries respectively). Geography only: no weather data, no scores.
  Each file's boundary ID, year, licence and upstream source is recorded. Unit names come from the
  file's `.dbf` attribute table, not the multi-gigabyte geometry.

Each Signal's **Watch Level** (how unusual today's rain is against the same date in the area's own
record), **Data Trust Grade** and **historical flood frequency** are computed from the committed
datasets. The daily rain readings themselves are currently **fixed samples** (`sample: true`), not
live IMERG observations, and every surface that shows them says so. Coverage counts, historical case
sizes and the Accuracy backtest are computed from real datasets.

The global directory is split so the page stays light: `geography/index.json` plus
`signals/areas/{ISO}.json` (one file per country, fetched when a country is opened) and
`signals/area-search.json` (a compact name/signal index fetched on the first search). Per-boundary licences are recorded in
`web/public/data/geography/license.json`; dataset credits are in
`web/public/data/signals/provenance.json`.

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
python twins.py                  # Climate Twins: global trend fingerprints + GDACS / landslide records

# website
cd web
npm install
npm run dev    # http://localhost:3000
```

This project shows evidence-based trends to support preparedness. It is **not** a disaster prediction system.
