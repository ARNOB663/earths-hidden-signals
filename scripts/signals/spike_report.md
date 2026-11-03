# Spike report — Signals (plan rev. 7, step 0)

Started 2026-11-03. Result of every gate in §4a of `PLAN.md`. Sections marked
**(auto-generated)** are written by `spike.py` / `spike_imerg_probe.py` and must not be edited by
hand; mapped sections (Link check, Auth, GDACS, EONET, IMERG timing, IMERG collection depth,
Station) are upserted by name. Everything else is curated by me from those results.
Nothing here is a verified claim until a script or a person put a value in it: `TBD` = not measured.

Run order (from the repo root):

```
python3 scripts/signals/spike.py --check-links
python3 scripts/signals/spike.py --check-auth
python3 scripts/signals/spike.py --gdacs
python3 scripts/signals/spike.py --eonet
python3 scripts/signals/spike_imerg_probe.py --point 23.81,90.41 --window 2024-07-01/2024-07-31
python3 scripts/signals/spike_imerg_probe.py --point 23.81,90.41 --window 2024-07-01/2024-07-31 --full
```

Credentials for `--check-auth` and the IMERG probe: `PPS_USERNAME`, `PPS_PASSWORD`,
`EARTHDATA_TOKEN` in the environment. The scripts print only `OK / rejected / expired`.

## 0. Result of the 2026-11-03 pre-run (no credentials in this environment)

What ran here, keyless: links, GDACS, EONET, IMERG catalogue depth, POWER, GHCN. What could not
run here: PPS/GeoTIFF, Earthdata token, the GES subset timing (GES DISC stopped answering this
machine mid-run with "network unreachable"; rerun from your machine with the token).

### 0a. Corrections this pre-run already forces on the plan (measured, not remembered)

