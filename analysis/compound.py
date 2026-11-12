"""Signals together: months when two unusual signals coincide, where they are becoming more common, whether
recorded disasters came in such months more often than chance, and a month-by-month look at the year
before some well-known disasters.

Data (already used by global_trends.py): NASA GISTEMP v4 monthly temperature anomaly (2 degrees) and GPCP
v2.3 monthly rain (2.5 degrees, nearest cell), 1981-2025; GDACS floods/droughts (2000-2025) and NASA's
Global Landslide Catalog (2007-2017), cached by twins.py.

A month is unusual when it is in the top (or bottom) 10% of the 45 values for that calendar month at that
place, so the seasonal cycle is removed. Two combinations:
- hot + dry:          temperature in the top 10% and rain in the bottom 10% in the same month
- wet on wet ground:  rain in the top 10%, after a previous month already in the top 25%
  (a stand-in for saturated soil: NASA soil-moisture files need a login)

Per land cell:
- how many such months in 1981-1995 and in 2011-2025
- floods and landslides within 300 km: were their months wet-on-wet more often than other months?
  One-sided Fisher exact test, Benjamini-Hochberg across cells (alpha_FDR 0.10), only where at least
  5 event months exist. Droughts are tested against hot + dry the same way.

This is association in the record, not prediction: the site's risk test (risk.py) found monthly weather
alone cannot tell disaster years from ordinary ones.

Output: web/public/data/global/compound.json (per cell) and compound-events.json (timelines)
"""

from __future__ import annotations

import json
import warnings
from datetime import date

import numpy as np
from scipy.stats import fisher_exact, rankdata

import twins
from stats import fdr_significant

OUT = twins.ROOT.parent / "web" / "public" / "data" / "global"
YEARS = twins.YEARS
Y0 = YEARS[0]
LAT_RANGE = (-55.0, 75.0)
MIN_LAND = 0.35
RADIUS_KM = 300
EARLY = (1981, 1995)
LATE = (2011, 2025)
MIN_EVENT_MONTHS = 5

# Well-known events for the timeline: name, Bangla name, type, year, month, lat, lon.
EVENTS = [
    ("cyclone-remal", "Cyclone Remal", "ঘূর্ণিঝড় রেমাল", "cyclone", 2024, 5, 21.75, 89.6),
    ("cyclone-amphan", "Cyclone Amphan", "ঘূর্ণিঝড় আম্পান", "cyclone", 2020, 5, 21.65, 88.05),
    ("sylhet-flood-2022", "Sylhet floods", "সিলেটের বন্যা", "flood", 2022, 6, 24.9, 91.87),
    ("rangamati-landslides-2017", "Rangamati landslides", "রাঙামাটির ভূমিধস", "landslide", 2017, 6, 22.65, 92.17),
    ("pakistan-floods-2022", "Pakistan floods (Sindh)", "পাকিস্তানের বন্যা (সিন্ধু)", "flood", 2022, 8, 26.5, 68.0),
    ("kerala-floods-2018", "Kerala floods", "কেরালার বন্যা", "flood", 2018, 8, 10.0, 76.3),
    ("kedarnath-2013", "Uttarakhand floods and landslides", "উত্তরাখণ্ডের বন্যা ও ভূমিধস", "landslide", 2013, 6, 30.73, 79.07),
    ("cyclone-idai", "Cyclone Idai", "ঘূর্ণিঝড় ইডাই", "cyclone", 2019, 3, -19.8, 34.9),
    ("europe-heat-drought-2022", "Europe heat and drought (France)", "ইউরোপের তাপপ্রবাহ ও খরা (ফ্রান্স)", "drought", 2022, 7, 46.5, 2.5),
    ("germany-floods-2021", "Germany floods (Ahr valley)", "জার্মানির বন্যা (আর উপত্যকা)", "flood", 2021, 7, 50.5, 7.0),
    ("derna-floods-2023", "Derna floods (Storm Daniel)", "দারনার বন্যা (ঝড় ড্যানিয়েল)", "flood", 2023, 9, 32.77, 22.64),
    ("rio-grande-do-sul-2024", "Rio Grande do Sul floods", "রিও গ্রান্দে দো সুলের বন্যা", "flood", 2024, 5, -30.03, -51.23),
    ("valencia-floods-2024", "Valencia floods", "ভ্যালেন্সিয়ার বন্যা", "flood", 2024, 10, 39.47, -0.38),
]


def month_ranks(series: np.ndarray) -> np.ndarray:
    """[years, 12] -> rank fraction (0..1] of each value among the same calendar month's values."""
    out = np.empty_like(series, dtype=float)
    for m in range(12):
        out[:, m] = rankdata(series[:, m]) / series.shape[0]
    return out


