"""Past hazard events in South Asia, from public NASA and UN/EU sources.

- Wildfire: NASA FIRMS MODIS active-fire detections (Terra + Aqua), per country per year.
  2003-2024 only, the years both satellites were flying, so yearly counts are comparable.
- Landslides: NASA Global Landslide Catalog (news-based, 2007-2017).
- Floods: GDACS flood alerts (UN/EU Global Disaster Alert and Coordination System).
"""

from __future__ import annotations

import csv
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

import requests

import power

RAW = Path(__file__).parent / "raw" / "events"
FIRMS = "https://firms.modaps.eosdis.nasa.gov/data/country/modis/{year}/modis_{year}_{country}.csv"
FIRE_COUNTRIES = ["India", "Myanmar", "Nepal", "Bangladesh", "Bhutan", "Sri_Lanka", "Pakistan"]
FIRE_YEARS = list(range(2003, 2025))
GLC_URL = "https://data.nasa.gov/docs/legacy/Global_Landslide_Catalog_Export/Global_Landslide_Catalog_Export_rows.csv"
GDACS = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"


def in_study_area(lat: float, lon: float) -> bool:
    return power.LAT_MIN <= lat <= power.LAT_MAX and power.LON_MIN <= lon <= power.LON_MAX


def _download(url: str, target: Path) -> Path:
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(5):
        try:
            res = requests.get(url, timeout=300)
            res.raise_for_status()
            tmp = target.with_suffix(".part")
            tmp.write_bytes(res.content)
            tmp.replace(target)
            return target
        except requests.RequestException as exc:
            print(f"  {url}: {exc}, retrying")
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"download failed: {url}")


# --- Wildfire -----------------------------------------------------------------------------

def fire_files() -> list[Path]:
    jobs = [(y, c) for y in FIRE_YEARS for c in FIRE_COUNTRIES]
    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(
            pool.map(
                lambda yc: _download(
                    FIRMS.format(year=yc[0], country=yc[1]), RAW / "firms" / f"{yc[0]}_{yc[1]}.csv"
                ),
                jobs,
            )
        )


def fires():
    """Yields (year, month, lat, lon) for vegetation fires detected with at least nominal confidence."""
    for path in fire_files():
        with open(path, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                # type 0 = presumed vegetation fire; FIRMS advises dropping low-confidence (<30) detections.
                if row["type"] != "0" or int(row["confidence"]) < 30:
                    continue
                lat, lon = float(row["latitude"]), float(row["longitude"])
                if in_study_area(lat, lon):
                    yield int(row["acq_date"][:4]), int(row["acq_date"][5:7]), lat, lon


# --- Landslides ---------------------------------------------------------------------------

def landslides() -> list[dict]:
    path = _download(GLC_URL, RAW / "glc.csv")
    out = []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if not row["latitude"] or not row["event_date"]:
                continue
            lat, lon = float(row["latitude"]), float(row["longitude"])
            if not in_study_area(lat, lon):
                continue
            when = datetime.strptime(row["event_date"][:10], "%m/%d/%Y")
            out.append(
                {
                    "date": when.date().isoformat(),
                    "lat": round(lat, 3),
                    "lon": round(lon, 3),
                    "trigger": row["landslide_trigger"] or "unknown",
                    "fatalities": int(float(row["fatality_count"])) if row["fatality_count"] else None,
                    "title": row["event_title"][:120],
                    "country": row["country_name"],
                }
            )
    return sorted(out, key=lambda e: e["date"])


# --- Floods -------------------------------------------------------------------------------

def floods(years: range) -> list[dict]:
    out, seen = [], set()
    for year in years:
        cache = RAW / "gdacs" / f"{year}.json"
        if not cache.exists():
            features, page = [], 1
            while True:
                res = requests.get(
                    GDACS,
                    params={
                        "eventlist": "FL",
                        "fromDate": f"{year}-01-01",
                        "toDate": f"{year}-12-31",
                        "alertlevel": "Green;Orange;Red",
                        "pagesize": 100,
                        "pagenumber": page,
                    },
                    timeout=120,
                )
                if res.status_code == 204 or not res.content:
                    break
                batch = res.json().get("features", [])
                features += batch
                if len(batch) < 100:
                    break
                page += 1
                time.sleep(0.5)
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(features), encoding="utf-8")
        for feat in json.loads(cache.read_text(encoding="utf-8")):
            lon, lat = feat["geometry"]["coordinates"][:2]
            p = feat["properties"]
            key = p.get("eventid"), p.get("episodeid")
            if key in seen or not in_study_area(lat, lon):
                continue
            seen.add(key)
            out.append(
                {
                    "date": p["fromdate"][:10],
                    "end": (p.get("todate") or "")[:10],
                    "lat": round(lat, 3),
                    "lon": round(lon, 3),
                    "alert": (p.get("alertlevel") or "").strip().title(),  # GDACS mixes "Red", "RED", "red"
                    "title": p.get("name", "Flood")[:120],
                    "country": p.get("country", ""),
                }
            )
    return sorted(out, key=lambda e: e["date"])
