"""Download South Asia subsets of NASA NEX-GDDP-CMIP6 (daily, bias-corrected, downscaled CMIP6).

Source: NASA Earth Exchange Global Daily Downscaled Projections, CMIP6 (NEX-GDDP-CMIP6).
Files are listed from the public S3 bucket (no login) and subset through NASA NCCS THREDDS NCSS,
so only the study box comes down (~0.7 MB per model-year-variable at 1 degree) instead of the
~220 MB global file.

    python cmip6_download.py            # resume-safe; skips files already on disk
    python cmip6_download.py --check    # list what is present / missing, download nothing

Output: raw/cmip6/{model}/{scenario}/{var}_{year}.nc  (gitignored)
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

BUCKET = "https://nex-gddp-cmip6.s3.us-west-2.amazonaws.com"
NCSS = "https://ds.nccs.nasa.gov/thredds/ncss/grid/AMES/NEX/GDDP-CMIP6"
UA = {"User-Agent": "earths-hidden-signals/0.1 (NASA Space Apps research pipeline)"}

# Six models with different lineages (Japan, Australia, Europe, India, Germany, Norway), so the
# ensemble spread is honest rather than six copies of one model family.
MODELS = ["MRI-ESM2-0", "ACCESS-CM2", "EC-Earth3", "IITM-ESM", "MPI-ESM1-2-HR", "NorESM2-MM"]
VARS = ["pr", "tas"]
PERIODS = {"historical": range(1995, 2015), "ssp245": range(2041, 2061), "ssp585": range(2041, 2061)}

# Study box, matching analysis/zones.json "study-area"; stride 4 on the 0.25 degree grid = 1 degree.
BOX = {"north": 38, "south": 5, "west": 60, "east": 100, "horizStride": 4}

OUT = Path(__file__).parent / "raw" / "cmip6"
VERSION_RANK = {"": 0, "_v1.1": 1, "_v2.0": 2}


def list_keys(prefix: str) -> list[str]:
    keys, token = [], None
    while True:
        params = {"list-type": "2", "prefix": prefix, "max-keys": "1000"}
        if token:
            params["continuation-token"] = token
        r = requests.get(BUCKET + "/", params=params, headers=UA, timeout=60)
        r.raise_for_status()
        keys += re.findall(r"<Key>([^<]+)</Key>", r.text)
        m = re.search(r"<NextContinuationToken>([^<]+)</NextContinuationToken>", r.text)
        if not m:
            return keys
        token = m.group(1)


def best_files(model: str, scenario: str, var: str) -> dict[int, str]:
    """year -> bucket key of the newest version of that year's file."""
    members = list_keys(f"NEX-GDDP-CMIP6/{model}/{scenario}/")
    best: dict[int, tuple[int, str]] = {}
    pat = re.compile(rf"/{var}/{var}_day_{re.escape(model)}_{scenario}_\w+?_\w+?_(\d{{4}})(_v\d\.\d)?\.nc$")
    for key in members:
        m = pat.search(key)
        if not m:
            continue
        year, version = int(m.group(1)), m.group(2) or ""
        rank = VERSION_RANK.get(version, -1)
        if year not in best or rank > best[year][0]:
            best[year] = (rank, key)
    return {y: k for y, (_, k) in best.items()}


def target(model: str, scenario: str, var: str, year: int) -> Path:
    return OUT / model / scenario / f"{var}_{year}.nc"


def valid(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 50_000 and path.read_bytes()[:4] == b"\x89HDF"


def fetch(key: str, path: Path, year: int, var: str) -> str:
    rel = key.removeprefix("NEX-GDDP-CMIP6/")
    params = dict(BOX, var=var, time_start=f"{year}-01-01T00:00:00Z", time_end=f"{year}-12-31T23:59:59Z", accept="netcdf4")
    for attempt in range(4):
        try:
            r = requests.get(f"{NCSS}/{rel}", params=params, headers=UA, timeout=300)
            if r.status_code == 200 and r.content[:4] == b"\x89HDF":
                path.parent.mkdir(parents=True, exist_ok=True)
                tmp = path.with_suffix(".part")
                tmp.write_bytes(r.content)
                tmp.replace(path)
                return "ok"
            err = f"HTTP {r.status_code}"
        except requests.RequestException as exc:
            err = type(exc).__name__
        time.sleep(5 * (attempt + 1))
    return f"failed ({err})"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--global", dest="glob", action="store_true", help="whole globe (55S-75N) at 2 degrees into raw/cmip6_global/")
    ap.add_argument("--vars", default=",".join(VARS), help="comma-separated variables, e.g. tasmax (default: pr,tas)")
    ap.add_argument("--models", default="", help="comma-separated subset of models (default: all)")
    args = ap.parse_args()
    VARS[:] = [v for v in args.vars.split(",") if v]
    if args.models:
        MODELS[:] = [m for m in MODELS if m in args.models.split(",")]
    if args.glob:
        global OUT
        OUT = Path(__file__).parent / "raw" / "cmip6_global"
        BOX.update({"north": 75, "south": -56, "west": -180, "east": 180, "horizStride": 8})

    jobs, missing_upstream = [], []
    for model in MODELS:
        for scenario, years in PERIODS.items():
            for var in VARS:
                files = best_files(model, scenario, var)
                for year in years:
                    path = target(model, scenario, var, year)
                    if valid(path):
                        continue
                    if year not in files:
                        missing_upstream.append(f"{model}/{scenario}/{var}/{year}")
                        continue
                    jobs.append((files[year], path, year, var))
    total = sum(len(y) for y in PERIODS.values()) * len(MODELS) * len(VARS)
    print(f"{total} files wanted, {len(jobs)} to download, {len(missing_upstream)} not published upstream", flush=True)
    for m in missing_upstream[:20]:
        print("  not upstream:", m)
    if args.check or not jobs:
        return 0

    done = failed = 0
    with ThreadPoolExecutor(args.workers) as pool:
        futures = {pool.submit(fetch, *job): job for job in jobs}
        for fut in as_completed(futures):
            status = fut.result()
            job = futures[fut]
            done += 1
            if status != "ok":
                failed += 1
                print(f"  {status}: {job[1].relative_to(OUT)}", flush=True)
            if done % 25 == 0 or done == len(jobs):
                print(f"{done}/{len(jobs)} done, {failed} failed", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
