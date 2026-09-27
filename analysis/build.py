"""Build trend results for the website.

Run:  python build.py
Writes JSON to ../web/public/data/trends/ (format described in README.md).
"""

from __future__ import annotations

import calendar
import json
import warnings
from datetime import date
from pathlib import Path

import numpy as np

import power
import sources
from stats import fdr_significant, trend

# Sea cells give all-NaN means and some Hamed-Rao corrections are invalid (handled in stats.trend).
warnings.filterwarnings("ignore", category=RuntimeWarning)

OUT_DIR = Path(__file__).parent.parent / "web" / "public" / "data" / "trends"
ZONES_FILE = Path(__file__).parent / "zones.json"
YEARS = list(range(power.START_YEAR, power.END_YEAR + 1))
# Coarse cells count as land if at least this share of them is land (keeps coasts and Sri Lanka).
MIN_LAND_FRACTION = 0.25

VARIABLES = {
    "temperature": {
        "label": "Surface temperature",
        "dataset": "NASA GISTEMP v4 (GISS), 2° grid",
        "datasetUrl": "https://data.giss.nasa.gov/gistemp/",
        "cellSize": [2.0, 2.0],
        "aggregate": "mean",
        "unit": "°C",
        "anomaly": True,
        "baseline": "1951–1980 average",
        "decimals": 2,
        "increase": "warming",
        "decrease": "cooling",
    },
    "rainfall": {
        "label": "Rainfall",
        "dataset": "GPCP v2.3 monthly precipitation (NASA GSFC / NOAA), 2.5° grid",
        "datasetUrl": "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-monthly",
        "cellSize": [2.5, 2.5],
        "aggregate": "total",  # mm/day monthly means -> seasonal totals in mm
        "unit": "mm",
        "anomaly": False,
        "baseline": None,
        "decimals": 0,
        "increase": "wetter",
        "decrease": "drier",
    },
}

SEASONS = {
    "annual": {"label": "Whole year", "months": list(range(1, 13))},
    "pre-monsoon": {"label": "Pre-monsoon (Mar–May)", "months": [3, 4, 5]},
    "monsoon": {"label": "Monsoon (Jun–Sep)", "months": [6, 7, 8, 9]},
}


def seasonal(monthly: np.ndarray, months: list[int], aggregate: str) -> np.ndarray:
    """(years, 12, lat, lon) monthly grid -> (years, lat, lon) seasonal values."""
    idx = [m - 1 for m in months]
    if aggregate == "mean":
        return monthly[:, idx].mean(axis=1)
    days = np.array([[calendar.monthrange(y, m)[1] for m in months] for y in YEARS], dtype=float)
    return (monthly[:, idx] * days[:, :, None, None]).sum(axis=1)


def zone_weights(zone_bbox, lats, lons, cell, land_frac) -> np.ndarray:
    """Weight of each cell in a zone: share of the cell inside the box x land share x cos(latitude)."""
    la0, la1, lo0, lo1 = zone_bbox
    d_lat, d_lon = cell
    ov_lat = np.clip(np.minimum(lats + d_lat / 2, la1) - np.maximum(lats - d_lat / 2, la0), 0, None) / d_lat
    ov_lon = np.clip(np.minimum(lons + d_lon / 2, lo1) - np.maximum(lons - d_lon / 2, lo0), 0, None) / d_lon
    return ov_lat[:, None] * ov_lon[None, :] * land_frac * np.cos(np.deg2rad(lats))[:, None]


def write_json(path: Path, data, **kwargs) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, **kwargs), encoding="utf-8")


def rounded(values: np.ndarray, decimals: int) -> list:
    return [None if not np.isfinite(v) else round(float(v), decimals) for v in np.ravel(values)]


def trend_summary(t, decimals: int) -> dict | None:
    if t is None:
        return None
    return {
        "slopePerDecade": round(t.slope * 10, decimals + 2),
        "lowerPerDecade": round(t.lower * 10, decimals + 2),
        "upperPerDecade": round(t.upper * 10, decimals + 2),
        "p": round(t.p, 5),
    }


