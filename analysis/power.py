"""Download monthly NASA POWER data (MERRA-2 based) for South Asia and assemble a grid.

POWER's regional API allows one parameter and a 10 x 10 degree box per request, so the
study area is split into tiles. Each tile is cached under raw/, so re-runs only fetch
what is missing and never hammer the API.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import requests

API = "https://power.larc.nasa.gov/api/temporal/monthly/regional"
RAW_DIR = Path(__file__).parent / "raw"

# South Asia study box (the whole region, not country by country).
LAT_MIN, LAT_MAX = 5.0, 38.0
LON_MIN, LON_MAX = 60.0, 100.0
# POWER's meteorology grid is MERRA-2's: 0.5 deg latitude x 0.625 deg longitude.
LAT_STEP, LON_STEP = 0.5, 0.625

START_YEAR, END_YEAR = 1981, 2025
FILL = -999.0


def _tile_edges(lo: float, hi: float, span: float = 10.0) -> list[tuple[float, float]]:
    edges, a = [], lo
    while a < hi:
        edges.append((a, min(a + span, hi)))
        a += span
    return edges


def _fetch_tile(param: str, lat0: float, lat1: float, lon0: float, lon1: float) -> dict:
    cache = RAW_DIR / param / f"{lat0:g}_{lat1:g}_{lon0:g}_{lon1:g}.json"
    if cache.exists():
        return json.loads(cache.read_text())

    params = {
        "parameters": param,
        "community": "AG",
        "latitude-min": lat0,
        "latitude-max": lat1,
        "longitude-min": lon0,
        "longitude-max": lon1,
        "start": START_YEAR,
        "end": END_YEAR,
        "format": "JSON",
    }
    for attempt in range(5):
        try:
            res = requests.get(API, params=params, timeout=300)
            if res.status_code == 200:
                break
            print(f"  {param} tile {lat0},{lon0}: HTTP {res.status_code}, retrying")
        except requests.RequestException as exc:
            print(f"  {param} tile {lat0},{lon0}: {exc}, retrying")
        time.sleep(5 * (attempt + 1))
    else:
        raise RuntimeError(f"POWER request failed for {param} tile {lat0},{lon0}")

    # Keep only what we use: coordinates and the monthly values.
    slim = {
        "points": [
            [f["geometry"]["coordinates"][0], f["geometry"]["coordinates"][1], f["properties"]["parameter"][param]]
            for f in res.json()["features"]
        ]
    }
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(slim))
    time.sleep(1)  # be polite to the public API
    return slim


def grid_axes() -> tuple[np.ndarray, np.ndarray]:
    lats = np.round(np.arange(LAT_MIN, LAT_MAX + LAT_STEP / 2, LAT_STEP), 4)
    lons = np.round(np.arange(LON_MIN, LON_MAX + LON_STEP / 2, LON_STEP), 4)
    return lats, lons


def load_monthly_grid(param: str) -> np.ndarray:
    """Returns monthly values shaped (years, 12, lat, lon), NaN where POWER has no data."""
    lats, lons = grid_axes()
    n_years = END_YEAR - START_YEAR + 1
    grid = np.full((n_years, 12, lats.size, lons.size), np.nan, dtype=np.float64)
    lat_index = {v: i for i, v in enumerate(lats)}
    lon_index = {v: i for i, v in enumerate(lons)}

    tiles = [(a, b, c, d) for a, b in _tile_edges(LAT_MIN, LAT_MAX) for c, d in _tile_edges(LON_MIN, LON_MAX)]
    for n, (lat0, lat1, lon0, lon1) in enumerate(tiles, 1):
        print(f"  {param}: tile {n}/{len(tiles)} ({lat0}-{lat1}N, {lon0}-{lon1}E)")
        for lon, lat, series in _fetch_tile(param, lat0, lat1, lon0, lon1)["points"]:
            i, j = lat_index.get(round(lat, 4)), lon_index.get(round(lon, 4))
            if i is None or j is None:
                continue
            for key, value in series.items():
                month = int(key[4:])
                if month == 13 or value == FILL:  # month 13 is POWER's annual summary
                    continue
                grid[int(key[:4]) - START_YEAR, month - 1, i, j] = value
    return grid
