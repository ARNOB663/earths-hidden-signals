"""Global future: what NASA's downscaled projections (NEX-GDDP-CMIP6, 2 degrees, land only) say about
Earth's land in 2041-2060 compared with 1995-2014.

Every number is a model compared with its own 1995-2014 run, then summarised across the models whose
files are complete (median, range, how many agree), exactly like future.py does for South Asia:
- land-mean warming (area-weighted), per pathway;
- per cell, how often today's 1-in-10 hottest year recurs; the share of land where it becomes
  "almost every year" (9 or more years in 10);
- per cell, the change in its own rainy season (its four wettest consecutive months in the model's
  1995-2014 climate), with the number of models that agree on the direction.

Input: raw/cmip6_global/{model}/{scenario}/{pr,tas}_{year}.nc (cmip6_download.py --global)
Output: web/public/data/global/future.json

    python global_future.py
"""

from __future__ import annotations

import json
import warnings
from datetime import date
from pathlib import Path

import netCDF4
import numpy as np

from cmip6_download import MODELS, PERIODS
from twins import wettest_months

ROOT = Path(__file__).parent
RAW = ROOT / "raw" / "cmip6_global"
OUT = ROOT.parent / "web" / "public" / "data" / "global" / "future.json"
SCENARIOS = ("ssp245", "ssp585")
ALMOST_EVERY_YEAR = 0.9


def complete(model: str) -> bool:
    return all((RAW / model / s / f"{v}_{y}.nc").exists() for s, ys in PERIODS.items() for v in ("pr", "tas") for y in ys)


def read_year(model: str, period: str, year: int):
    """Annual mean temperature (deg C) and monthly rain totals (mm) per cell for one year."""
    out = {}
    for var in ("tas", "pr"):
        with netCDF4.Dataset(RAW / model / period / f"{var}_{year}.nc") as ds:
            lats, lons = ds["lat"][:].data, ds["lon"][:].data
            t = ds["time"]
            months = np.array([d.month for d in netCDF4.num2date(t[:], t.units, getattr(t, "calendar", "standard"))])
            data = np.ma.filled(ds[var][:].astype("f4"), np.nan)
        if var == "tas":
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                out["t"] = np.nanmean(data, axis=0) - 273.15
        else:
            data = data * 86400.0
            out["m"] = np.stack([np.nansum(data[months == mo], axis=0) for mo in range(1, 13)])
            out["land"] = np.isfinite(data).all(axis=0)
    return lats, lons, out


def model_periods(model: str):
    """{period: (annual temp [years, lat, lon], monthly rain [years, 12, lat, lon])}, plus grid and land mask."""
    res, lats, lons, land = {}, None, None, None
    for period, years in PERIODS.items():
        temps, rains = [], []
        for y in years:
            lats, lons, d = read_year(model, period, y)
            temps.append(d["t"])
            rains.append(d["m"])
            land = d["land"] if land is None else land & d["land"]
        res[period] = (np.stack(temps), np.stack(rains))
    return lats, lons, land, res


def wet_season_index(hist_monthly: np.ndarray, land: np.ndarray) -> np.ndarray:
    """[lat, lon, 4] month indices of each cell's four wettest consecutive months (model climatology)."""
    clim = hist_monthly.mean(axis=0)  # [12, lat, lon]
    idx = np.zeros(land.shape + (4,), dtype=int)
    for i, j in zip(*np.nonzero(land)):
        idx[i, j] = wettest_months(clim[:, i, j])
    return idx


def seasonal_total(monthly: np.ndarray, idx: np.ndarray) -> np.ndarray:
    """monthly [years, 12, lat, lon] + idx [lat, lon, 4] -> [years, lat, lon] rainy-season totals."""
    take = np.take_along_axis(monthly, np.moveaxis(idx, -1, 0)[None, ...], axis=1)
    return take.sum(axis=1)


