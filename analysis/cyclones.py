"""Cyclones in the Bay of Bengal and the Arabian Sea, added as a fourth hazard.

Events: IBTrACS v04r01 North Indian basin (NOAA NCEI; tracks from IMD/JTWC), 1981-2025.
A "cyclone" here reaches at least 34 knots (cyclonic storm); "severe" reaches 64 knots.
Driver: sea-surface warmth of the basin in the two cyclone seasons (Apr-Jun, Oct-Dec), from the
ocean part of NASA GISTEMP (ERSSTv5), tested against yearly cyclone counts the same way as the
other hazards (detrended Spearman).

Run after build_hazards.py:  python cyclones.py
Updates ../web/public/data/hazards/zones.json and writes cyclones.json (tracks).
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

import numpy as np

import events
import sources
from build_hazards import ALPHA, OUT, percentile_of, relationship
from stats import trend

URL = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NI.list.v04r01.csv"
YEARS = list(range(1981, 2026))
SEASON_MONTHS = [4, 5, 6, 10, 11, 12]

BASINS = [
    {
        "id": "bay-of-bengal",
        "code": "BB",
        "name": "Bay of Bengal",
        "bbox": [8, 23, 80, 95],
        "sea": [10, 21, 82, 94],
        "description": "Warm, shallow sea whose cyclones strike Bangladesh, eastern India and Myanmar, often with deadly storm surges.",
    },
    {
        "id": "arabian-sea",
        "code": "AS",
        "name": "Arabian Sea",
        "bbox": [8, 25, 60, 77],
        "sea": [8, 21, 60, 74],
        "description": "Historically quieter sea whose cyclones reach western India, Pakistan and Oman.",
    },
]


def knots(row: dict) -> float | None:
    for col in ("USA_WIND", "WMO_WIND"):
        v = row.get(col, "").strip()
        if v:
            try:
                return float(v)
            except ValueError:
                pass
    return None


def load_storms() -> list[dict]:
    path = events._download(URL, events.RAW / "ibtracs_ni.csv")
    storms: dict[str, dict] = {}
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        next(reader)  # second header row holds units
        for row in reader:
            season = int(row["SEASON"])
            if season < YEARS[0] or season > YEARS[-1]:
                continue
            s = storms.setdefault(
                row["SID"],
                {"name": row["NAME"].title(), "year": season, "points": [], "max": 0.0, "basin": None, "month": None},
            )
            lat, lon = float(row["LAT"]), float(row["LON"])
            s["points"].append([round(lat, 1), round(lon, 1)])
            w = knots(row)
            if w is not None and w >= s["max"]:
                s["max"], s["basin"], s["month"] = w, row["SUBBASIN"].strip(), int(row["ISO_TIME"][5:7])
    return [s for s in storms.values() if s["max"] >= 34 and s["basin"] in ("BB", "AS")]


def sea_warmth() -> dict[str, np.ndarray]:
    """Yearly cyclone-season sea-surface temperature anomaly for each basin (GISTEMP ocean cells)."""
    lats, lons, monthly = sources.load_gistemp(YEARS)
    land = sources.land_fraction(lats, lons, 2.0, 2.0)
    sea = (land < 0.25).astype(float)
    season = np.nanmean(monthly[:, [m - 1 for m in SEASON_MONTHS]], axis=1)
    out = {}
    for b in BASINS:
        la0, la1, lo0, lo1 = b["sea"]
        box = ((lats[:, None] >= la0) & (lats[:, None] <= la1) & (lons[None, :] >= lo0) & (lons[None, :] <= lo1)) * sea
        w = box * np.cos(np.deg2rad(lats))[:, None]
        out[b["id"]] = (np.nan_to_num(season) * w).sum(axis=(1, 2)) / w.sum()
    return out


def main() -> None:
    storms = load_storms()
    warmth = sea_warmth()
    zones_path = OUT / "zones.json"
    data = json.loads(zones_path.read_text(encoding="utf-8"))
    data["zones"] = [z for z in data["zones"] if z["hazard"] != "cyclone"]

    for b in BASINS:
        mine = [s for s in storms if s["basin"] == b["code"]]
        per_year = defaultdict(int)
        monthly = [0] * 12
        for s in mine:
            per_year[s["year"]] += 1
            monthly[s["month"] - 1] += 1
        counts = np.array([per_year[y] for y in YEARS], dtype=float)
        high = counts >= max(1, np.percentile(counts, 75))
        sst = warmth[b["id"]]
        rel = relationship(counts, sst)
        pct = np.array([percentile_of(v, sst) for v in sst])
        t_events = trend(counts)
        t_sst = trend(sst)
        data["zones"].append(
            {
                "id": b["id"],
                "name": b["name"],
                "hazard": "cyclone",
                "bbox": b["bbox"],
                "description": b["description"],
                "eventSource": "IBTrACS v04r01 (NOAA NCEI; IMD and JTWC tracks), storms of 34 knots or more",
                "monthly": monthly,
                "years": YEARS,
                "counts": [int(c) for c in counts],
                "highEventYears": [y for y, h in zip(YEARS, high) if h],
                "eventTrend": None
                if t_events is None
                else {
                    "slopePerDecade": round(t_events.slope * 10, 2),
                    "lowerPerDecade": round(t_events.lower * 10, 2),
                    "upperPerDecade": round(t_events.upper * 10, 2),
                    "p": round(t_events.p, 4),
                    "mean": round(float(counts.mean()), 2),
                },
                "severe": sum(1 for s in mine if s["max"] >= 64),
                "drivers": [
                    {
                        "key": f"sea_{b['id']}",
                        "label": "Sea-surface warmth in the cyclone seasons",
                        "risk": "higher",
                        "unit": "°C",
                        "decimals": 2,
                        "relationship": rel,
                        "linked": bool(rel is not None and rel["p"] < ALPHA and rel["rho"] > 0),
                        "trend": None
                        if t_sst is None
                        else {
                            "slopePerDecade": round(t_sst.slope * 10, 3),
                            "lowerPerDecade": round(t_sst.lower * 10, 3),
                            "upperPerDecade": round(t_sst.upper * 10, 3),
                            "p": round(t_sst.p, 5),
                        },
                        "latest": {"year": YEARS[-1], "value": float(sst[-1]), "percentile": round(pct[-1])},
                        "highEventYearsPercentile": round(float(pct[high].mean())) if high.any() else None,
                    }
                ],
            }
        )
        print(
            f"{b['name']}: {len(mine)} cyclones, {sum(1 for s in mine if s['max'] >= 64)} severe;"
            f" trend {None if t_events is None else round(t_events.slope * 10, 2)}/decade"
            f" (p={None if t_events is None else round(t_events.p, 3)}); sea link {rel}"
        )

    zones_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tracks = [
        {
            "name": s["name"] if s["name"] not in ("Not_Named", "Unnamed") else "",
            "year": s["year"],
            "basin": s["basin"],
            "maxWind": s["max"],
            "points": s["points"][::2] + ([s["points"][-1]] if len(s["points"]) % 2 == 0 else []),
        }
        for s in storms
    ]
    (OUT / "cyclones.json").write_text(json.dumps(tracks, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(tracks)} tracks")


if __name__ == "__main__":
    main()
