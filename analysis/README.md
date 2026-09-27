# Analysis pipeline

Turns NASA climate records into the trend results the website shows (`web/public/data/trends/`).

```bash
pip install -r requirements.txt
python -m pytest -q      # checks the statistics
python build.py          # downloads data (cached in raw/) and writes the JSON results
```

## Data

| Variable | Dataset | Grid | Why this one |
|---|---|---|---|
| Temperature | NASA GISTEMP v4 (GISS), anomalies vs 1951–1980 | 2° | NASA's official climate record; station data homogenized for long-term trends |
| Rainfall | GPCP v2.3 monthly (NASA GSFC-led, gauge + satellite) | 2.5° | Inputs inter-calibrated so the record stays consistent over time |

Study area: 5–38°N, 60–100°E, 1981–2025. No login is needed for either source.

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
