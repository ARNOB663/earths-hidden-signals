# earths-hidden-signals

**Earth's Hidden Signals: decoding NASA data before disaster.** Our project for the NASA Space Apps Challenge 2026 challenge *Be An Earth System Trend Detective!*

The same global warming shows up differently across South Asia: heavier rain in some places, drying in others, more heat everywhere. We use NASA Earth observation data to show **what** is changing, **where**, **by how much**, and **whether the change is statistically significant**. Then we link those trends to the floods, landslides and wildfires that follow.

## What's inside

| Folder | What it is |
|---|---|
| [`web/`](web/) | Next.js + TypeScript website: Map Explorer (NASA GIBS imagery + Landsat forest loss) and Trend Analysis |
| [`analysis/`](analysis/) | Python pipeline: downloads NASA records, runs the trend tests, writes JSON for the website |

## Data

- **Temperature:** NASA GISTEMP v4 (GISS)
- **Rainfall:** GPCP v2.3 (NASA GSFC / NOAA)
- **Map imagery:** NASA GIBS, from MODIS land surface temperature, MODIS NDVI, MERRA-2 and GLDAS
- **Forest loss:** Hansen/UMD Global Forest Change, built from NASA/USGS Landsat

## Method

- Autocorrelation-corrected (Hamed–Rao) Mann–Kendall test for significance
- Sen's slope with a 95% confidence interval for the rate of change
- Benjamini–Hochberg false-discovery-rate control for the map-wide results

Details are in [`analysis/README.md`](analysis/README.md).

## Run it

```bash
# analysis (optional: results are already in web/public/data)
cd analysis
pip install -r requirements.txt
python build.py

# website
cd web
npm install
npm run dev    # http://localhost:3000
```

This project shows evidence-based trends to support preparedness. It is **not** a disaster prediction system.
