"""Daily rainfall for extreme-rain indicators: GPCP 1DD v1.3 (NASA GSFC-led), 1 deg, since Oct 1996.

NCEI serves one global file per day. We read each file in memory, keep only the South Asia
box, and store one small .npz per year under raw/gpcp_daily/, so the global files never pile up.
"""

from __future__ import annotations

import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import netCDF4
import numpy as np
import requests

import power

ARCHIVE = "https://www.ncei.noaa.gov/data/global-precipitation-climatology-project-gpcp-daily/access"
OUT = Path(__file__).parent / "raw" / "gpcp_daily"
YEARS = list(range(1997, power.END_YEAR + 1))

session = requests.Session()


def _get(url: str) -> bytes:
    for attempt in range(6):
        try:
            res = session.get(url, timeout=120)
            res.raise_for_status()
            return res.content
        except requests.RequestException as exc:
            print(f"  {url.rsplit('/', 1)[-1]}: {exc}, retrying")
            time.sleep(4 * (attempt + 1))
    raise RuntimeError(f"download failed: {url}")


def _box(lats: np.ndarray, lons: np.ndarray):
    li = np.nonzero((lats >= power.LAT_MIN) & (lats <= power.LAT_MAX))[0]
    lj = np.nonzero((lons >= power.LON_MIN) & (lons <= power.LON_MAX))[0]
    return li, lj


def fetch_year(year: int, workers: int = 8) -> Path:
    target = OUT / f"{year}.npz"
    if target.exists():
        return target
    html = _get(f"{ARCHIVE}/{year}/").decode()
    names = sorted(set(re.findall(rf"gpcp_v01r03_daily_d{year}\d{{4}}_c\d+\.nc", html)))
    if not names:
        raise FileNotFoundError(f"no GPCP daily files for {year}")

    # Download in parallel, but read one at a time: the netCDF library is not thread-safe.
    with ThreadPoolExecutor(max_workers=workers) as pool:
        blobs = list(pool.map(lambda n: _get(f"{ARCHIVE}/{year}/{n}"), names))

    results = []
    for name, blob in zip(names, blobs):
        with netCDF4.Dataset("in-memory.nc", memory=blob) as ds:
            lats, lons = ds["latitude"][:].data, ds["longitude"][:].data
            li, lj = _box(lats, lons)
            field = np.ma.filled(ds["precip"][0].astype("float32"), np.nan)[np.ix_(li, lj)]
        ymd = re.search(r"_d(\d{4})(\d{2})(\d{2})_", name).groups()
        results.append((date(*map(int, ymd)).toordinal(), field, lats[li], lons[lj]))
    results.sort(key=lambda r: r[0])
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".part.npz")
    np.savez_compressed(
        tmp,
        days=np.array([r[0] for r in results]),
        precip=np.stack([r[1] for r in results]),
        lats=results[0][2],
        lons=results[0][3],
    )
    tmp.replace(target)
    print(f"  GPCP daily {year}: {len(results)} days")
    return target


def load() -> tuple[np.ndarray, np.ndarray, list[int], list[np.ndarray], list[np.ndarray]]:
    """Returns (lats, lons, years, per-year rain arrays (days, lat, lon) in mm/day, per-year month of each day)."""
    per_year, months = [], []
    for y in YEARS:
        with np.load(fetch_year(y)) as d:
            per_year.append(d["precip"])
            months.append(np.array([date.fromordinal(int(o)).month for o in d["days"]]))
            lats, lons = d["lats"], d["lons"]
    return lats, lons, YEARS, per_year, months


if __name__ == "__main__":
    for y in YEARS:
        fetch_year(y)
