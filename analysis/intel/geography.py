"""The location graph: countries, research regions, the study area and cities.

Every location states what area its numbers describe. Cities never get a grid value of their
own: they borrow the containing research region, else the containing country polygon, else the
whole study area, and say so (fallback chain region -> country -> study area).
"""

from __future__ import annotations

import math

import numpy as np
from shapely.geometry import Point, box, shape

from .names import bangla, cities

STUDY_ID = "study-area"
KM_PER_DEG = 111.2

# National agencies whose forecasts and warnings come first. GDACS is added for every location.
AGENCIES = {
    "BGD": [
        {"name": "Bangladesh Meteorological Department", "nameBn": "বাংলাদেশ আবহাওয়া অধিদপ্তর", "url": "https://bmd.gov.bd/"},
        {"name": "Flood Forecasting and Warning Centre", "nameBn": "বন্যা পূর্বাভাস ও সতর্কীকরণ কেন্দ্র", "url": "https://www.ffwc.gov.bd/"},
        {"name": "Department of Disaster Management", "nameBn": "দুর্যোগ ব্যবস্থাপনা অধিদপ্তর", "url": "https://ddm.gov.bd/"},
    ],
    "IND": [
        {"name": "India Meteorological Department", "nameBn": "ভারতীয় আবহাওয়া দপ্তর", "url": "https://mausam.imd.gov.in/"},
        {"name": "National Disaster Management Authority (India)", "nameBn": "জাতীয় দুর্যোগ ব্যবস্থাপনা কর্তৃপক্ষ (ভারত)", "url": "https://ndma.gov.in/"},
    ],
    "PAK": [
        {"name": "Pakistan Meteorological Department", "nameBn": "পাকিস্তান আবহাওয়া বিভাগ", "url": "https://www.pmd.gov.pk/"},
        {"name": "National Disaster Management Authority (Pakistan)", "nameBn": "জাতীয় দুর্যোগ ব্যবস্থাপনা কর্তৃপক্ষ (পাকিস্তান)", "url": "https://www.ndma.gov.pk/"},
    ],
    "NPL": [{"name": "Department of Hydrology and Meteorology, Nepal", "nameBn": "জলবিদ্যা ও আবহাওয়া বিভাগ, নেপাল", "url": "https://www.dhm.gov.np/"}],
    "BTN": [{"name": "National Center for Hydrology and Meteorology, Bhutan", "nameBn": "জাতীয় জলবিদ্যা ও আবহাওয়া কেন্দ্র, ভুটান", "url": "https://www.nchm.gov.bt/"}],
    "LKA": [
        {"name": "Department of Meteorology, Sri Lanka", "nameBn": "আবহাওয়া বিভাগ, শ্রীলঙ্কা", "url": "https://www.meteo.gov.lk/"},
        {"name": "Disaster Management Centre, Sri Lanka", "nameBn": "দুর্যোগ ব্যবস্থাপনা কেন্দ্র, শ্রীলঙ্কা", "url": "https://www.dmc.gov.lk/"},
    ],
}
GDACS = {"name": "GDACS (UN/EU Global Disaster Alert and Coordination System)", "nameBn": "GDACS (জাতিসংঘ/ইইউ বৈশ্বিক দুর্যোগ সতর্কতা ব্যবস্থা)", "url": "https://www.gdacs.org/"}
COUNTRY_CODES = {"Bangladesh": "BGD", "India": "IND", "Pakistan": "PAK", "Nepal": "NPL", "Bhutan": "BTN", "Sri Lanka": "LKA"}
COUNTRY_SLUGS = {"BGD": "bangladesh", "BTN": "bhutan", "IND": "india", "NPL": "nepal", "PAK": "pakistan", "LKA": "sri-lanka"}


def bbox_geom(b) -> object:
    la0, la1, lo0, lo1 = b
    return box(lo0, la0, lo1, la1)


def resolution(d_lat: float, d_lon: float, lat: float) -> dict:
    return {
        "latDeg": d_lat,
        "lonDeg": d_lon,
        "approxKmNS": round(d_lat * KM_PER_DEG),
        "approxKmEW": round(d_lon * KM_PER_DEG * math.cos(math.radians(lat))),
        "note": "grid average, not a point measurement",
    }


def _agencies(codes: list[str]) -> list[dict]:
    out = [a for c in codes for a in AGENCIES.get(c, [])]
    return [*out, GDACS]


def _exposure(geom, hazard_zones: list[dict], is_point: bool) -> list[dict]:
    """Hazard regions this geometry overlaps (>= 10% of either area), or contains (points)."""
    out = []
    for z in hazard_zones:
        hz = bbox_geom(z["bbox"])
        if is_point:
            if hz.covers(geom):
                out.append({"hazard": z["hazard"], "regionId": z["id"], "sharePct": None})
            continue
        inter = geom.intersection(hz).area
        if inter <= 0:
            continue
        share_loc = inter / geom.area
        share_zone = inter / hz.area
        if share_loc >= 0.10 or share_zone >= 0.10:
            out.append({"hazard": z["hazard"], "regionId": z["id"], "sharePct": round(share_loc * 100, 1)})
    return out