def flags(t: np.ndarray, r: np.ndarray) -> dict[str, np.ndarray]:
    """Per month (flattened, chronological): unusual hot/dry/wet and the two combinations."""
    tr, rr = month_ranks(t).ravel(), month_ranks(r).ravel()
    hot, dry, wet = tr > 0.9, rr <= 0.1, rr > 0.9
    prev_wet = np.concatenate([[False], rr[:-1] > 0.75])
    return {"hot": hot, "dry": dry, "wet": wet, "hotDry": hot & dry, "wetOnWet": wet & prev_wet, "tr": tr, "rr": rr}


def window(mask: np.ndarray, years: tuple[int, int]) -> int:
    a, b = (years[0] - Y0) * 12, (years[1] - Y0 + 1) * 12
    return int(mask[a:b].sum())


def association(flag: np.ndarray, event_months: set[int], first: int, last: int):
    """Lift and one-sided Fisher p of `flag` in event months vs all months in [first, last]."""
    idx = np.arange(first, last + 1)
    ev = np.isin(idx, sorted(event_months))
    if ev.sum() < MIN_EVENT_MONTHS:
        return None
    f = flag[idx]
    a, b = int((f & ev).sum()), int((~f & ev).sum())
    c, d = int((f & ~ev).sum()), int((~f & ~ev).sum())
    base = f.mean()
    lift = (a / (a + b)) / base if base > 0 else 0.0
    _, p = fisher_exact([[a, b], [c, d]], alternative="greater")
    return {"lift": round(float(lift), 2), "p": float(p), "inEvents": a, "eventMonths": a + b}


def month_index(iso: str) -> int | None:
    try:
        y, m = int(iso[:4]), int(iso[5:7])
    except ValueError:
        return None
    if not (Y0 <= y <= YEARS[-1]):
        return None
    return (y - Y0) * 12 + m - 1


