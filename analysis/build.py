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
# A "very hot month" is at least this much warmer than the 1951-1980 average for that month.
HOT_MONTH_ANOMALY = 1.0
# A "very heavy rain day" is wetter than this percentile of the place's rainy days (>= 1 mm).
HEAVY_RAIN_PERCENTILE = 95

GISTEMP_META = {
    "dataset": "NASA GISTEMP v4 (GISS), 2° grid",
    "datasetUrl": "https://data.giss.nasa.gov/gistemp/",
    "cellSize": [2.0, 2.0],
}
GPCP_META = {
    "dataset": "GPCP v2.3 monthly precipitation (NASA GSFC / NOAA), 2.5° grid",
    "datasetUrl": "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-monthly",
    "cellSize": [2.5, 2.5],
}
GPCP_DAILY_META = {
    "dataset": "GPCP 1DD v1.3 daily precipitation (NASA GSFC / NOAA), 1° grid",
    "datasetUrl": "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-daily",
    "cellSize": [1.0, 1.0],
}

VARIABLES = {
    "temperature": {
        **GISTEMP_META,
        "label": "Surface temperature",
        "aggregate": "mean",
        "unit": "°C",
        "anomaly": True,
        "baseline": "1951–1980 average",
        "decimals": 2,
        "increase": "warming",
        "decrease": "cooling",
        "kind": "average",
    },
    "rainfall": {
        **GPCP_META,
        "label": "Rainfall",
        "aggregate": "total",  # mm/day monthly means -> seasonal totals in mm
        "unit": "mm",
        "anomaly": False,
        "baseline": None,
        "decimals": 0,
        "increase": "wetter",
        "decrease": "drier",
        "kind": "average",
    },
    "hot-months": {
        **GISTEMP_META,
        "label": "Very hot months",
        "aggregate": "count",
        "unit": "months",
        "anomaly": False,
        "baseline": None,
        "decimals": 1,
        "increase": "more very hot months",
        "decrease": "fewer very hot months",
        "kind": "extreme",
        "definition": f"Months at least {HOT_MONTH_ANOMALY:g} °C warmer than the 1951–1980 average for that month.",
    },
    "heavy-rain": {
        **GPCP_DAILY_META,
        "label": "Very heavy rain days",
        "aggregate": "count",
        "unit": "days",
        "anomaly": False,
        "baseline": None,
        "decimals": 1,
        "increase": "more heavy-rain days",
        "decrease": "fewer heavy-rain days",
        "kind": "extreme",
        "definition": f"Days wetter than the local {HEAVY_RAIN_PERCENTILE}th percentile of rainy days (1 mm or more), 1997–{power.END_YEAR}.",
    },
    "dry-spell": {
        **GPCP_DAILY_META,
        "label": "Longest dry spell in the monsoon",
        "aggregate": "max",
        "unit": "days",
        "anomaly": False,
        "baseline": None,
        "decimals": 1,
        "increase": "longer dry spells",
        "decrease": "shorter dry spells",
        "kind": "extreme",
        "definition": "The longest run of days with less than 1 mm of rain during June–September: a sign of monsoon breaks and drought.",
    },
    "wettest-day": {
        **GPCP_DAILY_META,
        "label": "Wettest day of the year",
        "aggregate": "max",
        "unit": "mm",
        "anomaly": False,
        "baseline": None,
        "decimals": 1,
        "increase": "heavier downpours",
        "decrease": "lighter downpours",
        "kind": "extreme",
        "definition": "The most rain that fell on a single day in each year.",
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


def prepare(var: str):
    """Returns (lats, lons, years, {season: values[years, lat, lon]}) for one variable."""
    if var in ("temperature", "rainfall"):
        lats, lons, monthly = sources.load_gistemp(YEARS) if var == "temperature" else sources.load_gpcp(YEARS)
        agg = VARIABLES[var]["aggregate"]
        return lats, lons, YEARS, {s: seasonal(monthly, m["months"], agg) for s, m in SEASONS.items()}

    if var == "hot-months":
        lats, lons, monthly = sources.load_gistemp(YEARS)
        hot = (np.nan_to_num(monthly, nan=-99) >= HOT_MONTH_ANOMALY).sum(axis=1).astype(float)
        hot[:, ~np.isfinite(monthly).any(axis=(0, 1))] = np.nan
        return lats, lons, YEARS, {"annual": hot}

    import daily  # only needed for the daily-rain indicators

    lats, lons, years, per_year, months = daily.load()
    if var == "wettest-day":
        # A few days are missing in the record; skip them rather than blanking the whole year.
        return lats, lons, years, {"annual": np.stack([np.nanmax(p, axis=0) for p in per_year])}
    if var == "dry-spell":
        spells = []
        for p, m in zip(per_year, months):
            run = np.zeros(p.shape[1:])
            longest = np.zeros(p.shape[1:])
            for day in p[np.isin(m, [6, 7, 8, 9])]:
                run = np.where(day < 1.0, run + 1, 0)
                longest = np.maximum(longest, run)
            spells.append(longest)
        return lats, lons, years, {"annual": np.stack(spells)}
    # Very heavy rain days: above the local 95th percentile of all rainy days in the record.
    everything = np.concatenate(per_year)
    rainy = np.where(everything >= 1.0, everything, np.nan)
    threshold = np.nanpercentile(rainy, HEAVY_RAIN_PERCENTILE, axis=0)
    counts = np.stack([(p > threshold).sum(axis=0) for p in per_year]).astype(float)
    return lats, lons, years, {"annual": counts}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    zones = json.loads(ZONES_FILE.read_text(encoding="utf-8"))["zones"]
    zone_results: dict = {z["id"]: {} for z in zones}
    grids, summaries, var_years, var_seasons = {}, {}, {}, {}

    for var, meta in VARIABLES.items():
        print(f"Loading {var}")
        lats, lons, years, by_season = prepare(var)
        d_lat, d_lon = meta["cellSize"]
        land_frac = sources.land_fraction(lats, lons, d_lat, d_lon)
        land = land_frac >= MIN_LAND_FRACTION
        print(f"  grid {lats.size} x {lons.size}, land cells {land.sum()}")
        grids[var] = {
            "lat0": float(lats[0]), "dLat": d_lat, "nLat": int(lats.size),
            "lon0": float(lons[0]), "dLon": d_lon, "nLon": int(lons.size),
        }
        var_years[var] = years
        var_seasons[var] = list(by_season)

        for season, values in by_season.items():
            key = f"{var}_{season}"
            print(f"  trends: {key}")
            values = values.copy()
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
            flat = values.reshape(len(years), -1)
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
        "variables": {
            v: {**{k: m[k] for k in m if k != "cellSize"}, "years": var_years[v], "seasons": var_seasons[v]}
            for v, m in VARIABLES.items()
        },
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