def build(place_signals: dict, trend_zones: list[dict], hazard_zones: list[dict]) -> list[dict]:
    """All locations, primary geographies first. Raises on duplicate ids."""
    bn = bangla()
    zone_meta = {z["id"]: z for z in trend_zones}
    locations: list[dict] = []
    country_geoms: dict[str, object] = {}

    for p in place_signals["places"]:
        if p["type"] == "country":
            code = p["countryCode"]
            geom = shape(p["geometry"])
            country_geoms[code] = geom
            c = geom.centroid
            locations.append({
                "id": COUNTRY_SLUGS[code], "kind": "country", "name": p["name"], "nameBn": bn["countries"].get(p["name"], p["name"]),
                "countryCodes": [code], "sourceId": COUNTRY_SLUGS[code], "placeSignalsId": p["id"],
                "center": [round(c.y, 3), round(c.x, 3)], "bounds": p["bounds"], "_geom": geom,
                "fallback": False,
            })
    for p in place_signals["places"]:
        if p["type"] != "region":
            continue
        z = zone_meta[p["id"]]
        geom = bbox_geom(z["bbox"])
        codes = [code for code, g in country_geoms.items() if g.intersects(geom) and g.intersection(geom).area > 0.01]
        c = geom.centroid
        is_study = p["id"] == STUDY_ID
        locations.append({
            "id": p["id"], "kind": "study-area" if is_study else "region",
            "name": "South Asia study area" if is_study else z["name"],
            "nameBn": "দক্ষিণ এশিয়া গবেষণা এলাকা" if is_study else bn["zones"].get(p["id"], z["name"]),
            "countryCodes": sorted(codes), "sourceId": p["id"], "placeSignalsId": p["id"], "bbox": z["bbox"],
            "center": [round(c.y, 3), round(c.x, 3)], "bounds": p["bounds"], "_geom": geom, "fallback": False,
        })

    regions = [loc for loc in locations if loc["kind"] == "region"]
    countries = {loc["countryCodes"][0]: loc for loc in locations if loc["kind"] == "country"}
    for city in cities():
        pt = Point(city["lon"], city["lat"])
        containing = sorted((r for r in regions if r["_geom"].covers(pt)), key=lambda r: r["_geom"].area)
        code = COUNTRY_CODES.get(city["country"])
        in_country = code if code and country_geoms.get(code) is not None and country_geoms[code].buffer(0.05).covers(pt) else None
        if containing:
            source, reason = containing[0], "region"
        elif in_country:
            source, reason = countries[in_country], "country"
        else:
            source, reason = next(loc for loc in locations if loc["id"] == STUDY_ID), "study-area"
        locations.append({
            "id": city["id"], "kind": "city", "name": city["name"], "nameBn": bn["places"].get(city["id"], city["name"]),
            "country": city["country"], "countryBn": bn["countries"].get(city["country"], city["country"]),
            "countryCodes": [code] if code else [], "sourceId": source["id"], "sourceKind": reason,
            "point": [city["lat"], city["lon"]], "center": [city["lat"], city["lon"]], "_geom": pt, "fallback": True,
        })

    ids = [loc["id"] for loc in locations]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        raise ValueError(f"duplicate location ids: {dupes}")

    for loc in locations:
        loc["exposure"] = _exposure(loc["_geom"], hazard_zones, loc["kind"] == "city")
        loc["officialSources"] = _agencies(loc["countryCodes"])
    return locations


def present_cells(series: list) -> np.ndarray:
    return np.array([s is not None for s in series])


def cell_centres(grid: dict) -> tuple[np.ndarray, np.ndarray]:
    lats = grid["lat0"] + np.arange(grid["nLat"]) * grid["dLat"]
    lons = grid["lon0"] + np.arange(grid["nLon"]) * grid["dLon"]
    return lats, lons


def box_weights(bbox, grid: dict) -> np.ndarray:
    """Share of each cell inside the box x cos(latitude), flattened row-major (as in build.zone_weights,
    without the land share, which is not in the committed record; land is applied by the cell mask)."""
    la0, la1, lo0, lo1 = bbox
    lats, lons = cell_centres(grid)
    d_lat, d_lon = grid["dLat"], grid["dLon"]
    ov_lat = np.clip(np.minimum(lats + d_lat / 2, la1) - np.maximum(lats - d_lat / 2, la0), 0, None) / d_lat
    ov_lon = np.clip(np.minimum(lons + d_lon / 2, lo1) - np.maximum(lons - d_lon / 2, lo0), 0, None) / d_lon
    return (ov_lat[:, None] * ov_lon[None, :] * np.cos(np.deg2rad(lats))[:, None]).ravel()


def polygon_weights(geom, grid: dict) -> np.ndarray:
    """Polygon area in each cell x cos(latitude), flattened (as build_country_signals.cell_weights)."""
    lats, lons = cell_centres(grid)
    w = np.zeros(lats.size * lons.size)
    for i, la in enumerate(lats):
        for j, lo in enumerate(lons):
            cell = box(lo - grid["dLon"] / 2, la - grid["dLat"] / 2, lo + grid["dLon"] / 2, la + grid["dLat"] / 2)
            if geom.intersects(cell):
                w[i * lons.size + j] = geom.intersection(cell).area * math.cos(math.radians(la))
    return w


def coverage(weights: np.ndarray, series: list, year_index: int) -> dict:
    """Weighted share of the location's land cells with a value in that year, and cells used.

    `weights` covers every cell; land cells are those with a published series. A location's
    indicator is computed only when coveragePct >= MIN_COVERAGE_PCT.
    """
    land = present_cells(series)
    w = np.where(land, weights, 0.0)
    total = float(w.sum())
    if total <= 0:
        return {"cellsUsed": 0, "coveragePct": 0.0, "weightSum": 0.0}
    has = np.array([s is not None and year_index < len(s) and s[year_index] is not None for s in series])
    used = w * has
    return {"cellsUsed": int((used > 0).sum()), "coveragePct": round(float(used.sum() / total * 100), 1), "weightSum": 1.0}


def public(loc: dict) -> dict:
    return {k: v for k, v in loc.items() if not k.startswith("_")}
