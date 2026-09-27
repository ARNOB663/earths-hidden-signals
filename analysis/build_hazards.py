"""Link past hazard events to the climate drivers, region by region.

Run after build.py:  python build_hazards.py
Writes JSON to ../web/public/data/hazards/.

For each hazard region we report:
  1. the event record (per year, per month),
  2. whether event counts are trending (fires only; the other records are too short),
  3. whether high-event years coincide with unusual heat or rain. We use a Spearman
     correlation after removing each series' long-term trend, so two things that simply both
     rise over time don't look related,
  4. how the latest year's conditions compare with those seen in past high-event years.
     This is shown only where step 3 found a real link. It is evidence for preparedness, not a forecast.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy.stats import spearmanr

import events
from stats import trend

ROOT = Path(__file__).parent
TRENDS = ROOT.parent / "web" / "public" / "data" / "trends"
OUT = ROOT.parent / "web" / "public" / "data" / "hazards"
ALPHA = 0.05

# Which climate drivers matter for each hazard, and the direction that raises the risk.
DRIVERS = {
    "wildfire": [
        {"key": "temperature_pre-monsoon", "label": "Pre-monsoon temperature", "risk": "higher"},
        {"key": "rainfall_pre-monsoon", "label": "Pre-monsoon rainfall", "risk": "lower"},
    ],
    "landslide": [{"key": "rainfall_monsoon", "label": "Monsoon rainfall", "risk": "higher"}],
    "flood": [{"key": "rainfall_monsoon", "label": "Monsoon rainfall", "risk": "higher"}],
}
EVENT_SEASON = {"wildfire": [3, 4, 5], "landslide": [6, 7, 8, 9], "flood": [6, 7, 8, 9, 10]}


def in_bbox(lat: float, lon: float, bbox, pad: float = 0.0) -> bool:
    la0, la1, lo0, lo1 = bbox
    return la0 - pad <= lat <= la1 + pad and lo0 - pad <= lon <= lo1 + pad


def detrend(y: np.ndarray) -> np.ndarray:
    t = trend(y)
    if t is None:
        return y - y.mean()
    x = np.arange(y.size)
    return y - (np.median(y - t.slope * x) + t.slope * x)


def percentile_of(value: float, record: np.ndarray) -> float:
    return float((record < value).mean() * 100)


def relationship(counts: np.ndarray, driver: np.ndarray) -> dict | None:
    if counts.size < 8 or np.ptp(counts) == 0:
        return None
    rho, p = spearmanr(detrend(counts.astype(float)), detrend(driver))
    return {"rho": round(float(rho), 3), "p": round(float(p), 4), "n": int(counts.size)}


def analyse_zone(zone, hazard, years_all, counts_by_year, event_years, zone_results) -> dict:
    counts = np.array([counts_by_year.get(y, 0) for y in event_years], dtype=float)
    idx = [years_all.index(y) for y in event_years]
    high = counts >= np.percentile(counts, 75) if counts.size else np.array([], dtype=bool)

    drivers = []
    for d in DRIVERS[hazard]:
        series = np.array(zone_results[d["key"]]["series"], dtype=float)
        rel = relationship(counts, series[idx])
        linked = (
            rel is not None
            and rel["p"] < ALPHA
            and (rel["rho"] > 0) == (d["risk"] == "higher")
        )
        # Where does each year sit within this region's own 1981-2025 record?
        pct = np.array([percentile_of(v, series) for v in series])
        typical_high = float(pct[idx][high].mean()) if high.any() else None
        drivers.append(
            {
                **d,
                "relationship": rel,
                "linked": bool(linked),
                "trend": zone_results[d["key"]]["trend"],
                "latest": {"year": years_all[-1], "value": float(series[-1]), "percentile": round(pct[-1])},
                "highEventYearsPercentile": None if typical_high is None else round(typical_high),
            }
        )

    event_trend = None
    if hazard == "wildfire" and counts.size >= 10:
        t = trend(counts)
        if t is not None:
            event_trend = {
                "slopePerDecade": round(t.slope * 10, 1),
                "lowerPerDecade": round(t.lower * 10, 1),
                "upperPerDecade": round(t.upper * 10, 1),
                "p": round(t.p, 4),
                "mean": round(float(counts.mean()), 1),
            }

    return {
        "years": event_years,
        "counts": [int(c) for c in counts],
        "highEventYears": [y for y, h in zip(event_years, high) if h],
        "eventTrend": event_trend,
        "drivers": drivers,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    zones = json.loads((TRENDS / "zones.json").read_text(encoding="utf-8"))["zones"]
    years_all = json.loads((TRENDS / "manifest.json").read_text(encoding="utf-8"))["years"]
    hazard_zones = [z for z in zones if z["hazard"]]

    print("Fires")
    fire_year = defaultdict(lambda: defaultdict(int))  # zone -> year -> Mar-May count
    fire_month = defaultdict(lambda: [0] * 12)  # zone -> month totals
    fire_grid = defaultdict(int)  # 0.5 deg cell -> Mar-May count, all years
    for year, month, lat, lon in events.fires():
        if month in EVENT_SEASON["wildfire"]:
            fire_grid[(round(lat * 2) / 2, round(lon * 2) / 2)] += 1
        for z in hazard_zones:
            if in_bbox(lat, lon, z["bbox"]):
                fire_month[z["id"]][month - 1] += 1
                if month in EVENT_SEASON["wildfire"]:
                    fire_year[z["id"]][year] += 1

    print("Landslides")
    slides = events.landslides()
    print("Floods")
    floods = events.floods(range(2000, years_all[-1] + 1))
    flood_years = sorted({int(e["date"][:4]) for e in floods})

    results = []
    for z in hazard_zones:
        hz = z["hazard"]
        if hz == "wildfire":
            counts, years, monthly = fire_year[z["id"]], events.FIRE_YEARS, fire_month[z["id"]]
            source = "NASA FIRMS MODIS (Terra + Aqua) vegetation fires, Mar–May"
        elif hz == "landslide":
            inside = [e for e in slides if in_bbox(e["lat"], e["lon"], z["bbox"])]
            counts = defaultdict(int)
            monthly = [0] * 12
            for e in inside:
                m = int(e["date"][5:7])
                monthly[m - 1] += 1
                if m in EVENT_SEASON[hz]:
                    counts[int(e["date"][:4])] += 1
            years = list(range(2007, 2018))
            source = "NASA Global Landslide Catalog (news reports), Jun–Sep"
        else:
            # GDACS places a flood at a single point, so allow a 1 deg margin around the region.
            inside = [e for e in floods if in_bbox(e["lat"], e["lon"], z["bbox"], pad=1.0)]
            counts = defaultdict(int)
            monthly = [0] * 12
            for e in inside:
                m = int(e["date"][5:7])
                monthly[m - 1] += 1
                counts[int(e["date"][:4])] += 1
            years = list(range(flood_years[0], years_all[-1] + 1)) if flood_years else []
            source = "GDACS flood alerts (UN/EU), all months"

        analysis = analyse_zone(z, hz, years_all, counts, years, z["results"])
        results.append(
            {
                "id": z["id"],
                "name": z["name"],
                "hazard": hz,
                "bbox": z["bbox"],
                "description": z["description"],
                "eventSource": source,
                "monthly": monthly,
                **analysis,
            }
        )
        print(f"  {z['id']}: {sum(analysis['counts'])} events")

    (OUT / "zones.json").write_text(json.dumps({"zones": results}, ensure_ascii=False), encoding="utf-8")
    (OUT / "landslides.json").write_text(json.dumps(slides, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "floods.json").write_text(json.dumps(floods, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_years = len(events.FIRE_YEARS)
    (OUT / "fires_grid.json").write_text(
        json.dumps(
            {
                "cell": 0.5,
                "years": [events.FIRE_YEARS[0], events.FIRE_YEARS[-1]],
                "note": "Average number of Mar-May MODIS fire detections per year in each 0.5 deg cell",
                "cells": [[la, lo, round(c / n_years, 1)] for (la, lo), c in sorted(fire_grid.items())],
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
