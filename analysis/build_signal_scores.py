"""Data coverage and the area index for every administrative area.

Run after build_geography.py and build.py. Writes:

    web/public/data/signals/coverage.json     REAL data coverage per area, measured from the
                                              committed NASA analysis grids (see below)
    web/public/data/signals/areas/{ISO}.json  one compact index per country: the area ids, names,
                                              coverage state and boundary centre the Search, Gap and
                                              Frequency pages share
    web/public/data/signals/area-search.json  the same rows flattened for client-side search
    web/public/data/signals/provenance.json   dataset provenance, credits, versions and how each
                                              dataset is used.

Coverage is measured, not asserted. An area counts as covered by a variable when the area's land
carries usable values in at least half of the variable's own grid cells inside the area's
bounding box (and at least one cell), where a usable value covers 2014 onward with 10+ years
present. The trend grids place cell centres at lat0 + i * dLat, so a cell is attributed to an
area when its centre lies inside the area's boundary. ADM2 boundaries are usually smaller than
the grids, so an ADM2 area is covered when at least one grid cell centre falls inside it and
that cell carries a usable series.

No score, band, probability or confidence number is produced here. The former demo scores were
removed: a fixed hash of an area id presented as a flood probability is not a measurement, a
model output or an evaluation.

    python build_signal_scores.py
"""

from __future__ import annotations

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


def grid_extent(grids: dict[str, dict]) -> tuple[float, float, float, float]:
    """Union bounding box (lon0, lat0, lon1, lat1) of all analysis grids' cell centres."""
    boxes = []
    for grid in grids.values():
        lon1 = grid["lon0"] + (grid["nLon"] - 1) * grid["dLon"]
        lat1 = grid["lat0"] + (grid["nLat"] - 1) * grid["dLat"]
        boxes.append((grid["lon0"], grid["lat0"], lon1, lat1))
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def intersects(geometry, bounds: tuple[float, float, float, float]) -> bool:
    """Whether an area's bounds overlap the grid extent at all."""
    minx, miny, maxx, maxy = geometry.bounds
    return not (maxx < bounds[0] or minx > bounds[2] or maxy < bounds[1] or miny > bounds[3])


