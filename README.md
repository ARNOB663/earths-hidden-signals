# Earth's Hidden Signals

**Live site: https://earths-hidden-signals.vercel.app** · NASA Space Apps Challenge 2026 · challenge *Be An Earth System Trend Detective!*

Climate data usually stops at a chart. We turn 45 years of NASA records into answers a person can
use: **what is changing, where, by how much, and is it real**, for every land area on Earth and for
**any town you type in**. Then we show what that means for disasters, what NASA's climate projections
say comes next, and what to prepare for. Everything is in English and Bangla.

## What you can do

| Page | Question it answers |
|---|---|
| [Home](https://earths-hidden-signals.vercel.app) | The global story in five chapters: warming stripes for Earth's land, rain moving in opposite directions, disasters worldwide, a zoom into South Asia, and 2041–2060. |
| [Your place](https://earths-hidden-signals.vercel.app/your-place) | Type **any town on Earth**: its own warming stripes, the change since 1981, NASA projections for 2041–2060, floods, cyclones, droughts and landslides recorded within 300 km, and what to prepare for. Compare it with its **climate twin** elsewhere on Earth, and download the report as an image to share. |
| [Climate trends](https://earths-hidden-signals.vercel.app/trends) | A world map of trends for temperature and rain, with a detailed South Asia view: every square's rate, its 95% range, whether it is significant, and where its record turned. |
| [Disaster risk](https://earths-hidden-signals.vercel.app/hazards) | 14 disaster hotspots on every continent: recorded events, their climate trend, whether disasters follow the weather there, and the 2041–2060 outlook. South Asia's regions in full detail. |
| [Satellite map](https://earths-hidden-signals.vercel.app/explore) | NASA satellite and model imagery (ground heat, air temperature, rain, greenness, forest loss) month by month since 2000, with a compare slider. |
| [How it works](https://earths-hidden-signals.vercel.app/methods) | Data, statistics, cross-checks and limits, written to be checked. |

## What we found (1981–2025)

- **Hotter almost everywhere.** Earth's land warmed about **+1.5 °C** since 1981; about 3,850 of
  3,900 land areas warmed significantly and only 10 cooled.
- **The rain is moving both ways.** About 235 land areas got a clearly wetter rainy season and 216 a
  clearly drier one, under the same warming. In South Asia the Indus plain got wetter while the
  Bengal delta got drier.
- **Disasters follow the weather in some places, not others.** Floods in the Yangtze, Sahel and
  Indus plain and landslides in the Himalaya rise in wetter rainy seasons; Central Europe's and the
  Mississippi's floods do not, a reminder that rivers, land use and protection matter.
- **What comes next.** NASA's downscaled projections (six climate models) put Earth's land about
  **+1.7 °C** warmer by 2041–2060 than in 1995–2014 on a middle-road path (models: 1.1 to 2.4 °C), and
  +2.2 °C on a high-emissions path. Today's 1-in-10 hottest year would come almost every year on about
  half of all land on the middle road, and on 82% of land with high emissions.
- **An honest negative result.** A small machine-learning model could not tell disaster years from
  ordinary ones better than chance once tested properly, so we never turn projections into disaster odds.

## NASA data

- **Temperature:** NASA GISTEMP v4 (GISS)
- **Rainfall:** GPCP v2.3 monthly and 1DD daily (NASA GSFC / NOAA)
- **Projections:** NASA NEX-GDDP-CMIP6 (six models, SSP2-4.5 and SSP5-8.5), downloaded without a login
- **Satellite map:** NASA GIBS (MODIS land temperature and NDVI, MERRA-2 air temperature, GLDAS rain) and Landsat-based forest loss (Hansen/UMD)
- **Disasters:** NASA Global Landslide Catalog, NASA FIRMS fires (South Asia), GDACS floods, droughts and tropical cyclones, IBTrACS cyclone tracks
- **Arctic sea ice and CO₂ (home page):** NSIDC Sea Ice Index v4 (September extent) and NOAA GML global CO₂, tested with the same Mann–Kendall and Sen's slope
- **Independent cross-check:** CRU TS 4.10 (University of East Anglia)

## How we know a change is real

- Hamed–Rao Mann–Kendall test (corrected for year-to-year memory) for significance
- Sen's slope with a 95% confidence range for how much
- Benjamini–Hochberg false-discovery control on every map, so testing thousands of squares does not create false alarms
- Pettitt change-point test for where a record turns
- Every result repeated against an independent station-based record (CRU TS)
- Projections: each model compared only with its own 1995–2014 run; we report how many models agree
- When a change is not significant, the site says so plainly

## Run it

```bash
# website (all results are already committed in web/public/data)
cd web
npm install
npm run dev          # http://localhost:3000

# analysis (optional: regenerates the data; Python 3.10+)
cd analysis
pip install -r requirements.txt
python build.py && python build_hazards.py && python cyclones.py && python crosscheck.py && python latest.py
python turning.py                          # turning points
python cmip6_download.py && python future.py && python risk.py       # South Asia projections and model test
python twins.py && python global_trends.py                           # global trends, place data, twins
python global_signals.py                                             # Arctic sea ice and CO2 cards
python cmip6_download.py --global && python global_future.py && python global_hazards.py   # global projections and hotspots
python -m pytest -q                        # tests for the statistics and pipelines
```

No account or API key is needed for any step. [`AGENTS.md`](AGENTS.md) describes the code layout and data files.

This project shows evidence-based trends to help people prepare. It is **not** a disaster forecast;
always follow official warnings.
