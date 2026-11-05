"""Per-place payload for /signals/place: Before, Now, Next, Trust (plan: signals trust axis).

Every number here is copied from a committed file, never invented:

* Before — the analysis pipeline's Sen slopes with a 95% CI (`web/public/data/trends/*.json`),
  aggregated per administrative area as the unweighted mean over the grid cells whose centre
  lies inside the boundary. Temperature and rain come from the same files the trends page reads.
* Now — the sample grid cells (`signals/grid/*.json`) for the tile containing the area.
* Next — Open-Meteo rain for the area's centre, labelled external, `usedInStatus: false`. When
  the provider is unreachable the outlook is null and the page says so.
* Trust — reuse only: the analysis engine's own 95% CI. The area was *detectable* when the
  area's agreement statistic came out consistent in at least one variable's trend; otherwise it
  is a *blind spot* (no trend large enough for the data to separate from zero). No new statistic.
* Evidence — Open-Meteo's historical rain archive (a different product from IMERG) with GDACS
  flood events marked as catalogue records, not as signal outcomes.

Deterministic parts (Before/Now/Trust/Evidence) are pure functions of committed files, so the
CI byte-identical gate holds. Only `--refresh` touches the network.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import struct
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WEB_DATA = ROOT / "web" / "public" / "data"
TRENDS = WEB_DATA / "trends"
GEO = WEB_DATA / "geography"
SIGNALS = WEB_DATA / "signals"
RAW_GEO = ROOT / "analysis" / "raw" / "geoboundaries"

LEVELS = ("ADM1", "ADM2", "ADM0")
# Before shows one climate series per variable; the list is the page contract, not a threshold.
BEFORE_VARIABLES = (
    ("temperature", "annual"),
    ("rainfall", "annual"),
    ("heavy-rain", "annual"),
)
# Recorded in the payload so the page can say which NASA series each strip came from.
DATASETS = {
    "temperature": "NASA GISTEMP v4, annual mean land temperature",
    "rainfall": "NASA GPCP v2.3, annual rain",
    "heavy-rain": "NASA GPCP 1DD v1.3, very heavy rain days",
}
# Land cells only: the trend files mark sea and low-land-fraction cells as null.
MIN_CELLS = 1
TRUST_LABEL = {
    "detectable": "Detectable",
    "blind-spot": "Blind spot",
    "no-data": "No data",
}
TRUST_TEXT = {
    "detectable": "The record is long and consistent enough for a trend here to be separated from zero noise, at least in one of the variables. A change here is measurable, so a signal here can be checked.",
    "blind-spot": "No trend here is separate from year-to-year noise in 45 years of data. We cannot tell a change from normal variation, so a signal here cannot yet be checked against history.",
    "no-data": "No gridded history covers this area, so there is nothing to compare a signal against.",
}


# --- geography -------------------------------------------------------------------------------


def slug(text: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in text)
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-") or "area"


def read_dbf(path: Path) -> list[str]:
    """shapeName column only, in file order (same reader as analysis/build_geography.py)."""
    raw = path.read_bytes()
    count = struct.unpack("<I", raw[4:8])[0]
    header = struct.unpack("<H", raw[8:10])[0]
    record = struct.unpack("<H", raw[10:12])[0]
    fields = []
    for offset in range(32, header - 1, 32):
        spec = raw[offset : offset + 32]
        fields.append((spec[0:11].split(b"\x00")[0].decode().strip(), spec[16]))
    names = []
    for index in range(count):
        start = header + index * record
        cursor = start + 1
        row = {}
        for name, length in fields:
            row[name] = raw[cursor : cursor + length].decode("utf-8", "replace").replace("\x00", "").strip()
            cursor += length
        if raw[start : start + 1] != b"*" and row.get("shapeName"):
            names.append(row["shapeName"])
    return names


def unit_ids(iso: str, level: str, names: list[str]) -> list[str]:
    used: dict[str, int] = {}
    ids = []
    for name in names:
        base = f"{iso.lower()}-{level.lower()}-{slug(name)}"
        used[base] = used.get(base, 0) + 1
        ids.append(base if used[base] == 1 else f"{base}-{used[base]}")
    return ids


def load_geometry(iso: str, level: str) -> list[tuple[str, object]]:
    """(area id, shapely geometry) pairs, ids in the same order as the country admin file."""
    from shapely.geometry import shape

    geojson = RAW_GEO / iso / f"{level}.geojson"
    dbf = RAW_GEO / iso / f"{level}.dbf"
    if not geojson.exists() or not dbf.exists():
        return []
    features = json.loads(geojson.read_text(encoding="utf-8"))["features"]
    ids = unit_ids(iso, level, read_dbf(dbf))
    # geoBoundaries writes one feature per unit, categories "1"/"2" being part/mainland of the
    # same unit; shapeID order matches the dbf record order.
    out: dict[str, object] = {}
    for index, feature in enumerate(features):
        if index >= len(ids):
            break
        try:
            geometry = shape(feature["geometry"]).buffer(0)
        except Exception:  # noqa: BLE001 - a broken polygon must not stop the build
            continue
        area_id = ids[index]
        out[area_id] = out[area_id].union(geometry) if area_id in out else geometry
    return list(out.items())


def admin_units(iso: str) -> dict[str, list[dict]]:
    path = GEO / "admin" / f"{iso}.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {level: data["levels"][level].get("units") or [] for level in LEVELS if level in data["levels"]}


def country_records() -> list[dict]:
    index = json.loads((GEO / "index.json").read_text(encoding="utf-8"))
    return index["countries"]


# --- Before: the analysis engine's Sen slope 95% CI, per area ---------------------------------


def _trend_files() -> dict[str, dict]:
    manifest = json.loads((TRENDS / "manifest.json").read_text(encoding="utf-8"))
    out = {}
    for var, season in BEFORE_VARIABLES:
        key = f"{var}_{season}"
        stats = json.loads((TRENDS / f"{key}.json").read_text(encoding="utf-8"))
        series = json.loads((TRENDS / f"{key}_series.json").read_text(encoding="utf-8"))
        grid = manifest["grids"][var]
        years = manifest["variables"][var]["years"]
        decimals = manifest["variables"][var]["decimals"]
        meta = manifest["variables"][var]
        out[key] = {
            "key": key,
            "variable": var,
            "season": season,
            "label": meta["label"],
            "unit": meta["unit"],
            "per": "decade",
            "decimals": decimals,
            "grid": grid,
            "years": years,
            "series": series,
            "stats": stats,
            "dataset": DATASETS[var],
        }
    return out


def cell_centres(grid: dict) -> tuple[np.ndarray, np.ndarray]:
    lats = grid["lat0"] + np.arange(grid["nLat"]) * grid["dLat"]
    lons = grid["lon0"] + np.arange(grid["nLon"]) * grid["dLon"]
    return lats, lons


def area_cells(geometry, grid: dict) -> list[int]:
    """Flat cell indices whose centre lies inside the boundary (the coverage rule's own rule)."""
    from shapely.geometry import Point

    lats, lons = cell_centres(grid)
    minx, miny, maxx, maxy = geometry.bounds
    indices = []
    for i, lat in enumerate(lats):
        if lat < miny or lat > maxy:
            continue
        for j, lon in enumerate(lons):
            if lon < minx or lon > maxx:
                continue
            if geometry.contains(Point(float(lon), float(lat))):
                indices.append(i * grid["nLon"] + j)
    return indices


def _mean(values: list[float]) -> float | None:
    return float(sum(values) / len(values)) if values else None


def _round(value: float | None, decimals: int) -> float | None:
    return None if value is None else round(value, decimals)


def before_for(geometry, trends: dict[str, dict]) -> dict:
    """Unweighted mean of the area's own cells: slope, lower and upper CI, and the series."""
    variables = []
    for key, trend in trends.items():
        cells = area_cells(geometry, trend["grid"])
        slope = trend["stats"]["slopePerDecade"]
        lower = trend["stats"]["lowerPerDecade"]
        upper = trend["stats"]["upperPerDecade"]
        significant = trend["stats"]["significant"]
        dec = trend["decimals"]
        usable = [c for c in cells if slope[c] is not None]
        slopes = [slope[c] for c in usable]
        los = [lower[c] for c in usable if lower[c] is not None]
        his = [upper[c] for c in usable if upper[c] is not None]
        sig = sum(1 for c in cells if significant[c])
        # The area's own series: the same unweighted cell mean for every year the grid has.
        series = []
        for year_index in range(len(trend["years"])):
            values = [trend["series"][c][year_index] for c in usable if trend["series"][c]]
            series.append(_round(_mean(values), dec) if len(values) == len(usable) and usable else None)
        lower_mean, upper_mean = _round(_mean(los), dec + 2), _round(_mean(his), dec + 2)
        slope_mean = _round(_mean(slopes), dec + 2)
        consistent = bool(los and his and (min(his) < 0 or min(los) > 0))
        title = title_for(trend["variable"], trend["label"], slope_mean, lower_mean, upper_mean, consistent)
        variables.append(
            {
                "key": key,
                "title": title[0],
                "titleBn": title[1],
                "variable": trend["variable"],
                "label": trend["label"],
                "unit": trend["unit"],
                "per": trend["per"],
                "dataset": trend["dataset"],
                "cells": len(usable),
                "cellsSignificant": sig,
                "slopePerDecade": slope_mean,
                "lowerPerDecade": lower_mean,
                "upperPerDecade": upper_mean,
                "ciConsistent": consistent,
                "years": trend["years"],
                "series": series,
            }
        )
    years = trends[next(iter(trends))]["years"] if trends else []
    return {
        "years": years,
        "spanYears": (years[-1] - years[0] + 1) if years else 0,
        "firstYear": years[0] if years else None,
        "lastYear": years[-1] if years else None,
        "variables": variables,
    }


def trust_for(before: dict) -> dict:
    """Reuse of the engine's 95% CI: detectable when at least one area trend is separated from zero."""
    measured = [v for v in before["variables"] if v["slopePerDecade"] is not None]
    if not measured:
        return {"state": "no-data", "label": TRUST_LABEL["no-data"], "text": TRUST_TEXT["no-data"], "variables": []}
    measured_keys = {v["key"] for v in measured}
    consistent = [v["key"] for v in measured if v["ciConsistent"]]
    state = "detectable" if consistent else "blind-spot"
    return {
        "state": state,
        "label": TRUST_LABEL[state],
        "text": TRUST_TEXT[state],
        "variables": consistent,
        "variablesEn": [v["label"] for v in measured if v["key"] in consistent],
        "measuredVariables": len(measured),
        "measuredVariablesEn": [v["label"] for v in measured],
        "measured": sorted(measured_keys),
        "rule": "Detectable when the area-mean 95% Sen slope CI excludes zero for at least one variable.",
    }


# --- Now: the sample grid cells for the area's tile ---------------------------------------------


_NUM_BN = str.maketrans("0123456789.", "০১২৩৪৫৬৭৮৯.")


def _bn(number: float, digits: int = 1) -> str:
    return f"{number:.{digits}f}".translate(_NUM_BN)


def _reason_bn(cell: dict) -> str:
    """The same sentence as reasonText in Bangla, built from the cell's own numbers.

    reasonText is the engine's own line for the chosen window; a Green cell has no chosen window
    (windowDays is null), so the sentence is rebuilt from the three windows it does carry.
    """
    d = _bn
    if cell["status"] == "grey":
        return "ধূসর: এই জায়গা বিচারের মতো যথেষ্ট তুলনা-ইতিহাস নেই বা অনেক দিন অনুপস্থিত।"
    if cell["status"] == "green":
        parts = []
        for days, mm in ((1, cell.get("day1")), (3, cell.get("day3")), (7, cell.get("day7"))):
            if mm is not None:
                parts.append(f"{d(days, 0)} দিনে {d(mm)} মিমি")
        body = " · ".join(parts) if parts else "বৃষ্টি"
        return f"{body}; এই তারিখের স্বাভাবিকের কাছাকাছি।"
    window = cell.get("windowDays") or 1
    mm = cell.get("day1") if window == 1 else cell.get("day3") if window == 3 else cell.get("day7")
    head = "১ দিনের" if window == 1 else f"{d(window, 0)} দিনের"
    ratio = cell.get("ratio")
    if ratio is None:
        return f"{head} বৃষ্টি {d(mm)} মিমি; এই তারিখের জন্য অস্বাভাবিকভাবে ভেজা।"
    return f"{head} বৃষ্টি এই তারিখের স্বাভাবিকের {d(ratio)} গুণ ({d(mm)} মিমি)।"


def load_grids() -> dict[str, list[dict]]:
    out = {}
    for path in sorted((SIGNALS / "grid").glob("*.json")):
        out[path.stem] = json.loads(path.read_text(encoding="utf-8"))["cells"]
    return out


def now_for(geometry, grid_cells: list[dict], meta: dict, tile: dict | None) -> dict:
    from shapely.geometry import Point

    if tile is None or not grid_cells:
        return {"state": "no-data", "cells": [], "tile": None}
    inside = [c for c in grid_cells if geometry.contains(Point(c["lon"], c["lat"]))]
    if not inside:
        # No cell centre inside a small ADM2 boundary: fall back to the nearest cell centres.
        def d(c):
            lon, lat = geometry.representative_point().coords[0]
            return (c["lon"] - lon) ** 2 + (c["lat"] - lat) ** 2

        inside = sorted(grid_cells, key=d)[:1]
    # Nearest cell first, so the headline reading is the one closest to the area's centre. The
    # ranked list on /signals ranks by status; this strip is about this place, not the set.
    lon, lat = geometry.representative_point().coords[0]

    def distance(c: dict) -> float:
        return (c["lon"] - lon) ** 2 + (c["lat"] - lat) ** 2

    inside = sorted(inside, key=distance)
    unusable = [c for c in inside if c["status"] == "grey"]
    measured = [c for c in inside if c["status"] != "grey"]
    def word(cell: dict) -> dict:
        return {
            "en": cell["reasonText"],
            "bn": _reason_bn(cell),
        }

    cells = [
        {
            "lat": c["lat"],
            "lon": c["lon"],
            "status": c["status"],
            "confidence": c["confidence"],
            "reasonText": c["reasonText"],
            "reasonTextBn": word(c)["bn"],
            "windowDays": c["windowDays"],
            "percentile": c["percentile"],
            "ratio": c["ratio"],
            "day1": c["day1"],
            "day3": c["day3"],
            "day7": c["day7"],
            "sample": bool(c.get("sample")),
        }
        for c in inside[:12]
    ]
    state = "measured" if measured else ("no-data" if unusable else "no-data")
    return {
        "state": state,
        "tile": tile["id"],
        "tileLabel": tile["label"],
        "sample": bool(meta.get("sampleData")),
        "clock": meta.get("measurementTime"),
        "cells": cells,
        "measuredCells": len(measured),
        "screenedCells": len(unusable),
    }


# --- Map outline: small boundaries only ---------------------------------------------------------

# The list is the complete index; the map draws only boundaries small enough to stay light.
MAP_MAX_POINTS = 90
MAP_MAX_AREA_KM2 = 50_000


def _row_status(status: str) -> str:
    """Map a Grey cell to the row word "no data"; the map draws one language of states."""
    return "no-data" if status == "grey" else status


def _simplify(geometry):
    """Map outlines keep their shape but lose metre-level detail before we round to 0.1°."""
    from shapely import set_precision

    return set_precision(geometry, 0.05)


def _has_area(ring: list[list[float]]) -> bool:
    """True when a rounded ring still encloses area: both axes must move by at least 0.1°."""
    lons = [lon for lon, _ in ring]
    lats = [lat for _, lat in ring]
    return max(lons) > min(lons) and max(lats) > min(lats)


def _cell_marker(centre: tuple[float, float]) -> list[list[float]]:
    """A one-grid-cell ring for a boundary smaller than the outline resolution.

    A district narrower than 0.1° rounds to a line, and a line cannot be drawn or clicked. The
    smallest honest mark is the grid cell the centre falls in, marked on the map as the boundary
    that could not be drawn rather than as a boundary that exists.
    """
    lat, lon = centre
    south = math.floor(lat * 10) / 10
    west = math.floor(lon * 10) / 10
    return [[west, south], [west + 0.1, south], [west + 0.1, south + 0.1], [west, south + 0.1]]


def _outline(geometry) -> list[list[list[float]]]:
    geometry = _simplify(geometry)
    rings = []
    polygons = [geometry] if geometry.geom_type == "Polygon" else list(getattr(geometry, "geoms", []))
    for polygon in polygons:
        # Sample the whole ring, not its first points: a boundary keeps its shape only when every
        # side is represented. Rounding to 0.1° first keeps the sampling even.
        coords = [[round(x, 1), round(y, 1)] for x, y in polygon.exterior.coords]
        if len(coords) > MAP_MAX_POINTS:
            step = len(coords) / (MAP_MAX_POINTS - 1)
            exterior = [coords[int(index * step)] for index in range(MAP_MAX_POINTS - 1)]
        else:
            exterior = coords[:-1]
        if len(exterior) >= 3 and _has_area(exterior):
            rings.append(exterior)
    return rings


def build_map(places: dict) -> None:
    """One file per country in the tiles: boundary rings plus the area's Now status and Trust."""
    config = json.loads((SIGNALS / "config.json").read_text(encoding="utf-8"))
    tile_boxes = [
        (entry["id"], entry["south"], entry["north"], entry["west"], entry["east"], entry["label"])
        for entry in config["enabledTiles"]
    ]
    by_iso: dict[str, dict] = {}
    for country in country_records():
        iso = country["code"]
        items = [item for item in places["byId"].values() if item["country"] == iso]
        if not items:
            continue
        outlines = []
        for level in ("ADM1", "ADM2"):
            for area_id, geometry in load_geometry(iso, level):
                item = places["byId"].get(area_id)
                if item is None or item["level"] != level:
                    continue
                rings = _outline(geometry)
                # A boundary smaller than the outline resolution still gets a mark, so it stays on
                # the map as a listed area instead of vanishing from it.
                marker = not rings
                if marker:
                    rings = [_cell_marker(item["centre"])]
                record = {
                    "id": area_id,
                    "name": item["name"],
                    "level": level,
                    "status": _row_status(item["now"]["cells"][0]["status"]) if item["now"]["cells"] else "no-data",
                    "trust": item["trust"]["state"],
                    "centre": item["centre"],
                    "rings": rings,
                }
                if marker:
                    record["marker"] = True
                outlines.append(record)
        if not outlines:
            continue
        # The tile outlines travel with the country so the map can show where coverage ends.
        by_iso[iso] = {
            "schema": "signals-places-map-v1",
            "country": iso,
            "countryName": country["name"],
            "areas": outlines,
            "tiles": [
                {"id": tid, "label": label, "ring": [[w, s], [e, s], [e, n], [w, n], [w, s]]}
                for tid, s, n, w, e, label in tile_boxes
            ],
        }
    out = SIGNALS / "places-map"
    out.mkdir(parents=True, exist_ok=True)
    for path in out.glob("*.json"):
        path.unlink()
    for iso, payload in by_iso.items():
        (out / f"{iso}.json").write_text(json.dumps(payload, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    (out / "index.json").write_text(
        json.dumps(
            {"schema": "signals-places-map-index-v1", "countries": sorted(by_iso), "tiles": [t[0] for t in tile_boxes]},
            separators=(",", ":"),
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    total = sum(len(v["areas"]) for v in by_iso.values())
    print(f"map: {total} boundaries in {len(by_iso)} files -> {out}")


# --- Action: one line, the same for every place -------------------------------------------------

ACTION = {
    "en": "Check the official warning for your area, and know the nearest flood shelter and a raised road out. Rainfall in our data is an input, never a warning.",
    "bn": "আপনার এলাকার সরকারি সতর্কবার্তা দেখুন, এবং নিকটতম বন্যা-আশ্রয়কেন্দ্র ও উঁচু পথ জেনে রাখুন। আমাদের তথ্যের বৃষ্টি একটি উপাদান, সতর্কবার্তা নয়।",
    "source": "Our own guidance. Always follow official warnings.",
}


# --- per-area payload -------------------------------------------------------------------------


def build_areas(config: dict) -> dict:
    """{"items": [...], "byId": {...}} for every area in the three tiles."""
    trends = _trend_files()
    grids = load_grids()
    meta = json.loads((SIGNALS / "meta.json").read_text(encoding="utf-8"))
    tiles = config["enabledTiles"]
    from shapely.geometry import box

    items: dict[str, dict] = {}
    # One Sen-slope mean per boundary, shared by every tile it touches: the historic value cannot
    # depend on which tile the area is assigned to.
    before_cache: dict[str, dict] = {}
    for country in country_records():
        iso = country["code"]
        names = {unit["id"]: unit["name"] for level in LEVELS for unit in country["areas"].get(level, [])}
        # Country outline is the union of its ADM1 (or ADM0) polygons: one read per country.
        outline = None
        for level in ("ADM1", "ADM0"):
            geoms = load_geometry(iso, level)
            if geoms:
                outline = _union([g for _, g in geoms])
                break
        tile = None
        if outline is not None:
            best = 0.0
            for entry in tiles:
                piece = outline.intersection(box(entry["west"], entry["south"], entry["east"], entry["north"]))
                share = piece.area / outline.area if outline.area else 0.0
                if share > best:
                    best, tile = share, entry
            if best <= 0:
                tile = None
        if tile is None:
            continue
        for level in ("ADM1", "ADM2"):
            geoms = load_geometry(iso, level)
            if not geoms:
                continue
            for area_id, geometry in geoms:
                name = names.get(area_id, area_id)
                if str(area_id) not in before_cache:
                    before_cache[str(area_id)] = before_for(geometry, trends)
                before = before_cache[str(area_id)]
                if not any(variable["slopePerDecade"] is not None for variable in before["variables"]):
                    # No pipeline cells inside the boundary (common for a small ADM2): later
                    # levels add no history either, so this area would be an empty page.
                    continue
                trust = trust_for(before)
                now = now_for(geometry, grids.get(tile["id"], []), meta, tile)
                items[area_id] = {
                    "id": area_id,
                    "name": name,
                    "country": iso,
                    "countryName": country["name"],
                    "level": level,
                    "centre": [round(geometry.centroid.y, 2), round(geometry.centroid.x, 2)],
                    "areaKm2": round(geometry.area * 111.32 * 111.32 * math.cos(math.radians(geometry.centroid.y)), 0),
                    "tile": tile["id"],
                    "tileLabel": tile["label"],
                    "before": before,
                    "now": now,
                    "trust": trust,
                    "action": ACTION,
                }
    ordered = sorted(items.values(), key=lambda item: (item["country"], item["level"], item["name"].casefold()))
    return {"items": ordered, "byId": items}


VARIABLE_BN = {
    "temperature": "তাপমাত্রা",
    "rainfall": "বৃষ্টি",
    "heavy-rain": "ভারী বৃষ্টির দিন",
    "dry-spell": "শুষ্ক সময়",
    "wettest-day": "সবচেয়ে ভেজা দিন",
}


def title_for(variable: str, label: str, slope, lower, upper, consistent) -> tuple[str, str]:
    """A short named change, only where the interval leaves zero (the plan's "named change")."""
    en_label = {
        "temperature": "Warming",
        "rainfall": "Rain change",
        "heavy-rain": "Very heavy rain days",
    }.get(variable, label)
    bn_label = VARIABLE_BN.get(variable, label)
    if slope is None or not consistent:
        return (f"{en_label}: no change separated from noise", f"{bn_label}: কোলাহল থেকে আলাদা কোনো পরিবর্তন নেই")
    if slope > 0:
        return (f"{en_label} over this period", f"এই সময়ে {bn_label} বেড়েছে")
    return (f"{en_label} downward over this period", f"এই সময়ে {bn_label} কমেছে")


def _union(geoms):
    out = None
    for g in geoms:
        out = g if out is None else out.union(g)
    return out


def build_place(config: dict) -> None:
    payload = build_areas(config)
    items = payload["items"]
    writer_payload = {
        "schema": "signals-places-v1",
        "generated": dt.date.today().isoformat(),
        "generatedAt": json.loads((SIGNALS / "meta.json").read_text(encoding="utf-8")).get("generatedAt"),
        "sample": bool(json.loads((SIGNALS / "meta.json").read_text(encoding="utf-8")).get("sampleData")),
        "tiles": [t["id"] for t in config["enabledTiles"]],
        "levels": ["ADM1", "ADM2"],
        "note": "Rebuilt offline from the committed grid, trend and boundary files; deterministic, no network.",
        "areas": items,
    }
    target = SIGNALS / "places.json"
    serialised = json.dumps(writer_payload, separators=(",", ":"), ensure_ascii=False, sort_keys=True)
    target.write_text(serialised, encoding="utf-8")
    print(f"places: {len(items)} areas -> {target} ({len(serialised) / 1024:.0f} KB)")


def write_area_index() -> None:
    """One {ISO}.json per country of every listed area, for the search page.

    [id, name, centre lat, centre lon, level]. The centre is the boundary's centroid, never a
    weather value; the search page reads only ids, names and centres from this file.
    """
    out = SIGNALS / "areas"
    out.mkdir(parents=True, exist_ok=True)
    written = 0
    for country in country_records():
        iso = country["code"]
        names = {unit["id"]: unit["name"] for level in LEVELS for unit in country["areas"].get(level, [])}
        levels: dict[str, dict] = {}
        rows = []
        for level in ("ADM1", "ADM2"):
            for area_id, geometry in load_geometry(iso, level):
                if area_id not in names:
                    continue
                rows.append(
                    [
                        area_id,
                        names[area_id],
                        level,
                        round(geometry.centroid.y, 2),
                        round(geometry.centroid.x, 2),
                    ]
                )
        if not rows:
            continue
        for level in ("ADM1", "ADM2"):
            level_rows = [row for row in rows if row[2] == level]
            if level_rows:
                levels[level] = {"name": level, "rows": level_rows}
        (out / f"{iso}.json").write_text(
            json.dumps(
                {
                    "schema": "signals-area-index-v1",
                    "country": iso,
                    "name": country.get("name"),
                    "nameBn": country.get("nameBn"),
                    "levels": levels,
                },
                separators=(",", ":"),
                sort_keys=True,
            ),
            encoding="utf-8",
        )
        written += len(rows)
    print(f"area index: {written} areas -> {out}")


def main(argv: list[str] | None = None) -> int:
    import argparse

    import tiles as tiles_mod

    parser = argparse.ArgumentParser(description="Build the per-place Signals payload.")
    parser.add_argument("--refresh", action="store_true", help="also refresh outlook + evidence from Open-Meteo")
    args = parser.parse_args(argv)
    config = tiles_mod.load_config()
    build_place(config)
    build_map(build_areas(config))
    write_area_index()
    if args.refresh:
        import places_network

        places_network.refresh(config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
