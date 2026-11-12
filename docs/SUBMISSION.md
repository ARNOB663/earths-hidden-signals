# Space Apps 2026 submission text

Ready to paste into the project submission form. Everything is in English, as the rules require.
Re-check against the official 2026 Project Submission Guide when it is published (expected Nov 13).
Fill in the parts in [brackets].

---

## Project name
Earth's Hidden Signals

## Challenge
Be An Earth System Trend Detective!

## Links
- **Final project:** https://earths-hidden-signals.vercel.app
- **Code:** https://github.com/ARNOB663/earths-hidden-signals
- **Demo (30-second video or ≤ 7 slides):** [link]

## High-level summary
*What did you develop? How does it solve the challenge? Why is it important?*

Earth's Hidden Signals is a free website that answers four questions about Earth's climate: what is
changing, where, by how much, and is the change real? It runs every land area on Earth through 45
years of NASA records (1981–2025) and tests each trend statistically. It only calls a change "clear"
when chance is an unlikely explanation, and it says so plainly when a change is not yet clear.

Anyone can type their own town and get a one-page report:
- its own warming stripes;
- how much warmer and wetter or drier it has become since 1981;
- what NASA's climate projections say for 2041–2060;
- the floods, cyclones, droughts and landslides recorded nearby;
- what to prepare for.

The report also finds the town's "climate twin" elsewhere on Earth and can be downloaded as an image
to share.

This matters because climate data usually stops at a chart that most people cannot read or trust.
We turn it into a tested answer for the place someone actually lives. It is in English and Bangla, so
students and families in Bangladesh, one of the countries most exposed to climate change, can use it
in their own language.

## Project details

### What it does
- **The global story (home page):**
  - warming stripes for Earth's land (+1.5 °C since 1981);
  - rain moving in opposite directions (235 land areas with a clearly wetter rainy season, 216 clearly drier);
  - disasters worldwide since 2000;
  - a zoom into South Asia;
  - what comes by 2041–2060.
- **Your place:** any town on Earth, as described above. It can be compared with a second place or with
  its climate twin.
- **Climate trends:** world maps of temperature, rainy-season rain and yearly rain since 1981, plus NASA
  projections for 2041–2060. A detailed South Asia explorer shows every square's yearly series, rate of
  change with a 95% range, significance, and the year its record turned.
- **Disaster risk:** 14 hotspots on every continent. Each shows recorded events, their climate trend,
  whether disasters follow the weather there, and the 2041–2060 outlook.
- **Satellite map:** NASA imagery month by month since 2000 (ground heat, air temperature, rain,
  greenness, forest loss), with a then-and-now compare view.
- **How it works:** the data, statistics, cross-checks and limits, written so they can be checked.

### How it works
- **Significance:** a Mann–Kendall trend test with the Hamed–Rao correction for year-to-year memory.
- **Size of the change:** Sen's slope per decade with a 95% confidence range.
- **Many maps at once:** Benjamini–Hochberg false-discovery control across thousands of map squares, so
  testing many places does not create false alarms.
- **Turning points:** the Pettitt change-point test finds the year a record turned.
- **Cross-check:** every main result is repeated against an independent station-based record (CRU TS 4.10).
- **Projections:** each of six NEX-GDDP-CMIP6 climate models is compared only with its own 1995–2014 run,
  and we report how many models agree.
- **An honest negative result:** a small machine-learning model (logistic regression, tested on years it
  never saw) could not tell disaster years from ordinary ones better than chance. So the site never
  turns projections into disaster odds.

### Tools and languages
- **Analysis:** Python (NumPy, SciPy, pymannkendall, netCDF4, Shapely, pytest).
- **Website:** TypeScript with Next.js, React, Tailwind CSS and Leaflet, hosted on Vercel.
- **Openness:** every number on the site is rebuilt from public data by the open code, with no login.

