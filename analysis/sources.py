"""Climate-quality NASA records used for trend analysis.

- Temperature: NASA GISTEMP v4 (GISS), monthly surface temperature anomalies on a 2 deg grid.
  It is homogenized station + ocean data built specifically for long-term trends.
- Rainfall: GPCP v2.3 monthly precipitation (NASA GSFC-led, gauge + satellite), 2.5 deg grid.
  Its inputs are inter-calibrated so the record stays consistent over time.

(NASA POWER / MERRA-2 rainfall was tried first and rejected: its South Asia series has
artificial jumps around 1997 and 2015, which also contaminate its soil moisture.)
"""

from __future__ import annotations

import gzip
import re
import shutil
import time
from pathlib import Path

import netCDF4
import numpy as np
import requests

import power

RAW = Path(__file__).parent / "raw"
GISTEMP_URL = "https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz"
GPCP_ARCHIVE = "https://www.ncei.noaa.gov/data/global-precipitation-climatology-project-gpcp-monthly/access"


def _in_box(lats: np.ndarray, lons: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    return (
        np.nonzero((lats >= power.LAT_MIN) & (lats <= power.LAT_MAX))[0],
        np.nonzero((lons >= power.LON_MIN) & (lons <= power.LON_MAX))[0],
    )


def load_gistemp(years: list[int]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns (lats, lons, anomalies[years, 12, lat, lon]) in deg C vs 1951-1980."""
    nc_path = RAW / "gistemp" / "gistemp1200.nc"
    if not nc_path.exists():
        gz = nc_path.with_suffix(".nc.gz")
        gz.parent.mkdir(parents=True, exist_ok=True)
        with requests.get(GISTEMP_URL, stream=True, timeout=600) as res:
            res.raise_for_status()
            with open(gz, "wb") as f:
                shutil.copyfileobj(res.raw, f)
        with gzip.open(gz) as src, open(nc_path, "wb") as dst:
            shutil.copyfileobj(src, dst)

    with netCDF4.Dataset(nc_path) as ds:
        lats, lons = ds["lat"][:].data, ds["lon"][:].data
        li, lj = _in_box(lats, lons)
        dates = netCDF4.num2date(ds["time"][:], ds["time"].units)
        out = np.full((len(years), 12, li.size, lj.size), np.nan)
        anomaly = ds["tempanomaly"]
        for t, d in enumerate(dates):
            if years[0] <= d.year <= years[-1]:
                block = anomaly[t, li[0] : li[-1] + 1, lj[0] : lj[-1] + 1]
                out[d.year - years[0], d.month - 1] = np.ma.filled(block.astype(float), np.nan)
    return lats[li], lons[lj], out


def _gpcp_file(year: int, month: int, listing: dict[int, list[str]]) -> Path:
    target = RAW / "gpcp" / f"{year}{month:02d}.nc"
    if target.exists():
        return target
    if year not in listing:
        html = requests.get(f"{GPCP_ARCHIVE}/{year}/", timeout=120).text
        listing[year] = sorted(set(re.findall(rf"gpcp_v02r03_monthly_d{year}\d\d_c\d+\.nc", html)))
    name = next((n for n in listing[year] if f"_d{year}{month:02d}_" in n), None)
    if name is None:
        raise FileNotFoundError(f"GPCP {year}-{month:02d} not in archive")
    for attempt in range(5):
        try:
            res = requests.get(f"{GPCP_ARCHIVE}/{year}/{name}", timeout=120)
            res.raise_for_status()
            target.parent.mkdir(parents=True, exist_ok=True)
            # Write then rename, so an interrupted download never leaves a half file in the cache.
            tmp = target.with_suffix(".part")
            tmp.write_bytes(res.content)
            tmp.replace(target)
            time.sleep(0.2)  # be polite to the public archive
            return target
        except requests.RequestException as exc:
            print(f"  GPCP {year}-{month:02d}: {exc}, retrying")
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"GPCP download failed for {year}-{month:02d}")


def prefetch_gpcp(years: list[int], workers: int = 6) -> None:
    """Downloads missing monthly files a few at a time (the archive serves one file per month)."""
    from concurrent.futures import ThreadPoolExecutor

    listing: dict[int, list[str]] = {}
    for y in years:  # fill directory listings first, sequentially
        if not all((RAW / "gpcp" / f"{y}{m:02d}.nc").exists() for m in range(1, 13)):
            _gpcp_file(y, 1, listing)
    jobs = [(y, m) for y in years for m in range(1, 13)]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(lambda ym: _gpcp_file(ym[0], ym[1], listing), jobs))


def load_gpcp(years: list[int]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns (lats, lons, precip[years, 12, lat, lon]) in mm/day (monthly mean rate)."""
    prefetch_gpcp(years)
    listing: dict[int, list[str]] = {}
    out = lats_box = lons_box = None
    for y in years:
        print(f"  GPCP {y}")
        for m in range(1, 13):
            with netCDF4.Dataset(_gpcp_file(y, m, listing)) as ds:
                if out is None:
                    lats, lons = ds["latitude"][:].data, ds["longitude"][:].data
                    li, lj = _in_box(lats, lons)
                    lats_box, lons_box = lats[li], lons[lj]
                    out = np.full((len(years), 12, li.size, lj.size), np.nan)
                field = np.ma.filled(ds["precip"][0].astype(float), np.nan)
                out[y - years[0], m - 1] = field[np.ix_(li, lj)]
    return lats_box, lons_box, out


def land_fraction(lats: np.ndarray, lons: np.ndarray, d_lat: float, d_lon: float) -> np.ndarray:
    """Share of each coarse cell covered by land, from the fine MERRA-2 land mask (soil wetness exists only on land)."""
    soil = power.load_monthly_grid("GWETROOT")
    fine_land = np.isfinite(soil).all(axis=(0, 1))
    flats, flons = power.grid_axes()
    frac = np.zeros((lats.size, lons.size))
    for i, la in enumerate(lats):
        rows = np.abs(flats - la) <= d_lat / 2
        for j, lo in enumerate(lons):
            cols = np.abs(flons - lo) <= d_lon / 2
            block = fine_land[np.ix_(rows, cols)]
            frac[i, j] = block.mean() if block.size else 0.0
    return frac
