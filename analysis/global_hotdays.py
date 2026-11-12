"""Very hot days: how often each land cell gets a day as hot as its own hottest 5% of days in 1995-2014,
by 2041-2060, from NASA NEX-GDDP-CMIP6 daily maximum temperature (tasmax).

Why a local threshold and not a fixed one like 35 C: cells are sampled every 2 degrees (one grid point,
not an area average), so a fixed threshold is very sensitive to whether the point sits on the coast, inland
or on a mountain, and a town can be up to ~150 km from its point. Checked against known towns, a fixed
35 C gave Lagos 78 hot days a year (it rarely passes 33 C) and Phoenix 51 (it has well over 100). The
local threshold asks only how the point's own heat changes, which the data can answer: by construction
today has about 18 such days a year (5% of 365), and the site reports how many each path brings.

Each model is compared with its own 1995-2014 run; the site shows the median across models.

Input: raw/cmip6_global/{model}/{scenario}/tasmax_{year}.nc  (cmip6_download.py --global --vars tasmax)
Output: web/public/data/global/hotdays.json
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import netCDF4
import numpy as np

from cmip6_download import MODELS, PERIODS

ROOT = Path(__file__).parent
RAW = ROOT / "raw" / "cmip6_global"
OUT = ROOT.parent / "web" / "public" / "data" / "global" / "hotdays.json"
PERCENTILE = 95.0
SCENARIOS = ("ssp245", "ssp585")


def complete(model: str) -> bool:
    return all((RAW / model / s / f"tasmax_{y}.nc").exists() for s, ys in PERIODS.items() for y in ys)


def read_period(model: str, period: str):
    """All daily tasmax of a period, [days, lat, lon] in kelvin (NaN where no data), plus the grid."""
    days, lats, lons = [], None, None
    for year in PERIODS[period]:
        with netCDF4.Dataset(RAW / model / period / f"tasmax_{year}.nc") as ds:
            lats, lons = ds["lat"][:].data, ds["lon"][:].data
            days.append(np.ma.filled(ds["tasmax"][:].astype("f4"), np.nan))
    return lats, lons, np.concatenate(days)


def days_above(daily: np.ndarray, threshold: np.ndarray, years: int) -> np.ndarray:
    """Average number of days a year above a per-cell threshold. daily [days, cells], threshold [cells]."""
    return (daily > threshold[None, :]).sum(axis=0) / years


def model_hot_days(model: str):
    lats, lons, hist = read_period(model, "historical")
    land = np.isfinite(hist).all(axis=0)
    hl = hist[:, land]
    thr = np.percentile(hl, PERCENTILE, axis=0)
    out = {"historical": days_above(hl, thr, len(PERIODS["historical"]))}
    for sc in SCENARIOS:
        _, _, fut = read_period(model, sc)
        out[sc] = days_above(fut[:, land], thr, len(PERIODS[sc]))
    return lats, lons, land, out


def main() -> None:
    models = [m for m in MODELS if complete(m)]
    if not models:
        raise SystemExit("No model has complete tasmax files; run cmip6_download.py --global --vars tasmax")
    print(f"Models: {', '.join(models)}")
    lats = lons = land = None
    per = {p: [] for p in ("historical", *SCENARIOS)}
    for m in models:
        print(f"  {m}")
        lats, lons, m_land, out = model_hot_days(m)
        if land is None:
            land = m_land
        elif not np.array_equal(land, m_land):
            raise SystemExit(f"{m}: land mask differs from the first model")
        for p in per:
            per[p].append(out[p])
    med = {p: np.median(np.stack(v), axis=0) for p, v in per.items()}
    idx = np.argwhere(land)
    w = np.cos(np.deg2rad(lats[idx[:, 0]]))

    cells = []
    for k, (i, j) in enumerate(idx):
        lon = float(lons[j] - 360 if lons[j] > 180 else lons[j])
        # lat, lon, very hot days a year by 2041-2060: middle road, high emissions (today is ~18 by construction)
        cells.append([round(float(lats[i]), 2), round(lon, 2), round(float(med["ssp245"][k]), 1), round(float(med["ssp585"][k]), 1)])

    payload = {
        "generated": date.today().isoformat(),
        "dataset": "NASA NEX-GDDP-CMIP6 daily maximum temperature (tasmax), bias-corrected; sampled every 2 degrees, land only",
        "definition": "days a year hotter than the cell's own hottest 5% of days in 1995-2014 (each model against its own run)",
        "percentile": PERCENTILE,
        "todayDays": round(float(np.median(med["historical"])), 1),
        "models": models,
        "present": [PERIODS["historical"][0], PERIODS["historical"][-1]],
        "future": [PERIODS["ssp245"][0], PERIODS["ssp245"][-1]],
        "cell": 2.0,
        "landMeanDays": {p: round(float((med[p] * w).sum() / w.sum()), 1) for p in med},
        "cells": cells,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print("Land average very hot days a year: " + ", ".join(f"{p} {v}" for p, v in payload["landMeanDays"].items()))
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB, {len(cells)} cells)")


if __name__ == "__main__":
    main()
