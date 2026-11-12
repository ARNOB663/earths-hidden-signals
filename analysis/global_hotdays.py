"""Days above 35 C: how many very hot days a year each land cell had in 1995-2014 and will have in
2041-2060, from NASA NEX-GDDP-CMIP6 daily maximum temperature (tasmax).

NEX-GDDP-CMIP6 is bias-corrected against observations, so an absolute threshold like 35 C is meaningful
(that is the point of the dataset). Each model's 1995-2014 run gives its "today"; the site reports the
median across models of the average number of days a year above 35 C, for today and for both paths,
plus the lowest and highest model for the future.

Cells are sampled every 2 degrees (horizStride 8 of the 0.25-degree grid), like global_future.py, so a
value describes that point of the grid, not an area average.

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
THRESHOLD_C = 35.0
SCENARIOS = ("ssp245", "ssp585")


def complete(model: str) -> bool:
    return all((RAW / model / s / f"tasmax_{y}.nc").exists() for s, ys in PERIODS.items() for y in ys)


def hot_days(tasmax_k: np.ndarray, threshold_c: float = THRESHOLD_C) -> np.ndarray:
    """[days, lat, lon] in kelvin -> [lat, lon] count of days above the threshold (NaN where no data)."""
    count = (tasmax_k > threshold_c + 273.15).sum(axis=0).astype("f4")
    return np.where(np.isfinite(tasmax_k).all(axis=0), count, np.nan)


def period_mean(model: str, period: str):
    """Average yearly count of hot days over a period, plus the grid."""
    counts, lats, lons = [], None, None
    for year in PERIODS[period]:
        with netCDF4.Dataset(RAW / model / period / f"tasmax_{year}.nc") as ds:
            lats, lons = ds["lat"][:].data, ds["lon"][:].data
            counts.append(hot_days(np.ma.filled(ds["tasmax"][:].astype("f4"), np.nan)))
    return lats, lons, np.mean(counts, axis=0)


def main() -> None:
    models = [m for m in MODELS if complete(m)]
    if not models:
        raise SystemExit("No model has complete tasmax files; run cmip6_download.py --global --vars tasmax")
    print(f"Models: {', '.join(models)}")
    per = {p: [] for p in ("historical", *SCENARIOS)}
    lats = lons = None
    for m in models:
        print(f"  {m}")
        for p in per:
            lats, lons, mean = period_mean(m, p)
            per[p].append(mean)
    stack = {p: np.stack(v) for p, v in per.items()}
    med = {p: np.median(v, axis=0) for p, v in stack.items()}
    land = np.isfinite(med["historical"])
    weights = np.cos(np.deg2rad(lats))[:, None] * land

    cells = []
    for i, j in zip(*np.nonzero(land)):
        lon = float(lons[j] - 360 if lons[j] > 180 else lons[j])
        # lat, lon, days/yr 1995-2014, 2041-2060 middle road, 2041-2060 high emissions
        cells.append([round(float(lats[i]), 2), round(lon, 2), round(float(med["historical"][i, j]), 1),
                      round(float(med["ssp245"][i, j]), 1), round(float(med["ssp585"][i, j]), 1)])

    def land_mean(a):
        return round(float(np.nansum(a * weights) / weights.sum()), 1)

    payload = {
        "generated": date.today().isoformat(),
        "dataset": "NASA NEX-GDDP-CMIP6 daily maximum temperature (tasmax), bias-corrected; sampled every 2 degrees, land only",
        "thresholdC": THRESHOLD_C,
        "models": models,
        "present": [PERIODS["historical"][0], PERIODS["historical"][-1]],
        "future": [PERIODS["ssp245"][0], PERIODS["ssp245"][-1]],
        "cell": 2.0,
        "landMeanDays": {p: land_mean(med[p]) for p in med},
        "cells": cells,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"Land average days above {THRESHOLD_C:.0f} C a year: " + ", ".join(f"{p} {v}" for p, v in payload["landMeanDays"].items()))
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB, {len(cells)} cells)")


if __name__ == "__main__":
    main()
