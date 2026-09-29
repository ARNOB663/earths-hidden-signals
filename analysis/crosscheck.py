"""Cross-check our trends with an independent record: CRU TS 4.10 (University of East Anglia).

CRU TS is built from station data with its own methods (0.5 deg, land only), so if it gives
the same trends as GISTEMP (temperature) and GPCP (rainfall), those trends are unlikely to be
an artefact of one dataset.

Run after build.py:  python crosscheck.py
Writes ../web/public/data/trends/crosscheck.json
"""

from __future__ import annotations

import gzip
import json
import re
import shutil
from pathlib import Path

import netCDF4
import numpy as np
import requests

import power
from build import OUT_DIR, SEASONS, YEARS, seasonal, trend_summary, zone_weights
from stats import trend

RAW = Path(__file__).parent / "raw" / "cru"
BASE = "https://crudata.uea.ac.uk/cru/data/hrg/cru_ts_4.10/"
DECADES = [(1981, 1990), (1991, 2000), (2001, 2010), (2011, 2020), (2021, 2025)]


def _release_dir() -> str:
    html = requests.get(BASE, timeout=120).text
    return re.search(r"cruts\.\d+\.v4\.10", html).group(0)


def _file(var: str, a: int, b: int, release: str) -> Path:
    nc = RAW / f"cru_ts4.10.{a}.{b}.{var}.dat.nc"
    if nc.exists():
        return nc
    RAW.mkdir(parents=True, exist_ok=True)
    gz = nc.with_suffix(".nc.gz")
    with requests.get(f"{BASE}{release}/{var}/{gz.name}", stream=True, timeout=600) as res:
        res.raise_for_status()
        with open(gz, "wb") as f:
            shutil.copyfileobj(res.raw, f)
    with gzip.open(gz) as src, open(nc, "wb") as dst:
        shutil.copyfileobj(src, dst)
    gz.unlink()
    return nc


def load(var: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Monthly CRU field for the study box: (lats, lons, values[years, 12, lat, lon]).

    The global files are large (~0.5 GB each), so after the first run only the study box is kept.
    """
    cache = RAW / f"{var}_box.npz"
    if cache.exists():
        with np.load(cache) as d:
            return d["lats"], d["lons"], d["values"]
    release = _release_dir()
    out = None
    for a, b in DECADES:
        with netCDF4.Dataset(_file(var, a, b, release)) as ds:
            lats, lons = ds["lat"][:].data, ds["lon"][:].data
            li = np.nonzero((lats >= power.LAT_MIN) & (lats <= power.LAT_MAX))[0]
            lj = np.nonzero((lons >= power.LON_MIN) & (lons <= power.LON_MAX))[0]
            if out is None:
                out = np.full((len(YEARS), 12, li.size, lj.size), np.nan)
                box_lats, box_lons = lats[li], lons[lj]
            dates = netCDF4.num2date(ds["time"][:], ds["time"].units)
            field = ds[var]
            for t, d in enumerate(dates):
                if YEARS[0] <= d.year <= YEARS[-1]:
                    block = field[t, li[0] : li[-1] + 1, lj[0] : lj[-1] + 1]
                    out[d.year - YEARS[0], d.month - 1] = np.ma.filled(block.astype(float), np.nan)
    np.savez_compressed(cache, lats=box_lats, lons=box_lons, values=out)
    for a, b in DECADES:
        (RAW / f"cru_ts4.10.{a}.{b}.{var}.dat.nc").unlink(missing_ok=True)
    return box_lats, box_lons, out


def main() -> None:
    zones = json.loads((OUT_DIR / "zones.json").read_text(encoding="utf-8"))["zones"]
    ours = {z["id"]: z["results"] for z in zones}
    result: dict = {"dataset": "CRU TS 4.10 (University of East Anglia), 0.5° land", "zones": {}}

    # CRU "pre" is a monthly total (mm) and "tmp" a monthly mean (deg C); CRU temperature is an absolute
    # value, so it is compared through its trend, which does not depend on the baseline.
    for var, cru_var, dec in (("temperature", "tmp", 2), ("rainfall", "pre", 0)):
        print(f"CRU {cru_var}")
        lats, lons, monthly = load(cru_var)
        land = np.isfinite(monthly).all(axis=(0, 1)).astype(float)
        for season, smeta in SEASONS.items():
            key = f"{var}_{season}"
            if var == "rainfall":
                values = monthly[:, [m - 1 for m in smeta["months"]]].sum(axis=1)
            else:
                values = seasonal(monthly, smeta["months"], "mean")
            for z in zones:
                w = zone_weights(z["bbox"], lats, lons, (0.5, 0.5), land)
                series = (np.nan_to_num(values) * w).sum(axis=(1, 2)) / w.sum()
                entry = result["zones"].setdefault(z["id"], {})
                entry[key] = {"ours": ours[z["id"]][key]["trend"], "cru": trend_summary(trend(series), dec)}

    (OUT_DIR / "crosscheck.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT_DIR / 'crosscheck.json'}")


if __name__ == "__main__":
    main()