def main() -> None:
    land = twins.land_geometry()
    t_lats, t_lons, temp = twins.load_gistemp()
    r_lats, r_lons, rain = twins.load_gpcp()
    t_land = twins.cached_land_fraction("gistemp2", t_lats, t_lons, 2.0, 2.0, land)
    band = (t_lats >= LAT_RANGE[0]) & (t_lats <= LAT_RANGE[1])
    keep = (t_land >= MIN_LAND) & band[:, None]

    def rain_cell(lat, lon):
        lon360 = lon % 360
        i = int(np.argmin(np.abs(r_lats - lat)))
        j = int(np.argmin(np.minimum(np.abs(r_lons % 360 - lon360), 360 - np.abs(r_lons % 360 - lon360))))
        return i, j

    events = twins.global_events()
    wet_types, dry_types = {"flood", "landslide"}, {"drought"}
    ev_lat = np.array([e["lat"] for e in events])
    ev_lon = np.array([e["lon"] for e in events])
    ev_month = [month_index(e["date"]) for e in events]
    ev_type = [e["type"] for e in events]
    first_m, last_m = (2000 - Y0) * 12, len(YEARS) * 12 - 1

    def km(lat, lon, lats, lons):
        r = np.pi / 180
        h = np.sin((lats - lat) * r / 2) ** 2 + np.cos(lat * r) * np.cos(lats * r) * np.sin((lons - lon) * r / 2) ** 2
        return 12742 * np.arcsin(np.sqrt(h))

    cells, wet_tests, dry_tests = [], [], []
    for i, j in zip(*np.nonzero(keep)):
        lat = float(t_lats[i])
        lon = float(t_lons[j] - 360 if t_lons[j] > 180 else t_lons[j])
        t = temp[:, :, i, j]
        ri, rj = rain_cell(lat, lon)
        r = rain[:, :, ri, rj]
        if not (np.isfinite(t).all() and np.isfinite(r).all()) or r.sum() < 100:
            continue
        fl = flags(t, r)
        near = np.nonzero(km(lat, lon, ev_lat, ev_lon) <= RADIUS_KM)[0]
        wet_months = {ev_month[k] for k in near if ev_type[k] in wet_types and ev_month[k] is not None}
        dry_months = {ev_month[k] for k in near if ev_type[k] in dry_types and ev_month[k] is not None}
        ww = association(fl["wetOnWet"], wet_months, first_m, last_m)
        hd = association(fl["hotDry"], dry_months, first_m, last_m)
        k = len(cells)
        if ww:
            wet_tests.append((k, ww["p"]))
        if hd:
            dry_tests.append((k, hd["p"]))
        last_hd = int(np.nonzero(fl["hotDry"])[0][-1]) if fl["hotDry"].any() else -1
        last_ww = int(np.nonzero(fl["wetOnWet"])[0][-1]) if fl["wetOnWet"].any() else -1
        cells.append({
            "c": [round(lat, 2), round(lon, 2),
                  window(fl["hotDry"], EARLY), window(fl["hotDry"], LATE),
                  window(fl["wetOnWet"], EARLY), window(fl["wetOnWet"], LATE),
                  last_hd, last_ww],
            "ww": ww, "hd": hd,
        })

    def mark(tests, key):
        if not tests:
            return
        sig = fdr_significant(np.array([p for _, p in tests]))
        for (k, _), s in zip(tests, sig):
            cells[k][key]["clear"] = bool(s)

    mark(wet_tests, "ww")
    mark(dry_tests, "hd")

    rows = []
    for c in cells:
        def pack(a):
            # lift, clear (1/0), event months in combination, event months; -1 when too few events
            return [-1, 0, 0, 0] if a is None else [a["lift"], int(a.get("clear", False)), a["inEvents"], a["eventMonths"]]
        rows.append(c["c"] + pack(c["ww"]) + pack(c["hd"]))

    hd_early = sum(r[2] for r in rows)
    hd_late = sum(r[3] for r in rows)
    ww_early = sum(r[4] for r in rows)
    ww_late = sum(r[5] for r in rows)
    payload = {
        "generated": date.today().isoformat(),
        "method": "Unusual = top/bottom 10% for that calendar month at that place, 1981-2025. Hot+dry: hot and dry in the same month. Wet on wet ground: wet month after a month in the top 25%. Link: one-sided Fisher exact test of event months vs other months 2000-2025 within 300 km, Benjamini-Hochberg alpha_FDR 0.10.",
        "early": list(EARLY),
        "late": list(LATE),
        "firstYear": Y0,
        "radiusKm": RADIUS_KM,
        "fields": ["lat", "lon", "hotDryEarly", "hotDryLate", "wetOnWetEarly", "wetOnWetLate", "lastHotDry", "lastWetOnWet",
                   "wwLift", "wwClear", "wwInEvents", "wwEventMonths", "hdLift", "hdClear", "hdInEvents", "hdEventMonths"],
        "totals": {"hotDry": [hd_early, hd_late], "wetOnWet": [ww_early, ww_late],
                   "wwTested": len(wet_tests), "wwClear": sum(r[9] for r in rows),
                   "hdTested": len(dry_tests), "hdClear": sum(r[13] for r in rows)},
        "cell": 2.0,
        "cells": rows,
    }
    (OUT / "compound.json").write_text(json.dumps(payload, separators=(",", ":")))

    # Timelines: the event month and the 12 months before, at the event's own cell.
    timeline = []
    for eid, name, name_bn, kind, y, m, lat, lon in EVENTS:
        i = int(np.argmin(np.abs(t_lats - lat)))
        jj = np.argsort(np.abs(((t_lons - lon) + 180) % 360 - 180))
        j = next((int(x) for x in jj[:3] if keep[i, x] and np.isfinite(temp[:, :, i, x]).all()), int(jj[0]))
        ri, rj = rain_cell(lat, lon)
        t, r = temp[:, :, i, j], rain[:, :, ri, rj]
        fl = flags(t, r)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            t_norm = np.nanmean(t[:30], axis=0)  # 1981-2010 by calendar month
            r_norm = np.nanmean(r[:30], axis=0)
        end = (y - Y0) * 12 + m - 1
        months = []
        for k in range(end - 12, end + 1):
            yy, mm = divmod(k, 12)
            months.append({
                "m": f"{Y0 + yy}-{mm + 1:02d}",
                "t": round(float(t[yy, mm] - t_norm[mm]), 2),
                "tr": round(float(fl["tr"][k]), 2),
                "r": round(float((r[yy, mm] / r_norm[mm] - 1) * 100), 0) if r_norm[mm] > 5 else None,
                "rr": round(float(fl["rr"][k]), 2),
                "hot": bool(fl["hot"][k]), "dry": bool(fl["dry"][k]), "wet": bool(fl["wet"][k]),
                "hotDry": bool(fl["hotDry"][k]), "wetOnWet": bool(fl["wetOnWet"][k]),
            })
        timeline.append({"id": eid, "name": name, "nameBn": name_bn, "type": kind, "month": f"{y}-{m:02d}",
                         "lat": lat, "lon": lon, "months": months})
    (OUT / "compound-events.json").write_text(json.dumps({"generated": date.today().isoformat(), "events": timeline}, separators=(",", ":")))

    print(f"{len(rows)} cells. Hot+dry months {hd_early} -> {hd_late}; wet-on-wet {ww_early} -> {ww_late} (1981-95 vs 2011-25)")
    print(f"Floods/landslides tested in {len(wet_tests)} cells, clear link in {payload['totals']['wwClear']}; droughts tested in {len(dry_tests)}, clear in {payload['totals']['hdClear']}")
    for e in timeline:
        firsts = [x["m"] for x in e["months"] if x["hot"] or x["dry"] or x["wet"]]
        print(f"  {e['name']:36s} unusual months before: {len(firsts):2d}  combos: {sum(x['hotDry'] or x['wetOnWet'] for x in e['months'])}")


if __name__ == "__main__":
    main()
