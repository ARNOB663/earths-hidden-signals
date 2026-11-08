"""Climate Twins: places elsewhere on Earth whose 1981-2025 climate trend fingerprint matches each
South Asian hazard region, and the disasters those places have already recorded.

Method (also stated on the site):
1. Global land is split into 5 x 5 degree blocks (about 550 km), roughly the size of our regions.
2. For each block and each South Asian region we build yearly series from the same NASA records
   used everywhere else on the site (GISTEMP v4 temperature, GPCP v2.3 rainfall) and test them
   with the same Hamed-Rao Mann-Kendall test and Sen's slope (stats.trend).
3. A fingerprint has three trend features (warming rate; annual-rain trend; local rainy-season
   trend, both in % per decade) and two climate-context features (how wet; how seasonal), so a
   desert is never matched to a monsoon delta just because both trends are flat.
4. Features are robustly standardised over global land, weighted, and compared by Euclidean
   distance (a nearest-neighbour search). Similarity is reported as a percentile: "closer than
   N% of Earth's land blocks".
5. Disasters per block come from global catalogues: GDACS floods, droughts and tropical cyclones
   (2000-2025) and the NASA Global Landslide Catalog (mostly 2007-2017).

Twins share a trend, not a fate: geography, exposure and reporting differ. The site says so.

    python twins.py            # needs raw/gistemp, raw/gpcp (from build.py), fetches GDACS DR/TC once
"""

from __future__ import annotations

import calendar
import csv
import json
import time
import warnings
from datetime import datetime
from pathlib import Path

import netCDF4
import numpy as np
import requests
from shapely.geometry import box, shape
from shapely.ops import unary_union
from shapely.prepared import prep

from stats import trend

ROOT = Path(__file__).parent
RAW = ROOT / "raw"
OUT = ROOT.parent / "web" / "public" / "data" / "twins"
YEARS = list(range(1981, 2026))
EVENT_YEARS = range(2000, 2026)
GDACS = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
UA = {"User-Agent": "earths-hidden-signals/0.1 (NASA Space Apps research pipeline)"}

BLOCK = 5.0
LAT_RANGE = (-55.0, 75.0)  # skip Antarctica and the high Arctic
MIN_LAND = 0.35
# The South Asia study box: twins must come from somewhere else.
HOME = (5.0, 38.0, 60.0, 100.0)

FEATURES = [
    # key, label, unit, weight
    ("warming", "Warming rate", "°C / decade", 1.0),
    ("rainTrend", "Annual rain trend", "% / decade", 1.0),
    ("wetTrend", "Rainy-season rain trend", "% / decade", 1.5),
    ("wetness", "How wet (annual rain)", "log10 mm", 1.0),
    ("seasonality", "Rain concentrated in rainy season", "share", 0.75),
]
N_TWINS = 5
MIN_SEPARATION = 10.0  # degrees between two twins of the same region, so they are different places


# --- Land mask ------------------------------------------------------------------------------

def land_geometry():
    with open(RAW / "naturalearth" / "ne_110m_land.geojson", encoding="utf-8") as f:
        return prep(unary_union([shape(feat["geometry"]) for feat in json.load(f)["features"]]))


def land_fraction(lats: np.ndarray, lons: np.ndarray, d_lat: float, d_lon: float, land, n: int = 5) -> np.ndarray:
    """Share of each cell on land, from an n x n grid of sample points per cell."""
    from shapely.geometry import Point

    offs = (np.arange(n) + 0.5) / n - 0.5
    frac = np.zeros((lats.size, lons.size))
    for i, la in enumerate(lats):
        for j, lo in enumerate(lons):
            hits = sum(land.contains(Point(lo + dx * d_lon, la + dy * d_lat)) for dy in offs for dx in offs)
            frac[i, j] = hits / (n * n)
    return frac


def cached_land_fraction(tag: str, lats, lons, d_lat, d_lon, land) -> np.ndarray:
    path = RAW / "naturalearth" / f"landfrac_{tag}.npy"
    if path.exists():
        return np.load(path)
    frac = land_fraction(lats, lons, d_lat, d_lon, land)
    np.save(path, frac)
    return frac


# --- Global records -------------------------------------------------------------------------