def load(var: str):
    return sources.load_gistemp(YEARS) if var == "temperature" else sources.load_gpcp(YEARS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob("*.json"):
        stale.unlink()
    zones = json.loads(ZONES_FILE.read_text(encoding="utf-8"))["zones"]
    zone_results: dict = {z["id"]: {} for z in zones}
    grids, summaries = {}, {}

    for var, meta in VARIABLES.items():
        print(f"Loading {var}")
        lats, lons, monthly = load(var)
        d_lat, d_lon = meta["cellSize"]
        land_frac = sources.land_fraction(lats, lons, d_lat, d_lon)
        land = land_frac >= MIN_LAND_FRACTION
        print(f"  grid {lats.size} x {lons.size}, land cells {land.sum()}")
        grids[var] = {
            "lat0": float(lats[0]), "dLat": d_lat, "nLat": int(lats.size),
            "lon0": float(lons[0]), "dLon": d_lon, "nLon": int(lons.size),
        }

        for season, smeta in SEASONS.items():
            key = f"{var}_{season}"
            print(f"  trends: {key}")
            values = seasonal(monthly, smeta["months"], meta["aggregate"])
            values[:, ~land] = np.nan

            slope, lower, upper, p = (np.full(land.shape, np.nan) for _ in range(4))
            for i, j in zip(*np.nonzero(land)):
                t = trend(values[:, i, j])
                if t is not None:
                    slope[i, j], lower[i, j], upper[i, j], p[i, j] = t.slope, t.lower, t.upper, t.p
            significant = fdr_significant(p)
            dec = meta["decimals"]

            write_json(
                OUT_DIR / f"{key}.json",
                {
                    "slopePerDecade": rounded(slope * 10, dec + 2),
                    "lowerPerDecade": rounded(lower * 10, dec + 2),
                    "upperPerDecade": rounded(upper * 10, dec + 2),
                    "p": rounded(p, 5),
                    "significant": [int(s) for s in significant.ravel()],
                    "mean": rounded(np.nanmean(values, axis=0), dec),
                },
                separators=(",", ":"),
            )
            flat = values.reshape(len(YEARS), -1)
            write_json(
                OUT_DIR / f"{key}_series.json",
                [rounded(flat[:, k], dec) if land.ravel()[k] else None for k in range(land.size)],
                separators=(",", ":"),
            )

            summaries[key] = {
                "cells": int(np.isfinite(p).sum()),
                "significantIncrease": int((significant & (slope > 0)).sum()),
                "significantDecrease": int((significant & (slope < 0)).sum()),
                "medianSlopePerDecade": round(float(np.nanmedian(slope) * 10), dec + 2),
            }

            for z in zones:
                w = zone_weights(z["bbox"], lats, lons, (d_lat, d_lon), land_frac * land)
                series = (np.nan_to_num(values) * w).sum(axis=(1, 2)) / w.sum()
                zone_results[z["id"]][key] = {
                    "series": rounded(series, dec),
                    "mean": round(float(series.mean()), dec),
                    "trend": trend_summary(trend(series), dec),
                }

    manifest = {
        "generated": date.today().isoformat(),
        "method": {
            "test": "Hamed-Rao modified Mann-Kendall (autocorrelation-corrected), two-sided",
            "slope": "Sen's slope with 95% confidence interval",
            "multipleTesting": "Benjamini-Hochberg false discovery rate, alpha_FDR = 0.10 (Wilks 2016)",
        },
        "years": YEARS,
        "grids": grids,
        "variables": {v: {k: m[k] for k in m if k != "cellSize"} for v, m in VARIABLES.items()},
        "seasons": {s: {"label": m["label"], "months": m["months"]} for s, m in SEASONS.items()},
        "summaries": summaries,
    }
    write_json(OUT_DIR / "manifest.json", manifest, indent=1)
    write_json(
        OUT_DIR / "zones.json",
        {"zones": [{**z, "results": zone_results[z["id"]]} for z in zones]},
        separators=(",", ":"),
    )
    print(f"Wrote results to {OUT_DIR}")


if __name__ == "__main__":
    main()
