"""Monthly series per location for intelligence.py --refresh (needs network on first run).

Reads monthly GISTEMP and GPCP fields with the existing loaders (sources.py, cached in raw/),
area-weights them onto every country and research region, and writes
web/public/data/intelligence/inputs/monthly.json. That file is committed, so later offline runs
(and CI) reproduce the monthly assessment byte for byte.

    python monthly.py        # or: python intelligence.py --refresh
"""

from __future__ import annotations

import json
import math
from datetime import date

import netCDF4
import numpy as np
from shapely.geometry import box, shape

import sources
from build import MIN_LAND_FRACTION, zone_weights
from intel import inputs
from intel.periods import MONTH_KEYS, monthly_total_mm
from intel.thresholds import MIN_COVERAGE_PCT

FIRST_YEAR = 1981


def polygon_cell_weights(geometry, lats: np.ndarray, lons: np.ndarray, d_lat: float, d_lon: float, land: np.ndarray) -> np.ndarray:
    """Polygon area inside each cell x cos(latitude) x land mask (build_country_signals weighting)."""
    poly = shape(geometry)
    w = np.zeros((lats.size, lons.size))
    for i, la in enumerate(lats):
        for j, lo in enumerate(lons):
            cell = box(lo - d_lon / 2, la - d_lat / 2, lo + d_lon / 2, la + d_lat / 2)
            if poly.intersects(cell):
                w[i, j] = poly.intersection(cell).area * math.cos(math.radians(la))
    return w * land


def aggregate(values: np.ndarray, weights: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Weighted mean over the last two axes, skipping missing cells; NaN where coverage < MIN_COVERAGE_PCT.

    Returns (series, coverage percent).
    """
    present = np.isfinite(values)
    have = (present * weights).sum(axis=(-2, -1))
    total = weights.sum()
    cov = have / total * 100 if total > 0 else np.zeros(have.shape)
    mean = (np.where(present, values, 0.0) * weights).sum(axis=(-2, -1)) / np.where(have > 0, have, 1.0)
    return np.where(cov >= MIN_COVERAGE_PCT, mean, np.nan), cov


def to_totals(rates: np.ndarray, years: list[int]) -> np.ndarray:
    """GPCP (years, 12, ...) mean rates in mm/day -> monthly totals in mm, converted exactly once."""
    out = np.empty_like(rates)
    for yi, y in enumerate(years):
        for m in range(12):
            out[yi, m] = monthly_total_mm(rates[yi, m], y, m + 1)
    return out


def gpcp_with_current_year(this_year: int):
    """Complete years from load_gpcp plus this year's published months (as latest.py does)."""
    years = list(range(FIRST_YEAR, this_year))
    lats, lons, monthly = sources.load_gpcp(years)
    extra = np.full((1, 12, lats.size, lons.size), np.nan)
    listing: dict[int, list[str]] = {}
    for m in range(1, 13):
        try:
            path = sources._gpcp_file(this_year, m, listing)
        except (FileNotFoundError, RuntimeError):
            break
        with netCDF4.Dataset(path) as ds:
            la, lo = ds["latitude"][:].data, ds["longitude"][:].data
            li = np.nonzero((la >= lats[0]) & (la <= lats[-1]))[0]
            lj = np.nonzero((lo >= lons[0]) & (lo <= lons[-1]))[0]
            extra[0, m - 1] = np.ma.filled(ds["precip"][0].astype(float), np.nan)[np.ix_(li, lj)]
    return lats, lons, np.concatenate([monthly, extra]), years + [this_year]


def rounded(v: np.ndarray, d: int) -> list:
    return [None if not np.isfinite(x) else round(float(x), d) for x in v]


def main() -> None:
    this_year = date.today().year
    data = inputs.load()
    places = data["placeSignals"]["places"]
    zones = {z["id"]: z for z in data["trendZones"]["zones"]}

    t_years = list(range(FIRST_YEAR, this_year + 1))
    t_lats, t_lons, temp = sources.load_gistemp(t_years)
    r_lats, r_lons, rates, r_years = gpcp_with_current_year(this_year)
    rain = to_totals(rates, r_years)

    out = {"schema": "monthly-inputs-v1", "generated": date.today().isoformat(), "geographies": {}}
    for var, lats, lons, cell, values, years, d in (
        ("temperature", t_lats, t_lons, (2.0, 2.0), temp, t_years, 2),
        ("rainfall", r_lats, r_lons, (2.5, 2.5), rain, r_years, 0),
    ):
        land_frac = sources.land_fraction(lats, lons, *cell)
        land = land_frac * (land_frac >= MIN_LAND_FRACTION)
        for p in places:
            if p["type"] == "country":
                w = polygon_cell_weights(p["geometry"], lats, lons, *cell, land > 0)
                geo_id = {"BGD": "bangladesh", "BTN": "bhutan", "IND": "india", "NPL": "nepal", "PAK": "pakistan", "LKA": "sri-lanka"}[p["countryCode"]]
            else:
                w = zone_weights(zones[p["id"]]["bbox"], lats, lons, cell, land)
                geo_id = p["id"]
            geo = out["geographies"].setdefault(geo_id, {})
            for m, key in enumerate(MONTH_KEYS):
                series, cov = aggregate(values[:, m], w)
                # Keep trailing months that are not yet published out of the record.
                yrs = [y for y, v in zip(years, series) if np.isfinite(v) or y < this_year]
                geo[f"{var}_{key}"] = {"years": yrs, "series": rounded(series[: len(yrs)], d),
                                       "coveragePct": [round(float(c), 1) for c in cov[: len(yrs)]]}
    target = inputs.OUT / "inputs" / "monthly.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    print(f"Wrote monthly series for {len(out['geographies'])} geographies to {target}")


if __name__ == "__main__":
    main()
