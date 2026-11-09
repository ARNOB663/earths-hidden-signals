"""Global disaster hotspots: regions on every continent where floods, droughts, cyclones or
landslides hit often, analysed the same way as the South Asia hazard regions.

For each hotspot (drawn by geography, not borders):
- recorded events per year from global catalogues (GDACS floods / droughts / tropical cyclones
  2000-2025, NASA Global Landslide Catalog 2007-2017), severe counts, months, notable events;
- its climate since 1981 from NASA GISTEMP and GPCP: warming and the trend of its own rainy season
  (four wettest consecutive months), with the same Mann-Kendall / Sen's slope tests;
- whether event years line up with the weather: detrended Spearman correlation of yearly event
  counts with rainy-season rain (wetter for floods and landslides, drier for droughts), as in
  build_hazards.py; a link counts only if significant (p < 0.05) and in the expected direction;
- 2041-2060 vs 1995-2014 from NASA NEX-GDDP-CMIP6 at 2 degrees (raw/cmip6_global), per model against
  its own historical run: warming, rainy-season change, and how often today's 1-in-10 wet season,
  dry season and hot year recur. Skipped if the global projections are not downloaded yet.

    python global_hazards.py
"""

from __future__ import annotations

import json
import warnings
from collections import defaultdict
from datetime import date
from pathlib import Path

import netCDF4
import numpy as np

import twins
from build_hazards import relationship
from cmip6_download import MODELS, PERIODS
from stats import trend

OUT = twins.ROOT.parent / "web" / "public" / "data" / "global"
CMIP = twins.ROOT / "raw" / "cmip6_global"
ALPHA = 0.05

# id, name, hazard, bbox [lat0, lat1, lon0, lon1], short description
HOTSPOTS = [
    ("bengal-delta", "Ganges-Brahmaputra-Meghna delta", "flood", [21.5, 26.5, 88, 92.5], "Low delta where three great rivers meet the sea."),
    ("indus-plain", "Indus plain", "flood", [24, 32, 67, 74], "Flat, densely farmed floodplain; the 2010 and 2022 mega-floods."),
    ("yangtze", "Middle and lower Yangtze", "flood", [27, 33, 108, 122], "China's great river basin, home to hundreds of millions."),
    ("sahel-niger", "Sahel: Niger and Lake Chad basins", "flood", [10, 16, -5, 16], "Semi-arid belt where monsoon floods now strike after decades of drought."),
    ("central-europe", "Central Europe: Rhine and Danube", "flood", [45, 52, 5, 20], "River floods such as 2002, 2013 and 2021."),
    ("mississippi", "Lower Mississippi valley", "flood", [29, 37, -94, -88], "North America's largest river basin outlet."),
    ("horn-of-africa", "Horn of Africa", "drought", [-2, 12, 38, 51], "Two rainy seasons; repeated failed rains since 2010."),
    ("southern-africa", "Southern Africa", "drought", [-30, -15, 15, 33], "Summer-rain region hit by El Nino droughts."),
    ("philippines", "Philippines", "cyclone", [5, 19, 117, 127], "One of the most typhoon-struck places on Earth."),
    ("caribbean-gulf", "Caribbean and Gulf coast", "cyclone", [15, 31, -98, -60], "Atlantic hurricane alley."),
    ("mozambique-madagascar", "Mozambique and Madagascar", "cyclone", [-26, -12, 32, 51], "Southwest Indian Ocean cyclones such as Idai (2019)."),
    ("central-america", "Central America", "landslide", [7, 18, -93, -77], "Steep volcanic slopes and intense rain."),
    ("northern-andes", "Northern Andes", "landslide", [-5, 8, -80, -70], "Young mountains with dense hillside towns."),
    ("himalaya", "Himalaya", "landslide", [26.5, 35, 73, 88.5], "Steep monsoon slopes; thousands of landslides a year."),
]
EVENT_TYPE = {"flood": "flood", "drought": "drought", "cyclone": "cyclone", "landslide": "landslide"}
# Which way the rainy season should move for more events (None: no rain-based link tested).
EXPECTED = {"flood": +1, "landslide": +1, "drought": -1, "cyclone": None}


def summary(t, scale=1.0):
    if t is None:
        return None
    return {"perDecade": round(t.slope * 10 * scale, 3), "p": round(float(t.p), 5)}