def to_pm180(lons: np.ndarray, data: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    lons = np.where(lons > 180, lons - 360, lons)
    order = np.argsort(lons)
    return lons[order], data[..., order]


def load_gistemp() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(lats, lons, anomaly[years, 12, lat, lon]) global, deg C vs 1951-1980."""
    with netCDF4.Dataset(RAW / "gistemp" / "gistemp1200.nc") as ds:
        lats, lons = ds["lat"][:].data, ds["lon"][:].data
        dates = netCDF4.num2date(ds["time"][:], ds["time"].units)
        out = np.full((len(YEARS), 12, lats.size, lons.size), np.nan)
        var = ds["tempanomaly"]
        for t, d in enumerate(dates):
            if YEARS[0] <= d.year <= YEARS[-1]:
                out[d.year - YEARS[0], d.month - 1] = np.ma.filled(var[t].astype(float), np.nan)
    lons, out = to_pm180(lons, out)
    return lats, lons, out


def load_gpcp() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(lats, lons, monthly total mm[years, 12, lat, lon]) global."""
    out = lats = lons = None
    for y in YEARS:
        for m in range(1, 13):
            with netCDF4.Dataset(RAW / "gpcp" / f"{y}{m:02d}.nc") as ds:
                if out is None:
                    lats, lons = ds["latitude"][:].data, ds["longitude"][:].data
                    out = np.full((len(YEARS), 12, lats.size, lons.size), np.nan)
                rate = np.ma.filled(ds["precip"][0].astype(float), np.nan)
                out[y - YEARS[0], m - 1] = rate * calendar.monthrange(y, m)[1]
    lons, out = to_pm180(lons, out)
    return lats, lons, out


def box_weights(bbox, lats, lons, d_lat, d_lon, land_frac) -> np.ndarray:
    """Weight of each grid cell in a lat/lon box: overlap share x land share x cos(latitude)."""
    la0, la1, lo0, lo1 = bbox
    ov_lat = np.clip(np.minimum(lats + d_lat / 2, la1) - np.maximum(lats - d_lat / 2, la0), 0, None) / d_lat
    ov_lon = np.clip(np.minimum(lons + d_lon / 2, lo1) - np.maximum(lons - d_lon / 2, lo0), 0, None) / d_lon
    return ov_lat[:, None] * ov_lon[None, :] * land_frac * np.cos(np.deg2rad(lats))[:, None]


def box_series(values: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """values[years, 12, lat, lon] -> weighted mean [years, 12], ignoring missing cells."""
    w = np.where(np.isfinite(values), weights, 0.0)
    total = w.sum(axis=(2, 3))
    s = np.nansum(np.nan_to_num(values) * w, axis=(2, 3))
    return np.where(total > 0, s / np.where(total > 0, total, 1), np.nan)


# --- Fingerprints ---------------------------------------------------------------------------

def wettest_months(climatology: np.ndarray, n: int = 4) -> list[int]:
    """Indices (0-11) of the n consecutive wettest months, wrapping over the new year."""
    sums = [sum(climatology[(s + k) % 12] for k in range(n)) for s in range(12)]
    start = int(np.argmax(sums))
    return [(start + k) % 12 for k in range(n)]


def summary(t, scale: float = 1.0) -> dict | None:
    if t is None:
        return None
    return {
        "perDecade": round(t.slope * 10 * scale, 3),
        "lower": round(t.lower * 10 * scale, 3),
        "upper": round(t.upper * 10 * scale, 3),
        "p": round(float(t.p), 5),
    }


def fingerprint(temp: np.ndarray, rain: np.ndarray) -> dict | None:
    """temp, rain: [years, 12] series for one place. Returns features + their trend tests."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # an all-missing year is rejected just below
        annual_t = np.nanmean(temp, axis=1)
    annual_r = rain.sum(axis=1)
    # Complete years only: trend() refuses gaps, and a filled gap would invent data.
    if not np.isfinite(annual_t).all() or not np.isfinite(annual_r).all() or annual_r.mean() < 50:
        return None
    clim = np.nanmean(rain[:30], axis=0)  # 1981-2010 monthly climatology
    wet = wettest_months(clim)
    wet_r = rain[:, wet].sum(axis=1)
    t_t = trend(annual_t)
    t_r = trend(annual_r)
    t_w = trend(wet_r)
    if t_t is None or t_r is None or t_w is None:
        return None
    r_mean, w_mean = float(annual_r.mean()), float(wet_r.mean())
    return {
        "features": {
            "warming": round(t_t.slope * 10, 3),
            "rainTrend": round(t_r.slope * 10 / r_mean * 100, 2),
            "wetTrend": round(t_w.slope * 10 / w_mean * 100, 2),
            "wetness": round(float(np.log10(r_mean)), 3),
            "seasonality": round(w_mean / r_mean, 3),
        },
        "tests": {
            "warming": summary(t_t),
            "rainTrend": summary(t_r, 100 / r_mean),
            "wetTrend": summary(t_w, 100 / w_mean),
        },
        "meanRainMm": round(r_mean),
        "wetMonths": [m + 1 for m in wet],  # season order, e.g. Dec-Mar
        "series": {
            "temperature": [None if not np.isfinite(v) else round(float(v), 2) for v in annual_t],
            "rain": [round(float(v)) for v in annual_r],
        },
    }


# --- Naming ---------------------------------------------------------------------------------

def load_countries():
    with open(RAW / "naturalearth" / "ne_110m_admin_0_countries.geojson", encoding="utf-8") as f:
        feats = json.load(f)["features"]
    return [(feat["properties"]["ADMIN"], shape(feat["geometry"])) for feat in feats]


def country_lookup() -> dict[str, object]:
    """Lower-cased country names (several spellings) -> geometry, for checking GDACS coordinates."""
    with open(RAW / "naturalearth" / "ne_110m_admin_0_countries.geojson", encoding="utf-8") as f:
        feats = json.load(f)["features"]
    out = {}
    for feat in feats:
        g = shape(feat["geometry"])
        for k in ("ADMIN", "NAME", "NAME_LONG", "FORMAL_EN", "SOVEREIGNT", "NAME_EN", "BRK_NAME"):
            v = feat["properties"].get(k)
            if v:
                out[str(v).strip().lower()] = g
    return out


def compass(lat: float, lon: float, geom) -> str:
    # Use the largest landmass: the USA's full bounds include Alaska, Russia's wrap the dateline.
    if geom.geom_type == "MultiPolygon":
        geom = max(geom.geoms, key=lambda g: g.area)
    x0, y0, x1, y1 = geom.bounds
    if max(x1 - x0, y1 - y0) < 9:  # small country: no direction
        return ""
    fy = (lat - y0) / max(y1 - y0, 1e-6)
    fx = (lon - x0) / max(x1 - x0, 1e-6)
    ns = "north" if fy > 0.66 else "south" if fy < 0.34 else ""
    ew = "east" if fx > 0.66 else "west" if fx < 0.34 else ""
    if ns and ew:
        return f"{ns}-{ew}ern"
    if ns or ew:
        return f"{ns or ew}ern"
    return "central"


def block_name(bbox, countries) -> tuple[str, list[str]]:
    la0, la1, lo0, lo1 = bbox
    cell = box(lo0, la0, lo1, la1)
    shares = sorted(((cell.intersection(g).area, n, g) for n, g in countries if g.intersects(cell)), reverse=True)
    if not shares:
        return f"{(la0 + la1) / 2:.1f}°, {(lo0 + lo1) / 2:.1f}°", []
    main_area, main, geom = shares[0]
    names = [n for a, n, _ in shares if a > 0.1 * cell.area]
    where = compass((la0 + la1) / 2, (lo0 + lo1) / 2, geom)
    label = f"{where.capitalize()} {main}" if where else main
    if len(names) > 1:
        label += f" / {names[1]}"
    return label, names


# --- Disasters ------------------------------------------------------------------------------

def gdacs_year(kind: str, year: int) -> list[dict]:
    folder = RAW / "events" / ("gdacs" if kind == "FL" else f"gdacs_{kind.lower()}")
    cache = folder / f"{year}.json"
    if not cache.exists():
        features, page = [], 1
        while True:
            res = requests.get(
                GDACS,
                params={"eventlist": kind, "fromDate": f"{year}-01-01", "toDate": f"{year}-12-31",
                        "alertlevel": "Green;Orange;Red", "pagesize": 100, "pagenumber": page},
                headers=UA, timeout=120,
            )
            if res.status_code == 204 or not res.content:
                break
            batch = res.json().get("features", [])
            features += batch
            if len(batch) < 100:
                break
            page += 1
            time.sleep(0.5)
        folder.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(features), encoding="utf-8")
        time.sleep(0.3)
    return json.loads(cache.read_text(encoding="utf-8"))


def plausible(lat: float, lon: float, countries: str, lookup: dict) -> bool:
    """False when GDACS names countries and the event point lies far (> 3 degrees) from all of them."""
    from shapely.geometry import Point

    geoms = [lookup[c.strip().lower()] for c in countries.split(",") if c.strip().lower() in lookup]
    if not geoms:
        return True  # unknown spelling: keep rather than guess
    pt = Point(lon, lat)
    return any(g.distance(pt) <= 3.0 for g in geoms)


def global_events() -> list[dict]:
    out, seen = [], set()
    lookup = country_lookup()
    dropped = 0
    for kind, noun in (("FL", "flood"), ("DR", "drought"), ("TC", "cyclone")):
        for year in EVENT_YEARS:
            for feat in gdacs_year(kind, year):
                p = feat["properties"]
                key = (kind, p.get("eventid"))
                if key in seen:  # one event, many episodes: count it once
                    continue
                seen.add(key)
                lon, lat = feat["geometry"]["coordinates"][:2]
                if not plausible(float(lat), float(lon), p.get("country") or "", lookup):
                    dropped += 1
                    continue
                out.append({
                    "type": noun,
                    "date": (p.get("fromdate") or "")[:10],
                    "lat": float(lat), "lon": float(lon),
                    "alert": (p.get("alertlevel") or "").strip().title(),
                    "title": (p.get("name") or noun.title())[:100],
                })
    print(f"  dropped {dropped} GDACS events whose point is far from the countries they name")
    with open(RAW / "events" / "glc.csv", encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            if not row["latitude"] or not row["event_date"]:
                continue
            try:
                when = datetime.strptime(row["event_date"][:10], "%m/%d/%Y")
            except ValueError:
                continue
            deaths = int(float(row["fatality_count"])) if row["fatality_count"] else 0
            out.append({
                "type": "landslide",
                "date": when.date().isoformat(),
                "lat": float(row["latitude"]), "lon": float(row["longitude"]),
                "alert": "Red" if deaths >= 10 else "Orange" if deaths >= 1 else "Green",
                "deaths": deaths,
                "title": " ".join(row["event_title"].split())[:100] or "Landslide",
            })
    return out


SEVERITY = {"Red": 2, "Orange": 1, "Green": 0}


def events_in(bbox, events: list[dict]) -> dict:
    la0, la1, lo0, lo1 = bbox
    inside = [e for e in events if la0 <= e["lat"] < la1 and lo0 <= e["lon"] < lo1]
    counts = {}
    for kind in ("flood", "drought", "cyclone", "landslide"):
        of = [e for e in inside if e["type"] == kind]
        counts[kind] = {"all": len(of), "severe": sum(1 for e in of if e["alert"] in ("Orange", "Red"))}
    notable = sorted(
        (e for e in inside if e["alert"] in ("Orange", "Red")),
        key=lambda e: (SEVERITY[e["alert"]], e.get("deaths", 0), e["date"]),
        reverse=True,
    )[:6]
    return {
        "counts": counts,
        "notable": [{k: e[k] for k in ("type", "date", "alert", "title")} | ({"deaths": e["deaths"]} if e.get("deaths") else {}) for e in notable],
    }


# --- Main -----------------------------------------------------------------------------------

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    land = land_geometry()
    print("Loading GISTEMP and GPCP (global)")
    t_lats, t_lons, temp = load_gistemp()
    r_lats, r_lons, rain = load_gpcp()
    print("Land fractions")
    t_land = cached_land_fraction("gistemp2", t_lats, t_lons, 2.0, 2.0, land)
    r_land = cached_land_fraction("gpcp25", r_lats, r_lons, 2.5, 2.5, land)

    def place(bbox):
        wt = box_weights(bbox, t_lats, t_lons, 2.0, 2.0, t_land)
        wr = box_weights(bbox, r_lats, r_lons, 2.5, 2.5, r_land)
        if wt.sum() == 0 or wr.sum() == 0:
            return None
        return fingerprint(box_series(temp, wt), box_series(rain, wr))

    countries = load_countries()
    print("Fetching / reading disaster catalogues")
    events = global_events()
    print(f"  {len(events)} events")

    # Blocks.
    blocks = []
    for la0 in np.arange(LAT_RANGE[0], LAT_RANGE[1], BLOCK):
        for lo0 in np.arange(-180.0, 180.0, BLOCK):
            bbox = (float(la0), float(la0 + BLOCK), float(lo0), float(lo0 + BLOCK))
            lf = r_land[np.ix_((r_lats >= la0) & (r_lats < la0 + BLOCK), (r_lons >= lo0) & (r_lons < lo0 + BLOCK))]
            if lf.size == 0 or lf.mean() < MIN_LAND:
                continue
            fp = place(bbox)
            if fp is None:
                continue
            name, names = block_name(bbox, countries)
            home = bool(la0 + BLOCK > HOME[0] and la0 < HOME[1] and lo0 + BLOCK > HOME[2] and lo0 < HOME[3])
            blocks.append({"id": f"b{int(la0):+03d}{int(lo0):+04d}", "bbox": bbox, "name": name, "countries": names,
                           "home": home, **fp, **events_in(bbox, events)})
    print(f"  {len(blocks)} land blocks with complete records")

    # Robust standardisation over global land blocks.
    keys = [k for k, *_ in FEATURES]
    weights = np.array([w for *_, w in FEATURES])
    X = np.array([[b["features"][k] for k in keys] for b in blocks], dtype=float)
    med = np.median(X, axis=0)
    scale = np.percentile(X, 75, axis=0) - np.percentile(X, 25, axis=0)
    scale = np.where(scale > 0, scale / 1.349, 1.0)  # IQR -> sd-equivalent
    Z = np.clip((X - med) / scale, -4, 4) * weights

    zones = json.loads((ROOT / "zones.json").read_text(encoding="utf-8"))["zones"]
    regions = []
    for z in zones:
        if z["id"] == "study-area":
            continue
        la0, la1, lo0, lo1 = z["bbox"]
        fp = place((la0, la1, lo0, lo1))
        if fp is None:
            print(f"  skip {z['id']}: no fingerprint")
            continue
        zv = np.clip((np.array([fp["features"][k] for k in keys]) - med) / scale, -4, 4) * weights
        dist = np.sqrt(((Z - zv) ** 2).sum(axis=1))
        # Percentile: share of all land blocks that are further away than this block.
        rank = dist.argsort().argsort()
        pct = 100.0 * (1 - rank / (len(blocks) - 1))
        twins = []
        for idx in np.argsort(dist):
            b = blocks[idx]
            if b["home"]:
                continue
            c = ((b["bbox"][0] + b["bbox"][1]) / 2, (b["bbox"][2] + b["bbox"][3]) / 2)
            if any(abs(c[0] - t[1][0]) < MIN_SEPARATION and abs(c[1] - t[1][1]) < MIN_SEPARATION for t in twins):
                continue
            # Per-feature contribution, so the site can say what matches and what differs.
            contrib = {k: round(float(abs(Z[idx, n] - zv[n])), 2) for n, k in enumerate(keys)}
            twins.append((b["id"], c, round(float(dist[idx]), 3), round(float(pct[idx]), 1), contrib, int(rank[idx]) + 1))
            if len(twins) == N_TWINS:
                break
        regions.append({
            "id": z["id"], "name": z["name"], "hazard": z.get("hazard"), "bbox": z["bbox"],
            **fp, **events_in((la0, la1, lo0, lo1), events),
            "twins": [{"id": i, "distance": d, "percentile": p, "rank": rk, "gap": g} for i, _, d, p, g, rk in twins],
            "similarity": [round(float(v)) for v in pct],
        })
        print(f"  {z['id']}: " + ", ".join(f"{next(b['name'] for b in blocks if b['id'] == i)} ({p}%)" for i, _, _, p, _, _ in twins[:3]))

    payload = {
        "generated": datetime.now().date().isoformat(),
        "years": [YEARS[0], YEARS[-1]],
        "eventYears": [EVENT_YEARS[0], EVENT_YEARS[-1]],
        "block": BLOCK,
        "features": [{"key": k, "label": l, "unit": u, "weight": w} for k, l, u, w in FEATURES],
        "method": {
            "test": "Hamed-Rao modified Mann-Kendall, Sen's slope (same as the trend pages)",
            "match": "Weighted Euclidean distance on robustly standardised features (nearest-neighbour search over global land blocks)",
            "data": "NASA GISTEMP v4, GPCP v2.3; disasters: GDACS (floods, droughts, tropical cyclones 2000-2025), NASA Global Landslide Catalog",
        },
        "blocks": [
            {k: b[k] for k in ("id", "bbox", "name", "countries", "home", "features", "tests", "meanRainMm", "wetMonths", "counts", "notable")}
            for b in blocks
        ],
        "regions": [{k: v for k, v in r.items() if k != "series"} for r in regions],
    }
    (OUT / "twins.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    # Series only for regions and their twins (for the comparison charts), in a second file.
    wanted = {t["id"] for r in regions for t in r["twins"]}
    series = {r["id"]: r["series"] for r in regions} | {b["id"]: b["series"] for b in blocks if b["id"] in wanted}
    (OUT / "series.json").write_text(json.dumps(series, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT / 'twins.json'} ({(OUT / 'twins.json').stat().st_size // 1024} KB) and series.json")


if __name__ == "__main__":
    main()