def main() -> None:
    manifest = json.loads((DATA / "trends" / "manifest.json").read_text(encoding="utf-8"))
    index = json.loads((GEO / "index.json").read_text(encoding="utf-8"))
    grids = load_grids(manifest)

    # NASA analysis grids cover South Asia only, so coverage can only exist where a boundary file
    # and a grid overlap. Every other country keeps its areas and shows "No data" — a real gap,
    # never a Green or a safe area. Geometry is only needed for the overlapping countries.
    grid_bounds = grid_extent(grids)

    # One geometry collection per level, so the cell-in-polygon test uses a spatial index.
    geoms: dict[tuple[str, str], dict] = {}
    admin_geoms: dict[str, object] = {}
    measured_countries: list[str] = []
    for country in index["countries"]:
        iso = country["code"]
        adm0_geo = (Path(__file__).parent / "raw" / "geoboundaries" / iso / "ADM0.geojson")
        if not adm0_geo.exists():
            continue
        country_geometry = shape(json.loads(adm0_geo.read_text(encoding="utf-8"))["features"][0]["geometry"]).buffer(0)
        if not intersects(country_geometry, grid_bounds):
            continue
        measured_countries.append(iso)
        admin_geoms[iso] = country_geometry
        for level in ("ADM1", "ADM2"):
            path = Path(__file__).parent / "raw" / "geoboundaries" / iso / f"{level}.geojson"
            if not path.exists():
                continue
            geo = json.loads(path.read_text(encoding="utf-8"))
            geoms[(iso, level)] = {
                (f.get("properties") or {}).get("shapeName", "").strip(): shape(f["geometry"]).buffer(0)
                for f in geo["features"]
            }

    coverage_areas = []
    centres: dict[str, list[float]] = {}

    def cell_stats(geometry) -> tuple[dict[str, dict], int]:
        """Per-variable cell counts, and how many of the finest grid's cells lie inside."""
        cells: dict[str, dict] = {}
        inside = 0
        if geometry is None or geometry.is_empty:
            return cells, inside
        for var, grid in grids.items():
            indices = cell_cells(grid, geometry)
            covered = len([k for k in indices if k in grid["usable"]])
            share = covered / len(indices) if indices else 0.0
            # ADM0 and ADM1 keep the 50% rule; an ADM2 polygon is usually smaller than the grid,
            # so it is covered when one cell centre falls inside and carries a usable series.
            enough = covered > 0 and (share >= MIN_COVERED_SHARE or level == "ADM2")
            cells[var] = {"areaCells": len(indices), "coveredCells": covered, "covered": bool(indices) and enough}
            if var == "heavy-rain":
                inside = len(indices)
        return cells, inside

    for country in index["countries"]:
        iso = country["code"]
        admin = json.loads((GEO / "admin" / f"{iso}.json").read_text(encoding="utf-8"))
        country_id = f"{iso.lower()}-adm0"
        adm0_geometry = admin_geoms.get(iso)
        cells, _ = cell_stats(adm0_geometry)
        coverage_areas.append({"id": country_id, "country": iso, "level": "ADM0", "cells": cells})
        if adm0_geometry is not None:
            point = adm0_geometry.representative_point()
            centres[country_id] = [round(point.y, 2), round(point.x, 2)]
        # A country's own grid cells are too coarse to speak for its districts, so the country row
        # also records how many of its published ADM1 areas carry coverage. That is what keeps a
        # country with partial area data from contradicting the list underneath it.
        for level in ("ADM1", "ADM2"):
            if level not in admin["levels"]:
                continue
            level_geoms = geoms.get((iso, level), {})
            for unit in admin["levels"][level]["units"]:
                geometry = level_geoms.get(unit["name"])
                cells, _ = cell_stats(geometry)
                coverage_areas.append({"id": unit["id"], "country": iso, "level": level, "cells": cells})
                if geometry is not None and not geometry.is_empty:
                    point = geometry.representative_point()
                    centres[unit["id"]] = [round(point.y, 2), round(point.x, 2)]

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
                    f"{MIN_VALUE_YEARS}+ years from {COVERAGE_START_YEAR}. An ADM2 area is covered "
                    f"when at least one such cell centre falls inside it.",
            "unusableRows": sum(1 for row in rows if row is None or
                                len([v for v in row[grid["years"].index(COVERAGE_START_YEAR)
                                                   if COVERAGE_START_YEAR in grid["years"] else 0:]
                                     if v is not None]) < MIN_VALUE_YEARS),
        }

    json_write(OUT / "coverage.json", {
        "schema": "signals-coverage-v4",
        "generatedFrom": {"trends": manifest["generated"]},
        "measuredCountries": sorted(measured_countries),
        "gridExtent": {"lon": [grid_bounds[0], grid_bounds[2]], "lat": [grid_bounds[1], grid_bounds[3]]},
        "method": "A grid cell belongs to the area whose geoBoundaries boundary contains the "
                  "cell centre. A variable is covered when at least 50% of the variable's cells "
                  "in the area's bounding box belong to the area and carry a usable series (an "
                  "ADM2 area needs one such cell, since those polygons are usually smaller than "
                  "the grids). The NASA analysis grids used here cover South Asia only, so "
                  "countries outside their extent have no measured coverage. Coverage is not a "
                  "weather value and no weather value is invented for an area that lacks one.",
        "variables": coverage_vars,
        "areas": sorted(coverage_areas, key=lambda a: a["id"]),
    })

    # Per-country area index: [id, name, centre lat, centre lon, layers, cellShare]. One file per
    # country keeps the directory small; the Search page loads one country's file at a time.
    areas_dir = OUT / "areas"
    areas_dir.mkdir(parents=True, exist_ok=True)
    index_by_iso = {country["code"]: country for country in index["countries"]}
    coverage_by_id = {area["id"]: area for area in coverage_areas}
    for path in areas_dir.glob("*.json"):
        path.unlink()
    for iso, country in index_by_iso.items():
        admin = json.loads((GEO / "admin" / f"{iso}.json").read_text(encoding="utf-8"))
        payload: dict[str, object] = {
            "name": country.get("name"),
            "nameBn": country.get("nameBn"),
            "levels": {},
        }
        for level in ("ADM1", "ADM2"):
            units = admin["levels"].get(level, {}).get("units") or []
            if not units:
                continue
            summary = admin["levels"][level]
            rows = []
            for unit in units:
                area = coverage_by_id.get(unit["id"])
                layers = 0
                cell_share = None
                if area:
                    counted = [c for c in area["cells"].values() if c["areaCells"] > 0]
                    layers = sum(1 for c in area["cells"].values() if c["covered"])
                    if counted:
                        cell_share = round(sum(c["coveredCells"] for c in counted)
                                           / sum(c["areaCells"] for c in counted), 4)
                centre = centres.get(unit["id"])
                rows.append([
                    unit["id"],
                    unit["name"],
                    centre[0] if centre else None,
                    centre[1] if centre else None,
                    layers,
                    cell_share,
                ])
            payload["levels"][level] = {
                "name": summary["name"],
                "nameBn": summary["nameBn"],
                "rows": rows,
            }
        json_write(areas_dir / f"{iso}.json", payload)

    # A compact index for client-side search: [iso, level, name, id, layers]. Coverage, not a
    # score, so a filter can only answer "is there data here", never "is it dangerous".
    search_rows = [
        [iso, level, row[1], row[0], row[4]]
        for iso in sorted(index_by_iso)
        for level in ("ADM1", "ADM2")
        for row in (json.loads((areas_dir / f"{iso}.json").read_text(encoding="utf-8")).get("levels", {}).get(level, {}).get("rows") or [])
    ]
    json_write(OUT / "area-search.json", {"schema": "signals-area-search-v3", "areas": search_rows})

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
                   "identifiers. Provides no weather data and no signal.",
        },
        "data": [
            {"variable": var, "name": name, "dataset": dataset, "use": use,
             "file": f"trends/{series_file}"}
            for var, name, _, dataset, series_file, _, use in VARIABLES
        ],
    })
    demo_path = OUT / "demo-scores.json"
    if demo_path.exists():
        demo_path.unlink()
    print(f"coverage: {len(coverage_areas)} areas; index: {len(search_rows)} rows")


if __name__ == "__main__":
    main()