def per_model(model: str):
    lats, lons, land, res = model_periods(model)
    h_t, h_m = res["historical"]
    idx = wet_season_index(h_m, land)
    h_w = seasonal_total(h_m, idx)
    weights = np.cos(np.deg2rad(lats))[:, None] * land
    hot_thr = np.percentile(h_t, 90, axis=0)
    out = {}
    for sc in SCENARIOS:
        f_t, f_m = res[sc]
        f_w = seasonal_total(f_m, idx)
        dt = f_t.mean(axis=0) - h_t.mean(axis=0)
        with np.errstate(divide="ignore", invalid="ignore"):
            dw = np.where(h_w.mean(axis=0) >= 30, (f_w.mean(axis=0) - h_w.mean(axis=0)) / h_w.mean(axis=0) * 100, np.nan)
        hot = (f_t > hot_thr).mean(axis=0)
        out[sc] = {
            "landWarming": float(np.nansum(dt * weights) / weights.sum()),
            "dt": np.where(land, dt, np.nan),
            "dw": np.where(land, dw, np.nan),
            "hot": np.where(land, hot, np.nan),
        }
    return lats, lons, land, weights, out


def summarise(results: dict, lats, lons, land, weights) -> dict:
    models = list(results)
    n = len(models)
    payload = {"scenarios": {}}
    for sc in SCENARIOS:
        lw = np.array([results[m][sc]["landWarming"] for m in models])
        dw = np.stack([results[m][sc]["dw"] for m in models])
        hot = np.stack([results[m][sc]["hot"] for m in models])
        dt = np.stack([results[m][sc]["dt"] for m in models])
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            dw_med = np.nanmedian(dw, axis=0)
            hot_med = np.nanmedian(hot, axis=0)
            dt_med = np.nanmedian(dt, axis=0)
        agree = (np.sign(dw) == np.sign(dw_med)[None]).sum(axis=0)
        needed = int(np.ceil(2 * n / 3))
        ok = land & np.isfinite(dw_med)
        almost = (hot_med >= ALMOST_EVERY_YEAR) & land
        cells = [
            # lat, lon, rainy-season change %, models agree (0/1), warming C, share of years beating today's 1-in-10 hot year
            [round(float(lats[i]), 2), round(float(lons[j] - 360 if lons[j] > 180 else lons[j]), 2), round(float(dw_med[i, j]), 1), int(agree[i, j] >= needed),
             round(float(dt_med[i, j]), 2), round(float(hot_med[i, j]), 2)]
            for i, j in zip(*np.nonzero(ok))
        ]
        wetter = int(((dw_med > 0) & (agree >= needed) & ok).sum())
        drier = int(((dw_med < 0) & (agree >= needed) & ok).sum())
        payload["scenarios"][sc] = {
            "landWarming": {"median": round(float(np.median(lw)), 2), "min": round(float(lw.min()), 2), "max": round(float(lw.max()), 2)},
            "hotEveryYearShare": round(float((weights * almost).sum() / weights.sum()), 3),
            "wetSeason": {"cells": int(ok.sum()), "wetterAgreed": wetter, "drierAgreed": drier, "agreeNeeded": needed},
            "cells": cells,
        }
    return payload


def main() -> None:
    models = [m for m in MODELS if complete(m)]
    if not models:
        raise SystemExit("No model has complete global files yet; run cmip6_download.py --global")
    print(f"Models: {', '.join(models)}")
    results, grid = {}, None
    for m in models:
        print(f"  {m}")
        lats, lons, land, weights, out = per_model(m)
        grid = (lats, lons, land, weights)
        results[m] = out
    lats, lons, land, weights = grid
    payload = {
        "generated": date.today().isoformat(),
        "dataset": "NASA NEX-GDDP-CMIP6, daily, bias-corrected and downscaled; used at 2 degrees, land only",
        "models": models,
        "present": [PERIODS["historical"][0], PERIODS["historical"][-1]],
        "future": [PERIODS["ssp245"][0], PERIODS["ssp245"][-1]],
        "cell": 2.0,
        **summarise(results, lats, lons, land, weights),
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    for sc in SCENARIOS:
        s = payload["scenarios"][sc]
        print(f"  {sc}: land +{s['landWarming']['median']} C ({s['landWarming']['min']}..{s['landWarming']['max']}), "
              f"hot year almost every year on {s['hotEveryYearShare']:.0%} of land, "
              f"rainy season wetter {s['wetSeason']['wetterAgreed']} / drier {s['wetSeason']['drierAgreed']} cells (agreed)")
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