### Intended impact
- **Students:** a significance test they can see and trust, with plain definitions.
- **Families and local planners:** a tested, local picture of change, with clear preparation actions.
- **Honest by design:** the site never presents a trend as a forecast, and it tells readers to follow
  official warnings.

## NASA data used
| Dataset | How we used it |
|---|---|
| NASA GISTEMP v4 (GISS) | Temperature trends for every land area, 1981–2025; warming stripes |
| GPCP v2.3 monthly precipitation (NASA GSFC / NOAA) | Rain and rainy-season trends, 1981–2025 |
| NASA NEX-GDDP-CMIP6 (NCCS) | Projections for 2041–2060 under SSP2-4.5 and SSP5-8.5, six models, against each model's own 1995–2014 run |
| NASA Global Landslide Catalog | Landslide counts near each town and at landslide hotspots |
| NASA FIRMS (MODIS active fires) | Wildfire events in South Asia |
| NASA GIBS (MODIS land surface temperature and NDVI, MERRA-2, GLDAS) | Satellite map imagery, month by month since 2000 |

## Space agency partner data
None.

## Other data (not from a space agency)
- **GDACS (UN / European Commission JRC):** flood, drought and tropical cyclone alerts, 2000–2025.
- **IBTrACS (NOAA):** cyclone tracks.
- **Hansen / UMD Global Forest Change (Landsat):** forest loss.
- **CRU TS 4.10 (University of East Anglia):** independent cross-check.
- **Natural Earth:** land and country outlines.
- **Open-Meteo:** place-name search.

## Use of AI tools
We used Anthropic's Claude, an AI assistant, to help write and review the code of the website and the
analysis pipeline, and to draft and translate some of the site's text. It did not produce any results:
every number on the site is computed by our open analysis code from the datasets listed above, and we
checked the outputs ourselves.

The "AI test" on the site is a separate thing: a small statistical model (logistic regression) that we
trained and tested ourselves.

[Add any other AI use, such as for the demo video, and watermark any AI-generated images or video as
"AI-generated".]

## References
1. Lenssen, N. et al. (2019). Improvements in the GISTEMP uncertainty model. *J. Geophys. Res. Atmos.* 124.
2. Adler, R. F. et al. (2018). The Global Precipitation Climatology Project (GPCP) monthly analysis (new
   version 2.3). *Atmosphere* 9(4).
3. Thrasher, B. et al. (2022). NASA Global Daily Downscaled Projections, CMIP6. *Scientific Data* 9, 262.
4. Kirschbaum, D. et al. (2015). Spatial and temporal analysis of a global landslide catalog.
   *Geomorphology* 249.
5. Hamed, K. H. and Rao, A. R. (1998). A modified Mann–Kendall trend test for autocorrelated data.
   *J. Hydrology* 204.
6. Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. *J. Am. Stat. Assoc.* 63.
7. Benjamini, Y. and Hochberg, Y. (1995). Controlling the false discovery rate. *J. R. Stat. Soc. B* 57.
8. Wilks, D. S. (2016). "The stippling shows statistically significant grid points." *Bull. Am. Meteorol. Soc.*
9. Pettitt, A. N. (1979). A non-parametric approach to the change-point problem. *J. R. Stat. Soc. C* 28(2).
10. Harris, I. et al. (2020). Version 4 of the CRU TS monthly high-resolution gridded multivariate
    climate dataset. *Scientific Data* 7, 109.
11. Hansen, M. C. et al. (2013). High-resolution global maps of 21st-century forest cover change.
    *Science* 342.
12. Hawkins, E. Warming stripes (showyourstripes.info), the inspiration for our stripes.
13. Data portals:
    - NASA GISS: https://data.giss.nasa.gov/gistemp/
    - NASA NCCS NEX-GDDP-CMIP6: https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6
    - NASA GIBS: https://www.earthdata.nasa.gov/gibs
    - GDACS: https://www.gdacs.org/
