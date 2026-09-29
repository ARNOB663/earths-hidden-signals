# Analysis pipeline

Turns NASA climate records into the trend results the website shows (`web/public/data/trends/`).

```bash
pip install -r requirements.txt
python -m pytest -q      # checks the statistics
python build.py          # trends: temperature, rainfall and the extremes (downloads data, cached in raw/)
python build_hazards.py  # floods, landslides, wildfires
python cyclones.py       # cyclones (adds to the hazard results)
python crosscheck.py     # repeats the key trends with CRU TS, an independent record
python latest.py         # the latest month compared with normal (home page)
```

## Data

| Variable | Dataset | Grid | Why this one |
|---|---|---|---|
| Temperature | NASA GISTEMP v4 (GISS), anomalies vs 1951–1980 | 2° | NASA's official climate record; station data homogenized for long-term trends |
| Rainfall | GPCP v2.3 monthly (NASA GSFC-led, gauge + satellite) | 2.5° | Inputs inter-calibrated so the record stays consistent over time |

Study area: 5–38°N, 60–100°E, 1981–2025. No login is needed for any source.

**Extremes** (whole year only):

| Measure | Definition | Data |
|---|---|---|
| Very hot months | Months at least 1 °C warmer than the 1951–1980 average for that month | GISTEMP |
| Very heavy rain days | Days wetter than the local 95th percentile of rainy days (≥ 1 mm), 1997–2025 | GPCP 1DD v1.3 daily, 1° |
| Wettest day of the year | The most rain on a single day | GPCP 1DD |
| Longest monsoon dry spell | Longest run of days under 1 mm in June–September | GPCP 1DD |

**Independent check:** `crosscheck.py` repeats the regional temperature and rainfall trends with CRU TS 4.10 (University of East Anglia, 0.5°, station-based). Warming agrees in every region. For rain, the two records agree on the Indus plain (wetter) and on the Bengal delta and Northeast hills (drier), but not for every mountain region.

**Rejected:** NASA POWER (MERRA-2) rainfall and soil moisture. Its South Asia rainfall jumps by about 50% in 1997 and again after 2015 (for example, Bengal-delta rainfall goes from about 1,200 mm/yr to about 3,000 mm/yr). Those jumps come from changes in the dataset, not real rain, so its trends would be wrong. POWER is still used for its land mask (`power.py`).

## Method (`stats.py`)

- **Significance:** Hamed–Rao modified Mann–Kendall test. It corrects for years that are not independent of each other (autocorrelation), which otherwise inflates false positives. It falls back to the standard test when the correction is invalid.
- **Rate:** Sen's slope with a 95% confidence interval (Gilbert 1987).
- **Map-wide check:** Benjamini–Hochberg false discovery rate, α_FDR = 0.10 (Wilks 2016), so about 5% of map cells don't show up as "significant" by chance.
- **Seasons:** whole year, pre-monsoon (Mar–May), monsoon (Jun–Sep). Temperature uses seasonal means and rainfall uses seasonal totals.
- **Regions** (`zones.json`): approximate boxes around hazard landscapes. Region averages weight each cell by its land share, the share of the cell inside the box, and cos(latitude).

## Output

- `manifest.json`: grids, variables, seasons, method, and map-wide summaries
- `{variable}_{season}.json`: per-cell slope per decade, 95% CI, p-value, FDR flag and mean (row-major, south→north, west→east)
- `{variable}_{season}_series.json`: per-cell yearly values (loaded when a cell is clicked)
- `zones.json`: region-average series and trends

## Hazard signals (`build_hazards.py`, run after `build.py`)

| Hazard | Event record | Years | Driver tested |
|---|---|---|---|
| Wildfire | NASA FIRMS MODIS (Terra + Aqua) vegetation fires, confidence ≥ 30, Mar–May | 2003–2024 | Pre-monsoon temperature (higher) and rainfall (lower) |
| Landslide | NASA Global Landslide Catalog (news reports), Jun–Sep | 2007–2017 | Monsoon rainfall (higher) |
| Flood | GDACS flood alerts (UN/EU) within 1° of the region | 2000–2025 | Monsoon rainfall (higher) |
| Cyclone | IBTrACS v04r01 North Indian basin, storms ≥ 34 knots, by basin (Bay of Bengal, Arabian Sea) | 1981–2025 | Sea-surface warmth in the cyclone seasons, from GISTEMP ocean cells (higher) |

For each region:
1. **Event trend** (fires only; the other records are too short): Mann–Kendall + Sen's slope.
2. **Link to climate:** Spearman correlation between yearly event counts and the driver, after removing each series' long-term trend, so two things that both drift over time don't look linked. A link counts only if p < 0.05 and it points in the physically expected direction.
3. **Preparedness signal:** only where a link exists. It compares the latest year's driver percentile (within 1981–2025) with the average percentile in the top-25% event years. This is a comparison with history, **not a forecast**.

Caveats: news-based landslide reports under-count remote areas, MODIS overpass times drifted after about 2020, and GDACS coverage improved over time.

Outputs in `web/public/data/hazards/`: `zones.json`, `landslides.json`, `floods.json`, `fires_grid.json`.
