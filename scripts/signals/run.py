#!/usr/bin/env python3
"""Signals pipeline entry point (plan rev. 7b).

Step 2 commands:

    python3 scripts/signals/run.py --check-auth          # OK / rejected / expired only
    python3 scripts/signals/run.py --check-readme        # fetch README.GIS and assert the encoding
    python3 scripts/signals/run.py --check-outlook       # Open-Meteo 7-day outlook probe
    python3 scripts/signals/run.py --time-one-day TILE   # ONE day, ONE tile: cost before any bulk run

Nothing here writes outside scripts/signals/ or web/public/data/signals/.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import auth  # noqa: E402
import imerg  # noqa: E402
import outlook as outlook_mod  # noqa: E402
import tiles as tiles_mod  # noqa: E402

RAW = HERE / "raw"
PROJECTED_LIMIT_MIN = 30.0


def _config() -> dict:
    return tiles_mod.load_config()


def cmd_check_auth(_: argparse.Namespace) -> int:
    results = auth.check_all()
    width = max(len(name) for name in results)
    for name, status in results.items():
        print(f"{name.ljust(width)}  {status}")
    bad = {k: v for k, v in results.items() if v not in ("OK",)}
    if bad:
        print("\nNot usable right now: " + ", ".join(f"{k} ({v})" for k, v in bad.items()))
        return 1
    return 0


def cmd_check_readme(_: argparse.Namespace) -> int:
    creds = auth.Credentials.from_env()
    RAW.mkdir(parents=True, exist_ok=True)
    target = RAW / "README.GIS"
    result = auth.download(auth.PPS_DIR + "README.GIS", target, creds)
    if not result["ok"]:
        print(f"README.GIS unavailable (status {result['status']}); encoding assertions cannot be re-checked now.")
        return 1
    text = target.read_text(errors="replace")
    facts = imerg.parse_readme_gis(text)
    for key, value in facts.items():
        print(f"{key}: {value}")
    imerg.assert_readme_matches(text)
    print("README.GIS matches the asserted encoding (mm x 10, missing 29999, 0.1 deg grid).")
    return 0


def cmd_check_outlook(_: argparse.Namespace) -> int:
    config = _config()
    spec = config["outlook"]
    tile = tiles_mod.tiles(config)[0]
    lat, lon = tile.south + 2.5, tile.west + 2.5
    result = outlook_mod.fetch(lat, lon, spec["url"], spec["days"])
    if result is None:
        print("Open-Meteo outlook unavailable; the pages must omit it and say so.")
        return 1
    print(json.dumps(result.as_dict(), indent=1))
    print(f"\nLabel on every page: {result.label}")
    return 0


def cmd_time_one_day(args: argparse.Namespace) -> int:
    """Time exactly one day and one tile, then project the full baseline before any bulk run."""
    config = _config()
    registry = {tile.id: tile for tile in tiles_mod.tiles(config)}
    if args.tile not in registry:
        print(f"unknown tile {args.tile!r}; choose from {', '.join(registry)}")
        return 2
    tile = registry[args.tile]
    day = args.day or (dt.date.today() - dt.timedelta(days=args.lag_days))
    creds = auth.Credentials.from_env()
    spec = config["imerg"]
    url = imerg.granule_url(spec["ppsBase"], "late", day, 1)
    target = RAW / "timing" / f"late-{tile.id}-{day.isoformat()}.tif"
    print(f"One day, one tile ({tile.id}, {tile.north}-{tile.south}N {tile.west}-{tile.east}E)")
    print(f"URL: {url}")
    result = auth.download(url, target, creds)
    if not result["ok"]:
        print(f"download failed: status {result['status']}. Try --lag-days 3 (Late is ~14 h behind).")
        return 1
    raster = imerg.read_geotiff(target)
    subset = raster.subset(tile)
    valid = float(1 - (subset.size and (subset != subset).sum() / subset.size))
    seconds = result["seconds"]
    megabytes = result["bytes"] / 1e6

    spec_baseline = config["baseline"]
    years = dt.date(2025, 9, 30).year - spec_baseline["startYear"] + 1
    days_total = years * 366
    download_hours = seconds * days_total / 3600
    print(f"bytes: {result['bytes']} ({megabytes:.1f} MB)   seconds: {seconds:.1f}")
    print(f"valid cells in tile: {valid:.0%}   grid: {subset.shape[0]}x{subset.shape[1]} at {raster.pixels_per_deg:g}/deg")
    print(f"projected for {days_total} days ({spec_baseline['startYear']}→2025-09-30): {download_hours:.1f} h download at 1 worker")
    for workers in (4, 8):
        print(f"  at {workers} workers: {download_hours / workers:.1f} h")
    if download_hours / 4 > PROJECTED_LIMIT_MIN / 60:
        print(f"\nGATE: projected total exceeds {PROJECTED_LIMIT_MIN:g} min per tile. STOPPING before any bulk run.")
        print("Options: (1) more workers, (2) shorter record, (3) weekly accumulation files, (4) fewer tiles, (5) Actions runners.")
        return 3
    print("\nGATE: within budget. The full run still needs your go-ahead.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Signals pipeline (step 2).")
    parser.add_argument("--check-auth", action="store_true", help="probe PPS and Earthdata credentials; prints statuses only")
    parser.add_argument("--check-readme", action="store_true", help="fetch README.GIS and assert the GeoTIFF encoding")
    parser.add_argument("--check-outlook", action="store_true", help="probe the Open-Meteo 7-day outlook")
    parser.add_argument("--time-one-day", metavar="TILE", dest="tile", help="time one day of one tile and project the baseline")
    parser.add_argument("--day", type=dt.date.fromisoformat, help="day to time (default: today - lag)")
    parser.add_argument("--lag-days", type=int, default=3, help="how many days behind today to ask for (default 3)")
    args = parser.parse_args(argv)

    if args.check_auth:
        return cmd_check_auth(args)
    if args.check_readme:
        return cmd_check_readme(args)
    if args.check_outlook:
        return cmd_check_outlook(args)
    if args.tile:
        return cmd_time_one_day(args)
    parser.print_help()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(2)
