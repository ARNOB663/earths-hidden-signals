#!/usr/bin/env python3
"""Spike: IMERG subsetting cost, Late history depth, bias, sample size, station check.

Plan rev. 7, step 0. Needs `requests` (and tifffile for GeoTIFF timings). Everything is
written under scripts/signals/raw/ and appended to scripts/signals/spike_report.md.

    python3 scripts/signals/spike_imerg_probe.py --point 23.81,90.41 --window 2024-07-01/2024-07-31
    python3 scripts/signals/spike_imerg_probe.py --point 23.81,90.41 --window 2024-07-01/2024-07-31 --full

Parts:
  geotiff   time one IMERG Late 1-day GeoTIFF download (current product, live side)
  final     time one month of IMERG Final on one 10x10 deg tile, spatially subset (0a/0b)
  late-hist IMERG Late daily archive depth + bias vs Final on the probe window (0c)
  sizes     projected committed-baseline size for the chosen window (0k)
  station   NASA POWER + GHCN-Daily check at the probe points (used again in step 3b)

Secrets come from PPS_USERNAME / PPS_PASSWORD / EARTHDATA_TOKEN and are never printed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import sys
import time
import urllib.parse
from dataclasses import dataclass, field

try:
    import requests
except ImportError:  # pragma: no cover - guidance only
    sys.exit("spike_imerg_probe.py needs requests: pip install requests tifffile")

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
REPORT = os.path.join(HERE, "spike_report.md")
UA = {"User-Agent": "earth-hidden-signals-spike/0.1"}

PPS_GIS = "https://jsimpsonhttps.pps.eosdis.nasa.gov/imerg/gis"
PPS_README = f"{PPS_GIS}/README.GIS"
GES_OPENDAP = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07"
GES_HTTPS = "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGDF.07"
GES_SUBSET = ("{base}/{year}/{month:02d}/{stem}.nc4.dap.nc4"
              "?dap4.ce=/precipitationCal[0:1:0][{r0}:1:{r1}][{c0}:1:{c1}]")
GIBS_RATE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png"
POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
GHCN_BY_STATION = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/{station}.csv.gz"
GHCN_STATIONS = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt"
CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules.json"

TILE_DEG = 10.0
RECORD_START = dt.date(2010, 1, 1)  # gate 0b reference start
PRODUCT_START = dt.date(1998, 1, 1)  # IMERG V07 daily coverage starts here [V via CMR 2026-11-03]
FINAL_END = dt.date(2025, 9, 30)  # last Final granule [V via CMR 2026-11-03]
PIXEL_DEG = 0.1


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
def creds() -> tuple[dict[str, str], dict[str, str]]:
    pps = {}
    if os.environ.get("PPS_USERNAME") and os.environ.get("PPS_PASSWORD"):
        pps = {"auth": (os.environ["PPS_USERNAME"], os.environ["PPS_PASSWORD"])}
    ed = {}
    if os.environ.get("EARTHDATA_TOKEN"):
        ed = {"headers": {"Authorization": f"Bearer {os.environ['EARTHDATA_TOKEN']}", **UA}}
    return pps, ed


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update(UA)
    return s


def get(url: str, *, session_: requests.Session, timeout: int = 60, stream: bool = False, **kwargs):
    return session_.get(url, timeout=timeout, stream=stream, allow_redirects=True, **kwargs)


def bytes_to_disk(response, path: str, cap: int | None = None) -> tuple[int, float]:
    """Stream a response to disk; return (bytes written, seconds)."""
    started = time.monotonic()
    written = 0
    with open(path, "wb") as handle:
        for chunk in response.iter_content(1 << 16):
            if not chunk:
                continue
            handle.write(chunk)
            written += len(chunk)
            if cap and written >= cap:
                break
    return written, time.monotonic() - started


def human(size: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def tile_of(lat: float, lon: float) -> tuple[float, float]:
    """South-west corner of the 10x10 deg tile holding the point."""
    return math.floor(lat / TILE_DEG) * TILE_DEG, math.floor(lon / TILE_DEG) * TILE_DEG


def parse_point(text: str) -> tuple[float, float]:
    lat, lon = (float(part) for part in text.split(","))
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise argparse.ArgumentTypeError("point must be lat,lon within valid ranges")
    return lat, lon


def parse_window(text: str) -> tuple[dt.date, dt.date]:
    start, end = (dt.date.fromisoformat(part) for part in text.split("/"))
    if start > end:
        raise argparse.ArgumentTypeError("window start must be before end")
    return start, end


def days(start: dt.date, end: dt.date) -> list[dt.date]:
    out, day = [], start
    while day <= end:
        out.append(day)
        day += dt.timedelta(days=1)
    return out


def append_report(title: str, body: str) -> None:
    header = f"## {title}\n\n"
    existing = ""
    if os.path.exists(REPORT):
        with open(REPORT, encoding="utf-8") as handle:
            existing = handle.read()
    if header in existing:
        start = existing.index(header)
        rest = existing[start + len(header):]
        end = re.search(r"\n## ", rest)
        existing = existing[:start] + (header + body + "\n\n" + rest[end.start() + 1:] if end else header + body + "\n\n")
    else:
        existing = (existing.rstrip() + "\n\n" if existing else "") + header + body + "\n\n"
    with open(REPORT, "w", encoding="utf-8") as handle:
        handle.write(existing)


def table(rows: list[list[str]], head: list[str]) -> str:
    out = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    out += ["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows]
    return "\n".join(out)


# --------------------------------------------------------------------------------------
# 0a/0b: Final one-month, one-tile subset timing
# --------------------------------------------------------------------------------------
@dataclass
class Timing:
    route: str
    ok: bool
    seconds: float = 0.0
    byte_count: int = 0
    note: str = ""
    files: list[str] = field(default_factory=list)


def latest_granule(session_: requests.Session, short_name: str, version: str = "07", newest: bool = True) -> dict:
    """CMR is the keyless source of truth for granule names, dates and the collection depth."""
    params = {"short_name": short_name, "version": version, "page_size": 1, "sort_key": "-start_date" if newest else "start_date"}
    try:
        response = get(CMR_GRANULES, session_=session_, params=params, timeout=40)
        entry = response.json().get("feed", {}).get("entry", [])[0]
    except (requests.RequestException, ValueError, IndexError) as error:
        return {"error": str(error)}
    data_links = [link.get("href", "") for link in entry.get("links", []) if link.get("rel", "").endswith("data#")]
    return {
        "title": entry.get("title", ""),
        "start": entry.get("time_start", "")[:10],
        "data_url": data_links[0] if data_links else "",
    }


def catalogue_depth(session_: requests.Session) -> str:
    rows = []
    for label, short_name in (("Final daily", "GPM_3IMERGDF"), ("Late daily", "GPM_3IMERGDL"), ("Early daily", "GPM_3IMERGDE")):
        first = latest_granule(session_, short_name, newest=False)
        last = latest_granule(session_, short_name, newest=True)
        rows.append([
            label,
            first.get("title", first.get("error", "?")).split(":")[-1],
            last.get("title", last.get("error", "?")).split(":")[-1],
            (first.get("start", "?") + " → " + last.get("start", "?")),
        ])
    return table(rows, ["collection", "first granule name", "latest granule name", "coverage (start → end)"]) + f"\n\nProduct start {PRODUCT_START} · Final end {FINAL_END} [V via CMR 2026-11-03].\n"


def probe_final(session_: requests.Session, start: dt.date, end: dt.date, tile_lat: float, tile_lon: float) -> list[Timing]:
    """Final subset routes in cost order: GES DISC subset (dap.nc4) then Harmony."""
    timings: list[Timing] = []
    day_list = days(start, end)
    newest = latest_granule(session_, "GPM_3IMERGDF", newest=True)
    append_report("IMERG Final catalogue (CMR)", table(
        [[newest.get("title", "?"), newest.get("start", "?"), newest.get("error", "") or newest.get("data_url", "")]],
        ["latest title", "start", "data link"],
    ))

    north, south = tile_lat + TILE_DEG, tile_lat
    west, east = tile_lon, tile_lon + TILE_DEG
    r0, r1 = int(round((90 - north) / PIXEL_DEG)), int(round((90 - south) / PIXEL_DEG))
    c0, c1 = int(round((west + 180) / PIXEL_DEG)), int(round((east + 180) / PIXEL_DEG))
    _, ed = creds()
    sample_day = day_list[len(day_list) // 2]
    stem = f"3B-DAY.MS.MRG.3IMERG.{sample_day:%Y%m%d}-S000000-E235959.V07B.nc4"

    # 1. GES DISC subsetter (OPeNDAP DAP4 constraint, NetCDF out). Redirects to Earthdata login
    #    when the token is missing or invalid, so 302 counts as "needs auth", never as success.
    subset_url = GES_SUBSET.format(base=GES_OPENDAP, year=sample_day.year, month=sample_day.month, stem=stem, r0=r0, r1=r1, c0=c0, c1=c1)
    started = time.monotonic()
    try:
        with session_.get(subset_url, timeout=300, stream=True, allow_redirects=False, headers={"Accept": "application/netcdf", **ed.get("headers", {})}) as response:
            status = response.status_code
            note = f"HTTP {status}"
            if status in (302, 303):
                note += " (login redirect: token missing/rejected)"
                ok = False
                written = 0
            else:
                ok = status == 200 and len(response.content) > 1000
                os.makedirs(RAW, exist_ok=True)
                path = os.path.join(RAW, f"final_subset_{sample_day}.nc4")
                written, stream_seconds = bytes_to_disk(response, path)
                note += f"; {written} bytes; {response.headers.get('Content-Type', '?')}"
                if ok and written > 0:
                    try:
                        import xarray  # optional: only to confirm shape and scale

                        with xarray.open_dataset(path) as ds:
                            variable = ds["precipitationCal"]
                            note += f"; shape {tuple(variable.shape)}; units {variable.attrs.get('units', '?')}"
                    except Exception:  # noqa: BLE001 - optional refinement only
                        pass
            seconds = time.monotonic() - started
            timings.append(Timing(route="GES subset (one day)", ok=ok, seconds=seconds, byte_count=written if ok else 0, note=note))
            if ok:
                per_day = seconds
                month_seconds = per_day * len(day_list)
                timings.append(Timing(
                    route="GES subset (month extrapolated)",
                    ok=True,
                    seconds=month_seconds,
                    byte_count=written * len(day_list),
                    note=f"{per_day:.1f} s/day x {len(day_list)} days; {TILE_DEG:.0f} x {TILE_DEG:.0f} deg tile, {(r1 - r0 + 1)} x {(c1 - c0 + 1)} pixels",
                ))
                return timings
    except requests.RequestException as error:
        timings.append(Timing(route="GES subset (one day)", ok=False, note=f"network error: {error}"))

    # 2. Harmony subsetter needs an Earthdata token; only meaningful after --check-auth is OK.
    timings.append(Timing(route="Harmony subsetter", ok=False, note="not attempted: needs an Earthdata token and collection id; rerun with --check-auth OK"))
    return timings


def project_baseline(minutes_per_month: float | None, months: int, workers: int) -> str:
    if minutes_per_month is None:
        return "not measured"
    total_minutes = minutes_per_month * months / workers
    return f"{total_minutes / 60:.1f} h at {workers} parallel workers ({minutes_per_month:.1f} min of requests/month) for {months} months"


def parallel_workers() -> int:
    """GES DISC tolerates a handful of concurrent subsets; 4 is the conservative default."""
    try:
        return max(1, int(os.environ.get("SIGNALS_WORKERS", "4")))
    except ValueError:
        return 4


# --------------------------------------------------------------------------------------
# Live product: one IMERG Late/Early daily GeoTIFF (30 s ladder check)
# --------------------------------------------------------------------------------------
def probe_geotiff(session_: requests.Session, day: dt.date | None = None) -> Timing:
    pps, _ = creds()
    day = day or (dt.date.today() - dt.timedelta(days=2))
    if not pps:
        return Timing(route="PPS GeoTIFF 1-day", ok=False, note="no PPS_USERNAME / PPS_PASSWORD in this environment")
    candidates = [
        f"{PPS_GIS}/{day:%Y}/{day:%m}/3B-DAY-L.GIS.IMERG.{day:%Y%m%d}.V07B.tif",
        f"{PPS_GIS}/early/{day:%Y}/{day:%m}/3B-DAY-E.GIS.IMERG.{day:%Y%m%d}.V07B.tif",
    ]
    started = time.monotonic()
    for url in candidates:
        try:
            with get(url, session_=session_, timeout=120, stream=True, **pps) as response:
                if response.status_code != 200:
                    continue
                os.makedirs(RAW, exist_ok=True)
                path = os.path.join(RAW, os.path.basename(url))
                written, _ = bytes_to_disk(response, path)
                seconds = time.monotonic() - started
                note = f"HTTP 200, saved {os.path.relpath(path)}"
                try:
                    import tifffile

                    with tifffile.TiffFile(path) as tif:
                        page = tif.pages[0]
                        note += f"; shape {page.shape}, dtype {page.dtype}"
                except Exception as error:  # noqa: BLE001 - probe only
                    note += f"; tifffile read failed ({type(error).__name__})"
                return Timing(route="PPS GeoTIFF 1-day", ok=True, seconds=seconds, byte_count=written, note=note)
        except requests.RequestException as error:
            continue
    return Timing(route="PPS GeoTIFF 1-day", ok=False, note=f"no file for {day}; check product path in README.GIS")


# --------------------------------------------------------------------------------------
# 0c: Late daily archive depth, and Late vs Final bias
# --------------------------------------------------------------------------------------
def probe_late_history(session_: requests.Session) -> list[Timing]:
    timings: list[Timing] = []
    pps, _ = creds()
    listing = get(f"{PPS_GIS}/", session_=session_, timeout=60, **pps)
    years = sorted(set(re.findall(r">(\d{4})/", listing.text))) if listing.ok else []
    note = f"HTTP {listing.status_code}; years on server: {', '.join(years) if years else 'none parsed'}"
    if listing.status_code == 401:
        note += " (401: credentials missing here; the run below needs PPS_USERNAME/PPS_PASSWORD, and README.GIS states earliest year)"
    timings.append(Timing(route="PPS /imerg/gis/ year listing", ok=listing.ok, seconds=listing.elapsed.total_seconds(), byte_count=len(listing.content), note=note))

    readme = get(PPS_README, session_=session_, timeout=60, **pps)
    earliest = re.search(rb"(?:first|earliest|available from|start(?:s)?(?: on| date|ing)?)\D{0,20}(\d{4})", readme.content, re.IGNORECASE) if readme.ok else None
    timings.append(Timing(
        route="PPS README.GIS (product start + scale/fill assertions)",
        ok=readme.ok,
        seconds=readme.elapsed.total_seconds(),
        byte_count=len(readme.content),
        note=f"HTTP {readme.status_code}" + (f"; earliest year mentioned: {earliest.group(1).decode()}" if earliest else ""),
    ))
    if readme.ok:
        os.makedirs(RAW, exist_ok=True)
        with open(os.path.join(RAW, "README.GIS"), "wb") as handle:
            handle.write(readme.content)
    for year in [years[0], years[-1]] if years else []:
        child = get(f"{PPS_GIS}/{year}/", session_=session_, timeout=60, **pps)
        months = sorted(set(re.findall(r">(\d{2})/", child.text))) if child.ok else []
        timings.append(Timing(route=f"PPS /imerg/gis/{year}/", ok=child.ok, seconds=child.elapsed.total_seconds(), byte_count=len(child.content), note=f"months: {', '.join(months) if months else 'none parsed'}"))
    return timings


def bias_check(session_: requests.Session, start: dt.date, end: dt.date, lat: float, lon: float) -> str:
    """Final baseline value vs Late value for the same days at the probe point (0c)."""
    rows = []
    _, ed = creds()
    sample = [d for d in days(start, end)][:: max(1, len(days(start, end)) // 5)]
    for day in sample:
        final_value = None
        try:
            stem = f"3B-DAY.MS.MRG.3IMERG.{day:%Y%m%d}-S000000-E235959.V07B.nc4"
            ascii_url = (
                f"{GES_OPENDAP}/{day:%Y}/{day:%m}/{stem}.ascii?precipitationCal"
                f"[0:1:0][{int(round((90 - lat) / 0.1))}][{int(round((lon + 180) / 0.1))}]"
            )
            response = get(ascii_url, session_=session_, timeout=90, **ed)
            if response.ok:
                numbers = re.findall(rb"[-+]?\d+\.?\d*(?:[eE][-+]?\d+)?", response.content)
                final_value = float(numbers[-1]) if numbers else None
        except (requests.RequestException, ValueError):
            final_value = None
        rows.append({"date": day.isoformat(), "final_mm": final_value})
    body = table(
        [[row["date"], "n/a" if row["final_mm"] is None else f"{row['final_mm']:.2f}"] for row in rows],
        ["date", "Final precipitationCal (mm/day at point)"],
    )
    return body + """

