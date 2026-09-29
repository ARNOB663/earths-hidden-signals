"""The most recent month compared with normal, for the home page ("This month vs normal").

Temperature: latest GISTEMP month, as an anomaly vs 1951-1980, ranked against the same month
since 1981. Rainfall: latest GPCP month as a percentage of its 1991-2020 average for that month.

Run after build.py:  python latest.py
Writes ../web/public/data/latest.json
"""

from __future__ import annotations

import calendar
import json
from pathlib import Path

import netCDF4
import numpy as np

import sources
from build import MIN_LAND_FRACTION, zone_weights

OUT = Path(__file__).parent.parent / "web" / "public" / "data" / "latest.json"
ZONES = json.loads((Path(__file__).parent / "zones.json").read_text(encoding="utf-8"))["zones"]
FIRST = 1981


def area_means(values: np.ndarray, lats, lons, cell, land_frac) -> dict[str, np.ndarray]:
    """Zone-average series (last two axes are lat, lon)."""
    out = {}
    for z in ZONES:
        w = zone_weights(z["bbox"], lats, lons, cell, land_frac)
        out[z["id"]] = (np.nan_to_num(values) * w).sum(axis=(-2, -1)) / w.sum()
    return out


def rank_desc(value: float, history: np.ndarray) -> int:
    """1 = highest in the record."""
    return int((history > value).sum()) + 1


def temperature():
    this_year = 2026
    years = list(range(FIRST, this_year + 1))
    lats, lons, monthly = sources.load_gistemp(years)
    land = sources.land_fraction(lats, lons, 2.0, 2.0)
    land = land * (land >= MIN_LAND_FRACTION)
    valid = np.isfinite(monthly).any(axis=(2, 3))  # (years, 12)
    yi, mi = [int(x[-1]) for x in np.nonzero(valid)]
    month = f"{years[yi]}-{mi + 1:02d}"
    same_month = monthly[: yi + 1, mi]  # every year's value for that month, up to now
    means = area_means(same_month, lats, lons, (2.0, 2.0), land)
    return month, {
        zid: {
            "anomaly": round(float(s[-1]), 2),
            "rank": rank_desc(s[-1], s),
            "of": int(len(s)),
        }
        for zid, s in means.items()
    }


def rainfall():
    years = list(range(FIRST, 2026))
    lats, lons, monthly = sources.load_gpcp(years)
    # Add 2026 months one by one until the archive runs out.
    listing: dict[int, list[str]] = {}
    extra = []
    for m in range(1, 13):
        try:
            path = sources._gpcp_file(2026, m, listing)
        except (FileNotFoundError, RuntimeError):
            break
        with netCDF4.Dataset(path) as ds:
            la, lo = ds["latitude"][:].data, ds["longitude"][:].data
            li = np.nonzero((la >= lats[0]) & (la <= lats[-1]))[0]
            lj = np.nonzero((lo >= lons[0]) & (lo <= lons[-1]))[0]
            extra.append(np.ma.filled(ds["precip"][0].astype(float), np.nan)[np.ix_(li, lj)])
    if extra:
        year, mi, latest = 2026, len(extra) - 1, extra[-1]
        history = monthly[:, mi]
    else:
        year, mi = years[-1], 11
        latest, history = monthly[-1, mi], monthly[:-1, mi]
    land = sources.land_fraction(lats, lons, 2.5, 2.5)
    land = land * (land >= MIN_LAND_FRACTION)
    base = history[years.index(1991) : years.index(2020) + 1].mean(axis=0)
    days = calendar.monthrange(year, mi + 1)[1]
    latest_m = area_means(latest, lats, lons, (2.5, 2.5), land)
    base_m = area_means(base, lats, lons, (2.5, 2.5), land)
    hist_m = area_means(history, lats, lons, (2.5, 2.5), land)
    return f"{year}-{mi + 1:02d}", {
        zid: {
            "percentOfNormal": round(float(latest_m[zid] / base_m[zid] * 100)),
            "mm": round(float(latest_m[zid] * days)),
            "rank": rank_desc(latest_m[zid], np.append(hist_m[zid], latest_m[zid])),
            "of": int(len(hist_m[zid]) + 1),
        }
        for zid in latest_m
    }


def main():
    t_month, t_zones = temperature()
    r_month, r_zones = rainfall()
    data = {
        "temperature": {"month": t_month, "baseline": "1951–1980", "zones": t_zones},
        "rainfall": {"month": r_month, "baseline": "1991–2020", "zones": r_zones},
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(t_month, t_zones["study-area"], "|", r_month, r_zones["study-area"])


if __name__ == "__main__":
    main()