def region_climate(place, bbox):
    """Annual temperature and rainy-season rain series for a region from the global records."""
    la0, la1, lo0, lo1 = bbox
    temp_s, rain_s = place((la0, la1, lo0, lo1))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        annual_t = np.nanmean(temp_s, axis=1)
    clim = np.nanmean(rain_s[:30], axis=0)
    months = twins.wettest_months(clim)
    wet = rain_s[:, months].sum(axis=1)
    return annual_t, wet, months


def project(bbox, months_obs):
    """Per-model change for one region from the global 2-degree projections, or None if missing."""
    la0, la1, lo0, lo1 = bbox
    models = [m for m in MODELS if all((CMIP / m / s / f"{v}_{y}.nc").exists() for s, ys in PERIODS.items() for v in ("pr", "tas") for y in ys)]
    if not models:
        return None, []
    per = defaultdict(dict)
    for m in models:
        series = {}
        for period, years in PERIODS.items():
            t_year, wet_year, dry_year = [], [], []
            for y in years:
                vals = {}
                for var in ("pr", "tas"):
                    with netCDF4.Dataset(CMIP / m / period / f"{var}_{y}.nc") as ds:
                        lats, lons = ds["lat"][:].data, ds["lon"][:].data
                        lons = np.where(lons > 180, lons - 360, lons)
                        t = ds["time"]
                        mon = np.array([d.month for d in netCDF4.num2date(t[:], t.units, getattr(t, "calendar", "standard"))])
                        li = (lats >= la0) & (lats <= la1)
                        lj = (lons >= lo0) & (lons <= lo1)
                        block = np.ma.filled(ds[var][:, li, :][:, :, lj].astype(float), np.nan)
                        w = np.cos(np.deg2rad(lats[li]))[None, :, None] * np.ones_like(block[:1])
                        w = np.where(np.isfinite(block[:1]), w, 0)
                        daily = np.nansum(np.nan_to_num(block) * w, axis=(1, 2)) / max(w.sum(), 1e-9)
                        vals[var] = (daily, mon)
                pr, mon = vals["pr"]
                tas, _ = vals["tas"]
                pr = pr * 86400.0
                t_year.append(float(np.mean(tas)) - 273.15)
                wet_year.append(float(pr[np.isin(mon, [k + 1 for k in months_obs])].sum()))
                dry_year.append(float(pr[~np.isin(mon, [k + 1 for k in months_obs])].sum()))
            series[period] = (np.array(t_year), np.array(wet_year), np.array(dry_year))
        h_t, h_w, h_d = series["historical"]
        for sc in ("ssp245", "ssp585"):
            f_t, f_w, f_d = series[sc]
            per[sc][m] = {
                "tMean": float(f_t.mean() - h_t.mean()),
                "wetSeason": float((f_w.mean() - h_w.mean()) / h_w.mean() * 100) if h_w.mean() > 0 else 0.0,
                "wetYear": float((f_w > np.percentile(h_w, 90)).mean()),
                "dryYear": float((f_w < np.percentile(h_w, 10)).mean()),
                "hotYear": float((f_t > np.percentile(h_t, 90)).mean()),
            }
    out = {}
    for sc, by_model in per.items():
        out[sc] = {}
        for k in ("tMean", "wetSeason", "wetYear", "dryYear", "hotYear"):
            v = np.array([by_model[m][k] for m in models])
            med = float(np.median(v))
            out[sc][k] = {
                "median": round(med, 3),
                "min": round(float(v.min()), 3),
                "max": round(float(v.max()), 3),
                "agree": int((np.sign(v) == np.sign(med)).sum()) if k in ("tMean", "wetSeason") and med != 0 else None,
            }
    return out, models


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    land = twins.land_geometry()
    print("Loading GISTEMP and GPCP (global)")
    t_lats, t_lons, temp = twins.load_gistemp()
    r_lats, r_lons, rain = twins.load_gpcp()
    t_land = twins.cached_land_fraction("gistemp2", t_lats, t_lons, 2.0, 2.0, land)
    r_land = twins.cached_land_fraction("gpcp25", r_lats, r_lons, 2.5, 2.5, land)

    def place(bbox):
        wt = twins.box_weights(bbox, t_lats, t_lons, 2.0, 2.0, t_land)
        wr = twins.box_weights(bbox, r_lats, r_lons, 2.5, 2.5, r_land)
        return twins.box_series(temp, wt), twins.box_series(rain, wr)

    events = twins.global_events()
    years_obs = twins.YEARS
    out_regions = []
    models_used: list[str] = []
    for zid, name, hazard, bbox, desc in HOTSPOTS:
        kind = EVENT_TYPE[hazard]
        ev_years = list(range(2007, 2018)) if kind == "landslide" else list(range(2000, 2026))
        la0, la1, lo0, lo1 = bbox
        pad = 1.0 if kind == "flood" else 0.0  # GDACS places a flood at one point
        inside = [e for e in events if e["type"] == kind and la0 - pad <= e["lat"] <= la1 + pad and lo0 - pad <= e["lon"] <= lo1 + pad and e["date"][:4].isdigit()]
        by_year = defaultdict(int)
        months = [0] * 12
        for e in inside:
            y = int(e["date"][:4])
            if y in ev_years:
                by_year[y] += 1
                if len(e["date"]) >= 7 and e["date"][5:7].isdigit():
                    months[int(e["date"][5:7]) - 1] += 1
        counts = np.array([by_year[y] for y in ev_years], dtype=float)
        high = counts >= np.percentile(counts, 75) if counts.any() else np.zeros_like(counts, dtype=bool)

        annual_t, wet, wet_months = region_climate(place, bbox)
        t_t = trend(annual_t) if np.isfinite(annual_t).all() else None
        t_w = trend(wet) if np.isfinite(wet).all() else None
        wet_mean = float(np.nanmean(wet))

        link = None
        if EXPECTED[hazard] is not None and np.isfinite(wet).all():
            idx = [years_obs.index(y) for y in ev_years if y in years_obs]
            rel = relationship(counts[: len(idx)], wet[idx])
            if rel:
                linked = rel["p"] < ALPHA and np.sign(rel["rho"]) == EXPECTED[hazard]
                link = {**rel, "linked": bool(linked)}

        future, models_used = project(bbox, wet_months)
        notable = sorted((e for e in inside if e["alert"] in ("Orange", "Red")), key=lambda e: (e["alert"] == "Red", e.get("deaths", 0), e["date"]), reverse=True)[:4]
        out_regions.append({
            "id": zid,
            "name": name,
            "hazard": hazard,
            "bbox": bbox,
            "description": desc,
            "events": {
                "years": ev_years,
                "counts": [int(c) for c in counts],
                "total": int(counts.sum()),
                "severe": sum(1 for e in inside if e["alert"] in ("Orange", "Red")),
                "months": months,
                "highYears": [y for y, h in zip(ev_years, high) if h],
                "notable": [{k: e[k] for k in ("date", "alert", "title")} for e in notable],
            },
            "climate": {
                "warming": summary(t_t),
                "wetSeason": summary(t_w, 100 / wet_mean if wet_mean else 1),
                "wetMonths": [m + 1 for m in wet_months],
                "wetMeanMm": round(wet_mean),
            },
            "link": link,
            "future": future,
        })
        f = future["ssp245"] if future else None
        warm = f"{t_t.slope * 10:+.2f}" if t_t else "-"
        wetc = f"{summary(t_w, 100 / wet_mean)['perDecade']:+.1f}" if t_w else "-"
        lk = f"{link['rho']:+.2f}{' LINKED' if link['linked'] else ''}" if link else "-"
        fut = f"+{f['tMean']['median']:.1f}C wet {f['wetSeason']['median']:+.0f}%" if f else ""
        print(f"  {zid:22s} {hazard:9s} events {int(counts.sum()):4d}  warm {warm}/dec  wet {wetc}%/dec  link {lk}  {fut}")

    payload = {
        "generated": date.today().isoformat(),
        "models": models_used,
        "present": [PERIODS["historical"][0], PERIODS["historical"][-1]],
        "future": [PERIODS["ssp245"][0], PERIODS["ssp245"][-1]],
        "sources": "GDACS (floods, droughts, tropical cyclones 2000-2025); NASA Global Landslide Catalog (2007-2017); NASA GISTEMP v4, GPCP v2.3; NASA NEX-GDDP-CMIP6 at 2 degrees",
        "regions": out_regions,
    }
    (OUT / "hotspots.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Wrote {OUT / 'hotspots.json'} ({len(models_used)} projection models)")


if __name__ == "__main__":
    main()