Live values for the same dates need the PPS GeoTIFF at the point; run the `geotiff` part and
read the same pixel, then add the ratio here. A material gap (|ratio-1| > 0.10 of the
wet-day median, or > 3 percentile points) switches the baseline to IMERG Late (gate c).
"""


# --------------------------------------------------------------------------------------
# 0k: projected committed baseline size
# --------------------------------------------------------------------------------------
def projected_sizes(session_: requests.Session, lat: float, lon: float, cell_deg: float, tiles: int) -> str:
    rows = []
    horizons = [(2010, FINAL_END), (PRODUCT_START, FINAL_END), (2015, FINAL_END)]
    for product, (start_date, end_date) in ((p, h) for p in ("Late", "Final") for h in horizons):
        start_year = start_date.year
        years = end_date.year - start_year + 1
        day_count = years * 366
        for resolution in (0.1, 0.5):
            cells = int(round(TILE_DEG / resolution)) ** 2
            # uint16 mm with a saturating cap (655 mm/day is far above any real daily value).
            raw_per_cell = day_count * 2
            compressed = int(raw_per_cell * 0.45)  # zlib on sparse rain series, measured to be close
            total = compressed * cells * tiles
            rows.append([product, start_year, resolution, cells, f"{human(compressed * cells)}", human(total)])
    return (
        table(rows, ["baseline product", "start year", "grid deg", "cells/tile", "bytes/tile", "total (all enabled tiles)"])
        + f"\n\nBudget (rev. 7 §5d): 25 MB total, 8 MB per tile. Cell size assumption: 2-byte uint16 mm/day,"
        f" zlib ratio 0.45. If a row exceeds the budget, store weekly sums or 0.5 deg cells.\n"
    )


# --------------------------------------------------------------------------------------
# Station / POWER sanity check (POWER = scale only; GHCN = independent)
# --------------------------------------------------------------------------------------
def power_point(session_: requests.Session, lat: float, lon: float, start: dt.date, end: dt.date) -> dict[str, float | None]:
    params = {
        "parameters": "PRECTOTCORR",
        "community": "RE",
        "longitude": round(lon % 360 - 360, 3) if lon > 180 else lon,
        "latitude": round(lat, 3),
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
    }
    try:
        response = get(POWER, session_=session_, params=params, timeout=90)
        payload = response.json()
        series = payload.get("properties", {}).get("parameter", {}).get("PRECTOTCORR", {})
        return {day: value for day, value in series.items() if isinstance(value, (int, float))}
    except (requests.RequestException, ValueError):
        return {}


def nearest_ghcn(session_: requests.Session, lat: float, lon: float) -> dict | None:
    """Pick the nearest station from the NCEI station list; return its metadata."""
    url = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt"
    try:
        text = get(url, session_=session_, timeout=90).text
    except requests.RequestException:
        return None
    best, best_distance = None, 1e9
    for line in text.splitlines():
        match = re.match(r"(\S{11})\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+", line)
        if not match:
            continue
        station, slat, slon = match.group(1), float(match.group(2)), float(match.group(3))
        distance = math.hypot((slat - lat) * 111.0, (slon - lon) * 111.0 * math.cos(math.radians(lat)))
        if distance < best_distance:
            best, best_distance = {"station": station, "lat": slat, "lon": slon, "distance_km": round(distance, 1), "name": line[38:68].strip()}, distance
    return best


def ghcn_daily(session_: requests.Session, station: str, start: dt.date, end: dt.date) -> dict[str, float]:
    """PRCP in the by_station CSV is tenths of mm; -9999 is missing."""
    try:
        response = get(GHCN_BY_STATION.format(station=station), session_=session_, timeout=120)
        import gzip

        text = gzip.decompress(response.content).decode("utf-8", "replace")
    except (requests.RequestException, OSError):
        return {}
    out: dict[str, float] = {}
    lo, hi = start.strftime("%Y%m%d"), end.strftime("%Y%m%d")
    for line in text.splitlines():
        parts = line.split(",")
        if len(parts) < 4 or parts[2] != "PRCP" or not (lo <= parts[1] <= hi):
            continue
        try:
            value = int(parts[3])
        except ValueError:
            continue
        if value != -9999:
            out[parts[1]] = value / 10.0
    return out


def point_mm_series(session_: requests.Session, lat: float, lon: float, start: dt.date, end: dt.date) -> dict[str, float]:
    """IMERG Final precipitationCal for one pixel, one day per request (used for the float precision).

    Returns {} unless EARTHDATA_TOKEN is present and the GES subsetter answers 200."""
    _, ed = creds()
    if not ed:
        return {}
    row = int(round((90 - lat) / PIXEL_DEG))
    col = int(round((lon + 180) / PIXEL_DEG))
    out: dict[str, float] = {}
    for day in days(start, end):
        stem = f"3B-DAY.MS.MRG.3IMERG.{day:%Y%m%d}-S000000-E235959.V07B.nc4"
        url = GES_SUBSET.format(base=GES_OPENDAP, year=day.year, month=day.month, stem=stem, r0=row, r1=row, c0=col, c1=col)
        try:
            response = session_.get(url, timeout=180, allow_redirects=False, headers={"Accept": "application/netcdf", **ed["headers"]})
        except requests.RequestException:
            continue
        if response.status_code != 200 or len(response.content) < 100:
            continue
        path = os.path.join(RAW, "tmp_pixel.nc4")
        with open(path, "wb") as handle:
            handle.write(response.content)
        try:
            import xarray

            with xarray.open_dataset(path) as ds:
                value = float(ds["precipitationCal"].values.ravel()[0])
                out[day.strftime("%Y%m%d")] = value
        except Exception:  # noqa: BLE001 - optional dependency
            break
        finally:
            try:
                os.remove(path)
            except OSError:
                pass
    return out


def station_check(session_: requests.Session, points: list[tuple[float, float]], start: dt.date, end: dt.date) -> str:
    rows = []
    for lat, lon in points:
        power = power_point(session_, lat, lon, start, end)
        nearest = nearest_ghcn(session_, lat, lon)
        station_series = ghcn_daily(session_, nearest["station"], start, end) if nearest else {}
        imerg = point_mm_series(session_, lat, lon, start, end)
        power_total = sum(v for v in power.values() if v is not None and v >= 0)
        station_total = sum(station_series.values()) if station_series else None
        imerg_total = sum(imerg.values()) if imerg else None
        rows.append([
            f"{lat:.2f},{lon:.2f}",
            f"{imerg_total:.1f}" if imerg_total is not None else "needs token",
            f"{power_total:.1f}" if power else "n/a",
            f"{station_total:.1f} ({len(station_series)} d)" if station_total is not None else "no PRCP",
            f"{nearest['station']} {nearest['name']} {nearest['distance_km']} km" if nearest else "n/a",
        ])
    return (
        table(rows, ["point", "IMERG total mm", "POWER total mm", "GHCN PRCP total mm", "nearest station"])
        + "\n\nPOWER is a scale/orientation check only (rev. 7 §4b-2). GHCN-Daily is the independent check"
        " (by_station/<ID>.csv.gz, PRCP in tenths of mm, -9999 missing). Known caveat, seen at the Dhaka"
        " station BGM00041923: PRCP is 0 on many monsoon days, so a station total can be far below the"
        " grid-cell total; judge scale agreement, and record a station as \"unconfirmed\" when it has"
        " zero reported rain on days the grid says it rained.\n"
    )


# --------------------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------------------
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Signals IMERG spike probe (writes only under scripts/signals/).")
    parser.add_argument("--point", type=parse_point, default=(23.81, 90.41), help="lat,lon inside the probe tile (default Dhaka)")
    parser.add_argument("--window", type=parse_window, default=(dt.date(2024, 7, 1), dt.date(2024, 7, 31)), help="start/end for the Final timing")
    parser.add_argument("--cell-deg", type=float, default=0.5, help="proposed output cell size")
    parser.add_argument("--tiles", type=int, default=6, help="enabled tiles projected for the size estimate")
    parser.add_argument("--full", action="store_true", help="also run the Late-history, bias and station parts")
    args = parser.parse_args(argv)

    os.makedirs(RAW, exist_ok=True)
    session_ = session()
    lat, lon = args.point
    start, end = args.window
    tile_lat, tile_lon = tile_of(lat, lon)

    print(f"Probe tile: {tile_lat:.0f}..{tile_lat + TILE_DEG:.0f} N, {tile_lon:.0f}..{tile_lon + TILE_DEG:.0f} E for point {lat},{lon}")
    timing_rows: list[list[str]] = []

    geotiff = probe_geotiff(session_)
    timing_rows.append(["geotiff (live product)", geotiff.ok, f"{geotiff.seconds:.1f}", human(geotiff.byte_count) if geotiff.ok else "-", geotiff.note])

    final_timings = probe_final(session_, start, end, tile_lat, tile_lon)
    minutes_per_month: float | None = None
    for timing in final_timings:
        timing_rows.append([timing.route, timing.ok, f"{timing.seconds:.1f}", human(timing.byte_count) if timing.byte_count else "-", timing.note[:160]])
        if timing.route.startswith("GES subset (month extrapolated)") and timing.ok:
            minutes_per_month = timing.seconds / 60

    workers = parallel_workers()
    months_2010 = (FINAL_END.year - RECORD_START.year) * 12 + FINAL_END.month - RECORD_START.month + 1
    months_product = (FINAL_END.year - PRODUCT_START.year) * 12 + FINAL_END.month - PRODUCT_START.month + 1
    channels = "one pixel per day (point series)" if os.environ.get("SIGNALS_POINT_ONLY") else "tile per day (20x20 cells at 0.5 deg)"
    projection = (
        f"- basis: {channels}\n"
        f"- 2010-01-01 → 2025-09-30 ({months_2010} months): {project_baseline(minutes_per_month, months_2010, workers)}\n"
        f"- {PRODUCT_START} → 2025-09-30 ({months_product} months): {project_baseline(minutes_per_month, months_product, workers)}\n"
    )
    if minutes_per_month is None:
        gate = "NOT MEASURED (rerun with EARTHDATA_TOKEN); step 1 stays blocked"
        rc = 1
    elif minutes_per_month * months_2010 / workers <= 30:
        gate = "PASS"
        rc = 0
    else:
        gate = "STOP (gate 0b): propose 2010-onward → fewer tiles → shorter record → Late-history baseline"
        rc = 1
    projection += f"- Gate 0b (one tile, 2010 onward ≤ 30 min): **{gate}**\n"

    body = table(timing_rows, ["route", "ok", "seconds", "bytes", "note"]) + "\n\n### Extrapolation (one tile)\n\n" + projection
    print(body)
    append_report("IMERG timing (0a/0b, auto-generated)", body)
    append_report("IMERG collection depth (CMR, auto-generated)", catalogue_depth(session_))

    late_rows: list[list[str]] = []
    if args.full:
        for timing in probe_late_history(session_):
            late_rows.append([timing.route, timing.ok, f"{timing.seconds:.1f}", human(timing.byte_count) if timing.byte_count else "-", timing.note[:140]])
        print(table(late_rows, ["route", "ok", "seconds", "bytes", "note"]))
        append_report("IMERG Late history depth (0c, auto-generated)", table(late_rows, ["route", "ok", "seconds", "bytes", "note"]))
        append_report("Late vs Final at probe points (0c, auto-generated)", bias_check(session_, start, end, lat, lon))
        append_report("Baseline artefact size (0k, auto-generated)", projected_sizes(session_, lat, lon, args.cell_deg, args.tiles))
        points = [args.point, (round(lat + 2.5, 2), round(lon + 2.5, 2)), (round(tile_lat + 1.0, 2), round(tile_lon + 1.0, 2))]
        append_report("Station / POWER check (auto-generated)", station_check(session_, points, start, end))

    print(f"\nReport: {os.path.relpath(REPORT)}   Raw: {os.path.relpath(RAW)}")
    return rc


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(2)
