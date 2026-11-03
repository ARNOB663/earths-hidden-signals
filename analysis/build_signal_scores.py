"""Data coverage and DEMO signal scores for every administrative area.

Run after build_geography.py and build.py. Writes three files:

    web/public/data/signals/coverage.json     REAL data coverage per area, measured from the
                                              committed NASA analysis grids (see below)
    web/public/data/signals/demo-scores.json  FIXED DEMO scores, clearly labelled sample data.
                                              No measurement, prediction or evaluation feeds them.
    web/public/data/signals/provenance.json   dataset provenance, credits, versions and how each
                                              dataset is used. Deliberately NOT sources.json:
                                              that name belongs to the legacy rain-signal
                                              pipeline (scripts/signals/writer.py) and is read
                                              by /about, which expects a different shape.

Coverage is measured, not asserted. An area counts as covered by a variable when the area's land
carries usable values in at least half of the variable's own grid cells inside the area's
bounding box (and at least one cell), where a usable value covers 2014 onward with 10+ years
present. The trend grids
place cell centres at lat0 + i * dLat, so a cell is attributed to an area when its centre lies
inside the area's boundary.

Demo scores are a pure function of the area identifier (SHA-256 of schema + event + level + id),
so they are identical on every machine and every rerun. They exist only to show the workflow
until prediction output replaces them; the Signals page always labels them as demo.

    python build_signal_scores.py
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from shapely.geometry import shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "web" / "public" / "data"
GEO = DATA / "geography"
OUT = DATA / "signals"

COVERAGE_START_YEAR = 2014
MIN_VALUE_YEARS = 10
MIN_COVERED_SHARE = 0.5

# (key, label, Bangla label, dataset, series file, letter shown in the coverage cell, how it is used)
VARIABLES = [
    ("temperature", "Temperature", "তাপমাত্রা", "NASA GISTEMP v4", "temperature_annual_series.json", "T",
     "Temperature trends (annual and seasonal)"),
    ("rainfall", "Rainfall", "বৃষ্টিপাত", "NASA GSFC / NOAA GPCP v2.3", "rainfall_annual_series.json", "R",
     "Rainfall trends (annual and seasonal totals)"),
    ("hot-months", "Hot months", "উষ্ণ মাস", "NASA GISTEMP v4", "hot-months_annual_series.json", "H",
     "Months per year above the very-hot threshold"),
    ("heavy-rain", "Heavy-rain days", "ভারী বৃষ্টির দিন", "NASA GSFC GPCP 1DD v1.3", "heavy-rain_annual_series.json", "E",
     "Days per year above the very-heavy-rain threshold"),
    ("dry-spell", "Dry spells", "খরা কাল", "NASA GSFC GPCP 1DD v1.3", "dry-spell_annual_series.json", "D",
     "Longest dry spell each year"),
    ("wettest-day", "Wettest day", "সর্বোচ্চ বৃষ্টির দিন", "NASA GSFC GPCP 1DD v1.3", "wettest-day_annual_series.json", "W",
     "Wettest day each year"),
]

DEMO_SCHEMA = "signals-demo-v1"
DEMO_EVENT = "Flood-related event reaching the area in the next 7 days"


def json_write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                               allow_nan=False) + "\n", encoding="utf-8")


def load_grids(manifest: dict) -> dict[str, dict]:
    grids = {}
    for var, _, _, _, series_file, _, _ in VARIABLES:
        rows = json.loads((DATA / "trends" / series_file).read_text(encoding="utf-8"))
        years = manifest["variables"][var]["years"]
        start = years.index(COVERAGE_START_YEAR) if COVERAGE_START_YEAR in years else 0
        usable = set()
        for k, row in enumerate(rows):
            if row is None:
                continue
            values = [v for v in row[start:] if v is not None]
            if len(values) >= MIN_VALUE_YEARS:
                usable.add(k)
        grid = dict(manifest["grids"][var])
        grid["usable"] = usable
        grid["years"] = years[start:]
        grids[var] = grid
    return grids


def cell_cells(grid: dict, geometry) -> list[int]:
    """Indices of grid cells whose centre lies inside the geometry."""
    minx, miny, maxx, maxy = geometry.bounds
    hits = []
    for i in range(grid["nLat"]):
        lat = grid["lat0"] + i * grid["dLat"]
        if lat < miny or lat > maxy:
            continue
        for j in range(grid["nLon"]):
            lon = grid["lon0"] + j * grid["dLon"]
            if minx <= lon <= maxx and geometry.contains(_point(lon, lat)):
                hits.append(i * grid["nLon"] + j)
    return hits


def _point(lon: float, lat: float):
    from shapely.geometry import Point
    return Point(lon, lat)


def demo_score(area_id: str) -> dict:
    digest = hashlib.sha256(f"{DEMO_SCHEMA}|{DEMO_EVENT}|{area_id}".encode("utf-8")).digest()
    value = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF
    score = round(value, 4)
    signal = "red" if score >= 0.75 else "yellow" if score >= 0.5 else "green"
    second = int.from_bytes(digest[4:8], "big") / 0xFFFFFFFF
    return {
        "signal": signal,
        "probability": score,
        "modelConfidence": round(0.3 + 0.6 * second, 2),
    }


def main() -> None:
    manifest = json.loads((DATA / "trends" / "manifest.json").read_text(encoding="utf-8"))
    index = json.loads((GEO / "index.json").read_text(encoding="utf-8"))
    grids = load_grids(manifest)

    # One geometry collection per level, so the cell-in-polygon test uses a spatial index.
    geoms: dict[tuple[str, str], dict] = {}
    admin_geoms: dict[str, object] = {}
    for country in index["countries"]:
        iso = country["code"]
        admin = json.loads((GEO / "admin" / f"{iso}.json").read_text(encoding="utf-8"))
        country_geo = json.loads((Path(__file__).parent / "raw" / "geoboundaries" / iso / "ADM0.geojson")
                                 .read_text(encoding="utf-8"))
        admin_geoms[iso] = shape(country_geo["features"][0]["geometry"]).buffer(0)
        for level in ("ADM1", "ADM2"):
            if level not in admin["levels"]:
                continue
            geo = json.loads((Path(__file__).parent / "raw" / "geoboundaries" / iso / f"{level}.geojson")
                             .read_text(encoding="utf-8"))
            features = {(f.get("properties") or {}).get("shapeName", "").strip(): shape(f["geometry"]).buffer(0)
                        for f in geo["features"]}
            geoms[(iso, level)] = features

    coverage_areas = []
    demo_areas = []

    def area_coverage(geometry) -> dict[str, dict]:
        cells: dict[str, dict] = {}
        if geometry is None or geometry.is_empty:
            return cells
        for var, grid in grids.items():
            indices = cell_cells(grid, geometry)
            covered = len([k for k in indices if k in grid["usable"]])
            share = covered / len(indices) if indices else 0.0
            cells[var] = {"areaCells": len(indices), "coveredCells": covered,
                          "covered": bool(indices) and covered > 0 and share >= MIN_COVERED_SHARE}
        return cells

    for country in index["countries"]:
        iso = country["code"]
        admin = json.loads((GEO / "admin" / f"{iso}.json").read_text(encoding="utf-8"))
        country_geometry = admin_geoms.get(iso)
        coverage_areas.append({"id": f"{iso.lower()}-adm0", "country": iso, "level": "ADM0",
                               "cells": area_coverage(country_geometry)})
        for level in ("ADM1", "ADM2"):
            if level not in admin["levels"]:
                continue
            for unit in admin["levels"][level]["units"]:
                area_id = unit["id"]
                if level == "ADM1":
                    coverage_areas.append({
                        "id": area_id,
                        "country": iso,
                        "level": level,
                        "cells": area_coverage(geoms[(iso, level)].get(unit["name"])),
                    })
                demo_areas.append({"id": area_id, **demo_score(area_id)})

    coverage_vars = {}
    for var, name, name_bn, dataset, series_file, letter, _use in VARIABLES:
        grid = grids[var]
        rows = json.loads((DATA / "trends" / series_file).read_text(encoding="utf-8"))
        observed = manifest["variables"][var]
        coverage_vars[var] = {
            "name": name,
            "nameBn": name_bn,
            "dataset": dataset,
            "file": f"trends/{series_file}",
            "gridDegrees": grid["dLat"],
            "analysisCells": len(grid["usable"]),
            "years": [grid["years"][0], grid["years"][-1]],
            "observedThrough": observed.get("years", [None, None])[-1],
            "unit": observed.get("unit"),
            "letter": letter,
            "rule": f"Covered when at least {int(MIN_COVERED_SHARE * 100)}% of the variable's grid "
                    f"cells in the area's bounding box lie inside the boundary and carry a value for "
                    f"{MIN_VALUE_YEARS}+ years from {COVERAGE_START_YEAR}.",
            "unusableRows": sum(1 for row in rows if row is None or
                                len([v for v in row[grid["years"].index(COVERAGE_START_YEAR)
                                                   if COVERAGE_START_YEAR in grid["years"] else 0:]
                                     if v is not None]) < MIN_VALUE_YEARS),
        }

    json_write(OUT / "coverage.json", {
        "schema": "signals-coverage-v2",
        "generatedFrom": {"trends": manifest["generated"]},
        "method": "A grid cell belongs to the area whose geoBoundaries boundary contains the "
                  "cell centre. A variable is covered when at least 50% of the variable's cells "
                  "in the area's bounding box belong to the area and carry a usable series. "
                  "Coverage is measured per ADM0 country and ADM1 area; ADM2 areas are usually "
                  "smaller than these analysis grids, so their coverage is not published and they "
                  "are shown as 'No data'. No weather value is invented for an area that lacks one.",
        "variables": coverage_vars,
        "areas": sorted(coverage_areas, key=lambda a: a["id"]),
    })

    json_write(OUT / "demo-scores.json", {
        "schema": DEMO_SCHEMA,
        "status": "demo",
        "notReal": True,
        "event": DEMO_EVENT,
        "eventPeriod": "Next 7 days",
        "scoreField": "probability",
        "scoreMeaning": "DEMO ONLY. A fixed sample percentage standing in for the share of "
                        "comparable weeks with a flood-related event. It is not a prediction, "
                        "measurement, alert or model output.",
        "modelConfidenceMeaning": "DEMO ONLY. Separately generated sample number, not derived from "
                                  "any evaluation and not a measure of accuracy.",
        "signalBands": [
            {"signal": "red", "min": 0.75},
            {"signal": "yellow", "min": 0.5},
            {"signal": "green", "min": 0.0},
        ],
        "generator": "sha256(schema|event|area id) -> uniform in [0,1); deterministic, no data used",
        "areas": sorted(demo_areas, key=lambda a: a["id"]),
    })

    json_write(OUT / "provenance.json", {
        "schema": "signals-sources-v1",
        "geography": {
            "name": "geoBoundaries gbOpen",
            "url": index["source"]["url"],
            "licenseUrl": "https://www.geoboundaries.org/license/",
            "citation": index["source"]["citation"],
            "licenseFile": "geography/license.json",
            "indexFile": "geography/index.json",
            "use": "Administrative geography only: country and area boundaries, names and "
                   "identifiers. Provides no weather data and no scores.",
        },
        "data": [
            {"variable": var, "name": name, "dataset": dataset, "use": use,
             "file": f"trends/{series_file}"}
            for var, name, _, dataset, series_file, _, use in VARIABLES
        ],
        "demo": {
            "file": "signals/demo-scores.json",
            "status": "demo",
            "replacedBy": "Prediction output with the same schema; the page reads this file only.",
        },
    })
    print(f"coverage: {len(coverage_areas)} areas; demo: {len(demo_areas)} areas")


if __name__ == "__main__":
    main()