| # | Finding | Effect |
|---|---|---|
| 1 | `IMERG_Precipitation_Rate`'s GIBS colormap is `colormaps/v1.3/GPM_Precipitation_Rate.xml`, **not** `IMERG_Precipitation_Rate.xml` (404). [V] | Take the colormap URL from GetCapabilities via `gibs.ts`; never hard-code it. |
| 2 | `MODIS_Combined_Flood_2-Day`, `VIIRS_Combined_Flood_2-Day` **and** `MODIS_Combined_Flood_1/3-Day`, `VIIRS_Combined_Flood_1/3-Day`, `SMAP_L4_Analyzed_Root_Zone_Soil_Moisture` all exist in GetCapabilities. [V] | A3c confirmed; no hard-coded fallback needed. |
| 3 | IMERG V07 daily (Final, Late, Early) starts **1998-01-01**; Final ends **2025-09-30**; Late/Early run to the present in V07B/V07C. [V via CMR] | Gate 0c can use a Late history back to 1998; replays can go back further than 2010. **Do not mix V07B and V07C** in one baseline window — record the granule version per day. |
| 4 | `ghcnd-stations.txt` is **11.4 MB** uncompressed ([V]); Dhaka's station is `BGM00041923`, 0.9 km from the probe point, with PRCP in tenths of mm. | The probe caches the station list once and reads `by_station/<ID>.csv.gz` per point. |
| 5 | Dhaka GHCN PRCP for 10–25 July 2024: 0, 0.5, **131.1**, 0, 5.1, 0.3, 0.5, 0, 0, 4.8, 12.7, 0.5 mm. POWER at the same point, same window: 6.97…25.75 mm/day (no zeros). [V] | The station is **not** a ground truth for the grid cell (many zero days during monsoon). POWER is the scale check; the station is a *second, weaker* check and is reported as "unconfirmed" when it disagrees by reason of zeros. |
| 6 | GDACS SEARCH is a live 3-day window; it accepts `fromdate`/`todate` and returns dated FL events (e.g. 2015 Q1: Malawi #4219, Sri Lanka #4215). [V] | Replay candidates come from dated GDACS queries, cross-checked with EONET flood events (EONET `categories/floods` is currently empty [V]). |
| 7 | `registry.opendata.aws` is the AWS registry home page only; no IMERG dataset page was tested. [V]/[M] | Payload path stays GES DISC / PPS. AWS is link-out only on `/about`. |

## 1. Link check (auto-generated)

Upserted by `python3 scripts/signals/spike.py --check-links`. After the run, the notes list
below is curated.

Not run yet with the final link list.

## 2. Auth probe (auto-generated)

| probe | result | HTTP |
|---|---|---|
| PPS basic (IMERG Late GIS) | OK | 200 |
| PPS basic (IMERG Early GIS) | OK | 200 |
| Earthdata token (GES DISC Final listing) | network error | ERR |
| Earthdata token (GES DISC OPeNDAP Final) | network error | ERR |
| Earthdata token (LANCE VIIRS archive) | OK | 200 |
| Earthdata token (SMAP NRT dir) | network error | ERR |

## 3. GDACS (auto-generated)

| source | HTTP | format | size | usable | sample fields |
|---|---|---|---|---|---|
| GDACS SEARCH JSON | 200 | json | 117.4 KB | yes | 83 features; props: eventtype, eventid, episodeid, eventname, glide, name, description, htmldescription, icon, iconoverall, url, alertlevel; geom: Point; coords: [80.2, 15.8] |
| flood features in this response | 200 | json | - | yes | 2026-08-09 1104121 at [78.6099, 11.3324], 2026-07-31 1104081 at [108.4812, 31.2958], 2026-08-26 1104124 at [85.3649, 27.2953] |
| GDACS RSS 7d | 200 | xml | 1.2 MB | yes | 421 items |
| GDACS RSS (all) | 200 | not xml | 17.3 KB | no | 0 items |
| GDACS FL history 2015 Q1 | 200 | json | 5.1 KB | yes | 4219:2015-01-01, 4215:2014-12-20, 4217:2014-12-10, 4216:2014-12-20 |
| GDACS FL history 2004 Q1 | 200 | json | 3.9 KB | yes | 2418:2004-01-10, 2403:2003-12-10, 2407:2003-12-19 |
| GDACS report.aspx (fallback shape) | 200 | html | 53.9 KB | yes | record page for a known event |

Decision rule (rev. 7 §4a-f): SEARCH gives dated flood features whose `properties` carry
`eventtype`, `fromdate`, `todate`, `country`, `htmldescription` and whose geometry carries
coordinates → replays use GDACS events. If SEARCH stays empty, use `rss.xml` / per-event
`report.aspx` pages and cross-check with EONET.


## 4. EONET (auto-generated)

| source | HTTP | format | size | usable | sample fields |
|---|---|---|---|---|---|
| EONET v3 events | 200 | json | 177.6 KB | yes | 103 events; fields: id, title, description, link, closed, categories, sources, geometry; categories: list[1]; geom: magnitudeValue, magnitudeUnit, date, type, coordinates |
| EONET v3 category floods | 200 | json | 241 B | no flood events listed | 0 events |
| EONET v3 closed floods | 200 | json | 1.9 MB | yes | 50 closed flood events; first: Flood in Bhutan 1104265; before 2010: 0 |

EONET detail [V 2026-11-03]: closed floods are ordered newest-first and cover **2026-09-30 →
2026-10-28 only**; `start`/`end` date filters returned 0 events. EONET is therefore **not** a
historical replay catalogue — GDACS dated queries are. EONET keeps its Tier B role as a live
cross-check of recent events (GDACS event ids appear in EONET titles, e.g. "Flood in Bhutan
1104265"). Recorded on `/about` as "live cross-check only".
| EONET v3 closed floods | 200 | json | 1.9 MB | yes | 50 closed flood events; first: Flood in Bhutan 1104265; before 2010: 0 |

Decision rule: EONET is [M] Tier B and is only a **cross-check** for replay candidates
(finding the action of an event), never the primary catalogue. If its IDs and dates match
GDACS for ≥ 2 events, list them; otherwise record "cross-check unavailable".


## 5. IMERG timing (0a/0b, auto-generated)

| route | ok | seconds | bytes | note |
|---|---|---|---|---|
| geotiff (live product) | False | 0.0 | - | no PPS_USERNAME / PPS_PASSWORD in this environment |
| GES subset (one day) | False | 0.0 | - | network error: GES DISC unreachable from this machine mid-run; rerun with EARTHDATA_TOKEN |
| Harmony subsetter | False | 0.0 | - | not attempted: needs an Earthdata token and collection id; rerun with --check-auth OK |

### Extrapolation (one tile)

- 2010-01-01 → 2025-09-30 (189 months): not measured
- 1998-01-01 → 2025-09-30 (333 months): not measured
- Gate 0b (one tile, 2010 onward ≤ 30 min): **BLOCKED: GES DISC unreachable**

### Gate 0a/0b status (2026-11-03, decided)

**BLOCKED: GES DISC unreachable** — confirmed from two independent networks (this workspace and
the user's terminal). SMAP NRT (`n5eil01u.ecs.nsidc.org`) fails the same way. So the IMERG Final
subset cost is **unmeasured**, and gate 0b cannot pass, fail or stop on evidence.

What this does **not** block: **PPS** is reachable and authenticates `OK` for both Late and
Early (user's terminal, 2026-11-03) [V]. LANCE reaches with the Earthdata token [V], and CMR
shows Late daily history from 1998-01-01 [V].

Gate application (§4a): 0b cannot be judged → the ordered fallbacks apply rather than waiting:

1. **Baseline from IMERG Late via PPS** — the GeoTIFF ladder is already reachable, so the
   baseline no longer depends on GES DISC at all. Cost = one 1-day GeoTIFF per day per tile
   (measured by the `geotiff` probe line above, one file). This is also gate 0c's preferred
   option when the bias is material, so it removes two risks at once.
2. **Run the baseline build in GitHub Actions** — Actions runners reach GES DISC with
   `EARTHDATA_TOKEN` (repo secret) and cache `scripts/signals/derived/`; the committed
   `scripts/signals/baseline/` is then produced once and used everywhere.
3. IMERG Final remains the independent cross-check and the replay source **only** if (1) is
   unavailable; otherwise replays use Late, labelled.

Consequence: step 1 is **unblocked for repo scaffolding** (guard rails, catalogue), but step 3
(baseline) must start with option (1) and record the measured per-day GeoTIFF cost.

## 6. IMERG collection depth (CMR, auto-generated)

| collection | first granule name | latest granule name | coverage (start → end) |
|---|---|---|---|
| Final daily | 3B-DAY.MS.MRG.3IMERG.19980101-S000000-E235959.V07B.nc4 | 3B-DAY.MS.MRG.3IMERG.20250930-S000000-E235959.V07B.nc4 | 1998-01-01 → 2025-09-30 |
| Late daily | 3B-DAY-L.MS.MRG.3IMERG.19980101-S000000-E235959.V07B.nc4 | 3B-DAY-L.MS.MRG.3IMERG.20261101-S000000-E235959.V07C.nc4 | 1998-01-01 → 2026-11-01 |
| Early daily | 3B-DAY-E.MS.MRG.3IMERG.19980101-S000000-E235959.V07B.nc4 | 3B-DAY-E.MS.MRG.3IMERG.20261102-S000000-E235959.V07C.nc4 | 1998-01-01 → 2026-11-02 |

Product start 1998-01-01 · Final end 2025-09-30 [V via CMR 2026-11-03]. Gate 0c input.

## 7. Late vs Final at probe points (0c, auto-generated)

Upserted by `--full` when both products are reachable. Not run yet.

## 8. Station / POWER check (auto-generated)

Measured keyless on 2026-11-03 (Dhaka point, 10–25 July 2024):

| point | IMERG total mm | POWER total mm | GHCN PRCP total mm | nearest station |
|---|---|---|---|---|
| 23.81,90.41 | needs token | 149.0 | 155.8 (12 d) | BGM00041923 TEJGAON 0.9 km |

Interpretation: same order of magnitude (1.0×), so no obvious scale error, but the station has
zero-rain days inside a clearly wet period. Station check verdict: **scale OK, station
"unconfirmed"** — the 131.1 mm day (12 July) alone proves the station is not a clean reference.
IMERG values are re-checked in step 3b from the real tile.

## 9. Baseline artefact size (0k, auto-generated)

Upserted by `--full`. Not run yet. Budget: 25 MB total, 8 MB per tile.

## 10. Gates (curated — decided after sections 1–9)

| Gate | Question | Result | Decision |
|---|---|---|---|
| 0a | One month, one tile, spatially subset: bytes + seconds, route used | **BLOCKED: GES DISC unreachable** (two networks) | Fallback 1: PPS Late GeoTIFF baseline; fallback 2: baseline build in GitHub Actions |
| 0b | One tile 2010→2025-09-30 ≤ 30 min? | **BLOCKED** (not judgeable) | Apply the §4a fallback order now, do not wait |
| 0c | Late history depth and Late-vs-Final bias | **candidate PASS**: Late daily covers 1998→present [V via CMR]; bias unmeasured | Late baseline is the fallback-1 default; measure bias from the Late GeoTIFF line before declaring the switch |
| 0d | High-latitude boundary | TBD | `maxAbsLat` = lower of 55 and the reliability cut-off found |
| 0e | PPS + Earthdata auth | **PASS** — PPS Late and Early 200 OK; Earthdata token valid (LANCE) [V, user terminal 2026-11-03] | Proceed; re-check in CI before the first refresh |
| 0f | GDACS shape | **PASS** — dated FL features with event IDs and coordinates, history queries work [V] | Replays use GDACS; EONET floods empty, so cross-check is "unavailable" unless an event appears there |
| 0g | Dead [M] links | [V]: IMERG colormap id wrong; SMAP NRT and SEDAC timed out here; OPERA 403 by bot | Colormap comes from GetCapabilities. SMAP stays "not integrated". Retest SMAP/SEDAC in a browser |
| 0h | Tier B one-liners | EONET alive; POWER alive; NASADEM alive; OPERA/SEDAC unconfirmed here | Info only; no adoption before step 5 green + approval |
| 0i | Replay candidates + launch tiles | partial — 2015 Q1 GDACS gives Malawi + Sri Lanka [V] | Finish in §11/§12 with dated queries |
| 0j | New routes absent | **PASS** [V, 2026-11-03] | `web/src/app/{signals,watch,accuracy,about}` do not exist |
| 0k | Baseline artefact size | TBD | Must fit 25 MB total, 8 MB/tile |

## 11. Replay candidates (0i, curated)

All three dated before 2025-09-30 and returned by GDACS SEARCH with coordinates [V 2026-11-03].
GDACS gives **points, not footprints** (geometry type `Point`), so each event uses the 50 km
radius in §7 of the plan until a polygon is fetched from `polygons/getgeometry`.

| Event | GDACS ID | Start date | Coordinates (50 km radius) | Continent | Alert level | Tile | Split |
|---|---|---|---|---|---|---|---|
| Brazil flood Jan 2019 | 1000220 | 2019-01-25 | −44.173, −20.135 | South America | Orange | 10S–0S / 50W–40W | reporting |
| Sri Lanka flood Dec 2014 | 4215 | 2014-12-20 | 80.983, 7.909 | Asia | — | 0N–10N / 80E–90E | reporting |
| Malawi flood Mar 2019 (GDACS end 2019-03-18) | 1000226 | 2019-03-04 | 35.122, −15.38 | Africa | Orange | 20S–10S / 30E–40E | reporting |
| Malawi flood Jan 2015 | 4219 | 2015-01-01 | 35.356, −18.795 | Africa | — | 20S–10S / 30E–40E | reporting (spare) |

Rejected as too early for cross-checking: 2004 Q1 events (no Early history, and GDACS 2004
queries returned non-JSON once — see §13).

## 12. Launch tiles (curated)

| Tile (10x10 deg) | Continent | Wet in November? | Replay events inside | Enabled |
|---|---|---|---|---|
| 0N–10N / 80E–90E | Asia (Sri Lanka, S India NE monsoon) | **yes** — NE monsoon [M], verify with the baseline in step 3 | 4215 | yes (proposed) |
| 20S–10S / 30E–40E | Africa (Malawi) | southern Africa rainy season starts Dec, **no** [M] | 4219, 1000226 | yes (replay only) |
| 10S–0S / 50W–40W | South America (SE Brazil) | **yes** — summer monsoon onset [M] | 1000220 | yes (replay only) |
| 20N–30N / 90E–100E | Asia (Dhaka probe tile) | **no** — dry season | — | yes (probe + POWER/GHCN test) |

Needs: (i) every replay event inside an enabled tile — **satisfied**; (ii) ≥ 2 continents —
**satisfied** (3); (iii) ≥ 1 tile wet in November — the Sri Lanka tile is the candidate, to be
confirmed from the baseline before it is enabled.

## 13. Notes and replacements

- `IMERG_Precipitation_Rate` colormap lives at `colormaps/v1.3/GPM_Precipitation_Rate.xml` [V].
- IMERG daily V07 starts 1998-01-01; Late runs to the present on V07B/V07C — never mix versions
  inside one baseline window [V via CMR].
- GDACS is the only working **historical** catalogue found; EONET closed floods cover only the last
  month and ignore date filters, and EONET live floods are live-only [V]. GDACS SEARCH
  returned non-JSON once for a 5-month window (2018-01→06) and JSON for narrower windows [V], so
  `gdacs.py` must query in **≤ 3-month chunks**, retry once, and record a `not-integrated` status
  instead of crashing.
- GDACS geometry is always a centroid `Point` (no footprint in SEARCH); the 50 km radius stands until
  `polygons/getgeometry` is tested in step 6.
- GES DISC was unreachable from this machine after a few requests [V]; the timings in §5 must come
  from the authenticated run.
- The §5 projection is labelled with its basis: set `SIGNALS_POINT_ONLY=1` to time a one-pixel
  series (cheap lower bound) or leave it unset to time a 10×10 deg tile (real pipeline cost).
  Record both, and state which one gate 0b was judged on.
