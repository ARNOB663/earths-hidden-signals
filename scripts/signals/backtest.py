"""Historical frequency and the rainfall-screen backtest (offline, byte-stable).

Two questions answered from committed files only -- no network, no random numbers:

1. **Historical frequency** (``/signal``). For an administrative area and an annual rainfall
   level, how often were floods catalogued in the years whose annual rain was at least that high?
   It is a *frequency in the historical record*, never a forecast probability. The interval is a
   Wilson score interval; when the case count is below ``minIntervalCases`` the interval is still
   shown but labelled as too small to stand on its own.

2. **The screen backtest** (``/replay``, ``/accuracy``). The rain screen -- "was this season in the
   wettest fifth of its own earlier record?" -- is replayed year by year against the GDACS flood
   catalogue. The year being tested is never part of the rainfall baseline it is compared with,
   so no future value enters a past assessment.

Inputs (all committed):

* ``web/public/data/hazards/floods.json`` -- GDACS flood alerts inside the study area.
* ``web/public/data/trends/manifest.json`` + ``<variable>_<season>_series.json`` -- the analysis
  pipeline's own annual and seasonal series on its cells.
* ``web/public/data/signals/places/{id}.json`` -- Open-Meteo historical rain archive (a different,
  reanalysis-based product) plus the GDACS records near that area, written by ``place.py --refresh``.
* ``web/public/data/signals/config.json`` -- the frequency and backtest rules.

Outputs:

* ``web/public/data/signals/frequency/{id}.json`` -- one file per area with a historical case set.
* ``web/public/data/signals/backtest.json`` -- rules, replay rows, 2x2 counts, metrics with
  intervals and lift, reliability, per-episode outcomes and lead times.
* ``web/public/data/signals/accuracy.json`` -- a summary of ``backtest.json`` (one source of truth).

Run from ``analysis/.venv``:  python backtest.py
"""

from __future__ import annotations

import datetime as dt
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WEB = ROOT / "web" / "public" / "data"
SIGNALS = WEB / "signals"
TRENDS = WEB / "trends"
FLOODS = WEB / "hazards" / "floods.json"

# Rules. Mirrored into config.json so the website never restates one by hand.
FREQUENCY = {
    "minIntervalCases": 10,
    "minPanelYears": 10,
    "radiusKm": 150,
    "rule": (
        "A case is a complete year in the rain archive for which the catalogue was also queried. "
        "A flood case is a year in which the GDACS catalogue records at least one flood alert within "
        "150 km of the area centre. Frequency: flood cases among the cases whose annual rain is at "
        "least the selected level."
    ),
}
BACKTEST = {
    "years": [2000, 2025],
    "episodeRadiusKm": 150,
    "episodeGapDays": 10,
    "baselineMinValues": 8,
    "percentile": 80,
    "scoringDays": 30,
    "rule": (
        "Screens are split into a pre-monsoon (January-June) and a monsoon (July-December) calendar; "
        "an episode belongs to the calendar of its start month. A calendar is flagged in a year when "
        "its rainfall is at or above the 80th percentile of that calendar's rainfall in every earlier "
        "year with a value (at least 8 earlier years). Rainfall is the analysis pipeline's own gridded "
        "series, averaged over the tile's cells; the pre-monsoon values are the pipeline's Jan-May "
        "totals because no June-only series exists."
    ),
}
SECTIONS = ("pre-monsoon", "monsoon")
SCREEN_RAIN = {"pre-monsoon": ("rainfall", "pre-monsoon"), "monsoon": ("rainfall", "monsoon")}


def load_config() -> dict:
    return json.loads((SIGNALS / "config.json").read_text(encoding="utf-8"))


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def wilson(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval: the standard interval for a proportion from a small sample."""
    if total <= 0:
        raise ValueError("wilson needs at least one case")
    p = successes / total
    denom = 1 + z * z / total
    centre = (p + z * z / (2 * total)) / denom
    half = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denom
    return max(0.0, centre - half), min(1.0, centre + half)


def proportion(part: int, whole: int) -> dict:
    """A proportion with its sample size and interval; null, never zero, without a sample."""
    if whole == 0:
        return {"value": None, "n": 0, "low": None, "high": None}
    low, high = wilson(part, whole)
    return {"value": round(part / whole, 4), "n": whole, "low": round(low, 4), "high": round(high, 4)}


# --- historical frequency -------------------------------------------------------------------


def flood_years_near(years: list[int], events: list[dict], lat: float, lon: float, radius_km: float) -> list[int]:
    out = []
    for year in years:
        if any(
            ev["start"][:4] == str(year) and haversine_km(lat, lon, ev["lat"], ev["lon"]) <= radius_km
            for ev in events
        ):
            out.append(year)
    return out


def level_cuts(levels: list[dict], min_cases: int) -> list[dict]:
    """The levels the reader can pick: levels with at least min_cases cases, always the highest.

    An equal-width grid over the observed range, so each row is different by a visible amount
    rather than one millimetre at a time. The highest level is always offered, and every cut keeps
    its own case count and interval.
    """
    if not levels:
        return []
    top = levels[0]
    eligible = [level for level in levels if level["cases"] >= min_cases]
    chosen = {eligible[0]["mm"] if eligible else top["mm"], top["mm"]}
    lo, hi = top["mm"], levels[-1]["mm"]
    width = max(1.0, round((hi - lo) / 56.0))
    for step in range(1, 56):
        target = lo + step * width
        rows = [level for level in levels if level["mm"] >= target]
        if rows and rows[0]["cases"] >= min_cases:
            chosen.add(rows[0]["mm"])
    return [
        {
            "mm": level["mm"],
            "cases": level["cases"],
            "floods": level["floods"],
            "low": level["low"],
            "high": level["high"],
        }
        for level in levels
        if level["mm"] in chosen
    ]


def _header(area: dict) -> dict:
    return {
        "schema": "signals-area-frequency-v1",
        "id": area["id"],
        "name": area["name"],
        "centre": area["centre"],
    }


def _reason(state: str, reason: str, min_years: int = FREQUENCY["minPanelYears"]) -> dict:
    return {"state": state, "reason": reason, "minYears": min_years}


def level_payload(area: dict, extras: dict | None, catalogue: dict | None = None) -> dict:
    """The per-area file read by /signal: its flood--rain case set, or why it is absent.

    ``catalogue`` is the shared global record; it is carried so the page can show other catalogued
    floods in the neighbourhood even when this area's own paragraphs have no events.
    """
    header = _header(area)
    if not extras:
        return {**header, **_reason("unavailable", "No historical rain archive has been fetched for this area.")}
    evidence = extras.get("evidence") or {}
    rows = sorted(
        (row for row in evidence.get("years", []) if row.get("mm") is not None),
        key=lambda row: int(row["year"]),
    )
    if not rows:
        return {**header, **_reason("unavailable", "The historical rain archive has no complete year for this area.")}
    years = [int(row["year"]) for row in rows]
    lat, lon = area["centre"]
    radius = FREQUENCY["radiusKm"]
    events = evidence.get("floodEvents", []) or []
    if catalogue:
        # The shared catalogue covers the study area, so a place can be compared with the floods
        # that reached it even where the per-place paragraphs were empty.
        events = [{**e, "start": e["start"][:10], "lat": e["lat"], "lon": e["lon"]} for e in catalogue.get("events", [])]
    wet_years = flood_years_near(years, events, lat, lon, radius)
    cases = []
    for row in rows:
        year = int(row["year"])
        near = sorted(
            (
                {"id": ev.get("id"), "start": ev.get("start"), "km": round(haversine_km(lat, lon, ev["lat"], ev["lon"]), 1)}
                for ev in events
                if ev["start"][:4] == str(year)
            ),
            key=lambda ev: (ev["km"], ev["start"]),
        )
        cases.append(
            {
                "year": year,
                "mm": row["mm"],
                "flood": year in wet_years,
                "near": near[:3],
                "nearCount": sum(1 for ev in near if ev["km"] <= radius),
            }
        )
    levels = []
    for case in sorted(cases, key=lambda c: -c["mm"]):
        if levels and levels[-1]["mm"] == case["mm"]:
            continue
        at_least = [c for c in cases if c["mm"] >= case["mm"]]
        floods = sum(1 for c in at_least if c["flood"])
        low, high = wilson(floods, len(at_least))
        levels.append(
            {
                "mm": case["mm"],
                "year": case["year"],
                "flood": case["flood"],
                "cases": len(at_least),
                "floods": floods,
                "low": round(low, 4),
                "high": round(high, 4),
            }
        )
    payload = {
        **header,
        "minYears": FREQUENCY["minPanelYears"],
        "cases": cases,
        "radiusKm": radius,
        "intervalCases": FREQUENCY["minIntervalCases"],
        "state": "ok" if len(years) >= FREQUENCY["minPanelYears"] else "insufficient",
        "reason": "" if len(years) >= FREQUENCY["minPanelYears"] else f"Only {len(years)} complete years are available; {FREQUENCY['minPanelYears']} are needed.",
        "counts": {"cases": len(cases), "floods": len(wet_years), "catalogued": len(events)},
        "floodsAtLeast": level_cuts(levels, FREQUENCY["minIntervalCases"]),
        "product": evidence.get("product"),
        "note": evidence.get("note"),
        "floodNote": evidence.get("floodNote"),
        "fetchedAt": extras.get("fetchedAt"),
    }
    return payload


def write_case_files(areas_by_country: dict[str, list[dict]], catalogue: dict) -> dict:
    """One case file per (area, level) cut, plus the per-area level file the Signal page reads."""
    out = SIGNALS / "frequency"
    out.mkdir(parents=True, exist_ok=True)
    for path in out.glob("*.json"):
        path.unlink()
    summary = []
    for country, rows in sorted(areas_by_country.items()):
        for row in rows:
            extras_path = SIGNALS / "places" / f"{row['id']}.json"
            extras = json.loads(extras_path.read_text(encoding="utf-8")) if extras_path.exists() else None
            payload = level_payload(row, extras, catalogue)
            (out / f"{row['id']}.json").write_text(
                json.dumps(payload, separators=(",", ":"), ensure_ascii=False, sort_keys=True), encoding="utf-8"
            )
            summary.append({"id": row["id"], "state": payload["state"]})
            if payload["state"] != "ok":
                continue
            for cut in payload["floodsAtLeast"]:
                case_id = f"{row['id']}--{cut['mm']:.0f}"
                brief = {
                    "schema": "signals-frequency-brief-v1",
                    **{k: payload[k] for k in ("id", "name", "centre", "radiusKm", "intervalCases")},
                    "level": cut,
                    "levels": payload["floodsAtLeast"],
                    "cases": [
                        {
                            "year": c["year"],
                            "mm": c["mm"],
                            "flood": c["flood"],
                            "nearStart": c["near"][0]["start"] if c["near"] else None,
                        }
                        for c in payload["cases"]
                    ],
                    "product": payload["product"],
                    "note": payload["note"],
                    "fetchedAt": payload["fetchedAt"],
                }
                (out / f"{case_id}.json").write_text(
                    json.dumps(brief, separators=(",", ":"), ensure_ascii=False, sort_keys=True), encoding="utf-8"
                )
    return {"areas": summary}


# --- the rainfall-screen backtest -----------------------------------------------------------


def tile_episodes(events: list[dict], tiles: list[dict]) -> dict[str, list[dict]]:
    """Flood episodes per tile.

    A catalogue record joins an open episode when it starts no more than ``episodeGapDays`` after
    the episode's first record and lies within ``episodeRadiusKm`` of that first record. The rule
    is one-directional so the result cannot depend on the order the records arrive in.
    """
    max_gap = dt.timedelta(days=BACKTEST["episodeGapDays"])
    by_tile: dict[str, list[dict]] = {tile["id"]: [] for tile in tiles}
    for event in sorted(events, key=lambda e: (e["date"], e["lat"], e["lon"])):
        for tile in tiles:
            if not (tile["south"] <= event["lat"] < tile["north"] and tile["west"] <= event["lon"] < tile["east"]):
                continue
            episodes = by_tile[tile["id"]]
            placed = False
            for episode in episodes:
                first = dt.date.fromisoformat(episode["start"])
                if dt.date.fromisoformat(event["date"]) - first <= max_gap and haversine_km(
                    event["lat"], event["lon"], episode["lat"], episode["lon"]
                ) <= BACKTEST["episodeRadiusKm"]:
                    placed = True
                    episode["end"] = max(episode["end"], event.get("end") or event["date"])
                    if event.get("alert") == "Red":
                        episode["alert"] = "Red"
                    break
            if not placed:
                episodes.append(
                    {
                        "lat": event["lat"],
                        "lon": event["lon"],
                        "start": event["date"],
                        "end": event.get("end") or event["date"],
                        "alert": event.get("alert"),
                        "events": 1,
                    }
                )
    for tile_id, episodes in by_tile.items():
        episodes.sort(key=lambda e: (e["start"], e["lat"], e["lon"]))
        for index, episode in enumerate(episodes, start=1):
            episode["id"] = f"{tile_id}-{episode['start'][:4]}-{index:03d}"
            episode["section"] = "pre-monsoon" if int(episode["start"][5:7]) <= 6 else "monsoon"
            episode["year"] = int(episode["start"][:4])
    return by_tile


def grid_series(manifest: dict, variable: str, season: str) -> dict:
    """The analysis pipeline's own series on its cells: {grid, years, values: [cell][year]}."""
    cells = json.loads((TRENDS / f"{variable}_{season}_series.json").read_text(encoding="utf-8"))
    return {
        "key": f"{variable}_{season}",
        "label": manifest["variables"][variable]["label"],
        "dataset": manifest["variables"][variable]["dataset"],
        "unit": manifest["variables"][variable]["unit"],
        "grid": manifest["grids"][variable],
        "years": manifest["years"],
        "values": cells,
        "season": season,
    }


def tile_cells(tile: dict, grid: dict) -> list[int]:
    return [
        k
        for k in range(grid["nLat"] * grid["nLon"])
        if tile["south"] <= grid["lat0"] + (k // grid["nLon"]) * grid["dLat"] < tile["north"]
        and tile["west"] <= grid["lon0"] + (k % grid["nLon"]) * grid["dLon"] < tile["east"]
    ]


def cell_centres(cells: list[int], grid: dict) -> list[dict]:
    return [
        {
            "lat": round(grid["lat0"] + (k // grid["nLon"]) * grid["dLat"], 2),
            "lon": round(grid["lon0"] + (k % grid["nLon"]) * grid["dLon"], 2),
        }
        for k in cells
    ]


def tile_mean(source: dict, cells: list[int]) -> list[dict]:
    """cos(latitude)-weighted tile mean per year; a year with any missing cell stays null."""
    import numpy as np

    usable = [k for k in cells if source["values"][k] is not None]
    if not usable:
        return [{"year": year, "value": None} for year in source["years"]]
    matrix = np.array([source["values"][k] for k in usable], dtype=float)
    lats = np.array([source["grid"]["lat0"] + (k // source["grid"]["nLon"]) * source["grid"]["dLat"] for k in usable])
    weights = np.cos(np.deg2rad(lats))
    out = []
    for index, year in enumerate(source["years"]):
        column = matrix[:, index]
        out.append(
            {"year": year, "value": None if np.isnan(column).any() else round(float(np.average(column, weights=weights)), 1)}
        )
    return out


def screen_year(series: list[dict], episode_years: set[int], year: int) -> dict:
    """One tested year. ``state`` says why a year could not be tested instead of guessing."""
    min_values = BACKTEST["baselineMinValues"]
    value = next((row["value"] for row in series if row["year"] == year), None)
    earlier = sorted(row["value"] for row in series if row["year"] < year and row["value"] is not None)
    base = {"year": year, "value": value, "event": year in episode_years}
    if value is None:
        return {**base, "state": "no-value", "reason": "The rainfall series has no value for this year."}
    if len(earlier) < min_values:
        return {
            **base,
            "state": "short-baseline",
            "reason": f"Only {len(earlier)} earlier years with a value; {min_values} are needed.",
            "baselineYears": len(earlier),
        }
    threshold = earlier[math.ceil(BACKTEST["percentile"] / 100 * len(earlier)) - 1]
    return {
        **base,
        "state": "tested",
        "value": value,
        "baselineYears": len(earlier),
        "baselineMedian": earlier[len(earlier) // 2],
        "threshold": round(threshold, 1),
        "flagged": value >= threshold,
    }


def counts(rows: list[dict]) -> dict:
    tested = [r for r in rows if r["state"] == "tested"]
    return {
        "tp": sum(1 for r in tested if r["flagged"] and r["event"]),
        "fp": sum(1 for r in tested if r["flagged"] and not r["event"]),
        "fn": sum(1 for r in tested if not r["flagged"] and r["event"]),
        "tn": sum(1 for r in tested if not r["flagged"] and not r["event"]),
        "tested": len(tested),
    }


def summarise(rows: list[dict]) -> dict:
    c = counts(rows)
    tp, fp, fn, tn = c["tp"], c["fp"], c["fn"], c["tn"]
    n, flags, events = c["tested"], tp + fp, tp + fn
    precision = proportion(tp, flags)
    base = proportion(events, n)
    lift = None
    lift_interval = None
    excludes_one = None
    if precision["value"] is not None and base["value"]:
        lift = round(precision["value"] / base["value"], 3)
        if precision["low"] is not None and base["high"] is not None and tp:
            low = round(precision["low"] / base["high"], 3)
            high = round(precision["high"] / base["low"], 3) if base["low"] else None
            lift_interval = {"low": low, "high": high}
            excludes_one = bool(high is not None and (low > 1 or high < 1))
    return {
        **c,
        "flags": flags,
        "eventYears": events,
        "hitRate": proportion(tp, events),
        "falseAlarmRate": proportion(fp, n - events),
        "precision": precision,
        "correctRejectionRate": proportion(tn, n - events),
        "baseRate": base,
        "lift": lift,
        "liftInterval": lift_interval,
        "liftExcludesOne": excludes_one,
    }


def reliability(rows: list[dict]) -> list[dict]:
    """Observed event rate per rain band, each with its own sample size (a calibration table)."""
    tested = [r for r in rows if r["state"] == "tested"]
    bands = [
        ("below the baseline median", lambda r: r["value"] < r["baselineMedian"]),
        ("median to the 80th percentile", lambda r: r["baselineMedian"] <= r["value"] < r["threshold"]),
        ("80th percentile or above (flagged)", lambda r: r["value"] >= r["threshold"]),
    ]
    out = []
    for label, test in bands:
        band = [r for r in tested if test(r)]
        p = proportion(sum(1 for r in band if r["event"]), len(band))
        out.append({"band": label, **p})
    return out


def lead_times(episodes: list[dict], screens: dict[str, list[dict]]) -> dict:
    """Did a signal exist within ``scoringDays`` before each episode began?

    A season's signal is issued at the season's start. A monsoon cannot warn of a December
    episode in the same year; the next pre-monsoon can. This is what the lead is computed from.
    """
    window = BACKTEST["scoringDays"]
    per_episode = []
    for episode in episodes:
        start = dt.date.fromisoformat(episode["start"])
        year, section = episode["year"], episode["section"]
        candidates = [(dt.date(year, 1, 1), "pre-monsoon")]
        if section == "monsoon":
            candidates = [(dt.date(year, 7, 1), "monsoon"), (dt.date(year + 1, 1, 1), "pre-monsoon")]
        first = None
        for issued, name in candidates:
            row = next((r for r in screens[name] if r["year"] == issued.year), None)
            days = (start - issued).days
            if row and row["state"] == "tested" and row["flagged"] and 0 < days <= window:
                first = {"issued": issued.isoformat(), "days": days, "section": name}
                break
        per_episode.append(
            {
                **{k: episode[k] for k in ("id", "lat", "lon", "start", "end", "alert", "events", "section", "year")},
                "hit": bool(first),
                "lead": first,
            }
        )
    cumulative = []
    hits = 0
    for days in range(1, window + 1):
        # A signal at lead d is still a valid lead-d warning for every episode it precedes.
        hits = sum(1 for e in per_episode if e["lead"] and e["lead"]["days"] <= days)
        cumulative.append({"days": days, "hit": hits, "episodes": len(episodes), "detectedShare": round(hits / len(episodes), 4) if episodes else None})
    return {"perEpisode": per_episode, "cumulative": cumulative, "window": window}


def build() -> dict:
    config = load_config()
    tiles = config["enabledTiles"]
    start, end = BACKTEST["years"]
    years = range(start, end + 1)
    manifest = json.loads((TRENDS / "manifest.json").read_text(encoding="utf-8"))
    events = json.loads(FLOODS.read_text(encoding="utf-8"))
    episodes = tile_episodes(events, tiles)
    rain = {section: grid_series(manifest, *SCREEN_RAIN[section]) for section in SECTIONS}

    replay = []
    screens = []
    pooled: list[dict] = []
    for tile in tiles:
        by_section = {}
        episodes_out = []
        for section in SECTIONS:
            source = rain[section]
            cells = tile_cells(tile, source["grid"])
            series = tile_mean(source, cells)
            episode_years = {e["year"] for e in episodes[tile["id"]] if e["section"] == section}
            rows = [screen_year(series, episode_years, year) for year in years]
            pooled.extend(rows)
            by_section[section] = rows
            c = counts(rows)
            screens.append(
                {
                    "id": f"{tile['id']}:{section}",
                    "tile": tile["id"],
                    "tileLabel": tile["label"],
                    "section": section,
                    "counts": c,
                    "reliability": reliability(rows),
                    "details": summarise(rows),
                }
            )
            episodes_out.extend(
                {
                    **{k: e[k] for k in ("id", "lat", "lon", "start", "end", "alert", "events", "section", "year")},
                }
                for e in episodes[tile["id"]]
                if e["section"] == section
            )
        sums = lead_times(episodes[tile["id"]], by_section)
        hit_by_id = {e["id"]: e for e in sums["perEpisode"]}
        replay.append(
            {
                "tile": tile["id"],
                "label": tile["label"],
                "sections": {
                    section: {
                        "covers": "January to June" if section == "pre-monsoon" else "July to December",
                        "source": rain[section]["dataset"],
                        "sourceLabel": f"{rain[section]['label']}, {rain[section]['key'].split('_')[-1]}",
                        "unit": rain[section]["unit"],
                        "series": tile_mean(rain[section], tile_cells(tile, rain[section]["grid"])),
                        "years": by_section[section],
                    }
                    for section in SECTIONS
                },
                "episodes": [{**e, "hit": hit_by_id[e["id"]]["hit"], "lead": hit_by_id[e["id"]]["lead"]} for e in episodes_out],
                "leads": sums["cumulative"],
                "episodeTotal": len(episodes[tile["id"]]),
            }
        )

    # The date scrubber needs the grid the screens were computed on: one cell list per tile.
    geometry = {
        "grid": rain["monsoon"]["grid"],
        "cells": {
            tile["id"]: {"label": tile["label"], "cells": cell_centres(tile_cells(tile, rain["monsoon"]["grid"]), rain["monsoon"]["grid"])}
            for tile in tiles
        },
    }
    payload = {
        "schema": "signals-backtest-v1",
        "generated": dt.date.today().isoformat(),
        "rule": BACKTEST["rule"],
        "window": [start, end],
        "sources": {
            "rain": {
                "monsoon": rain["monsoon"]["dataset"],
                "pre-monsoon": rain["pre-monsoon"]["dataset"],
                "note": "The analysis pipeline's own gridded series, averaged over each tile's cells with cos(latitude) weights.",
            },
            "events": "GDACS flood alerts (UN/EU), every alert level, inside the three tiles.",
            "episodeRule": f"Catalogue records inside a tile that start within {BACKTEST['episodeGapDays']} days of an episode's first record and within {BACKTEST['episodeRadiusKm']} km of it join that episode.",
        },
        "episodeRadiusKm": BACKTEST["episodeRadiusKm"],
        "episodeGapDays": BACKTEST["episodeGapDays"],
        "baselineMinValues": BACKTEST["baselineMinValues"],
        "percentile": BACKTEST["percentile"],
        "scoringDays": BACKTEST["scoringDays"],
        "tiles": [{"id": t["id"], "label": t["label"], "south": t["south"], "north": t["north"], "west": t["west"], "east": t["east"]} for t in tiles],
        "geometry": geometry,
        "screens": screens,
        "replay": replay,
        "metrics": summarise(pooled),
        "reliability": reliability(pooled),
        "totals": {"episodes": sum(len(v) for v in episodes.values())},
    }
    return payload


def accuracy_summary(payload: dict) -> dict:
    """What /accuracy reads: the same numbers as backtest.json, never recomputed."""
    m = payload["metrics"]
    by_section = {}
    for screen in payload["screens"]:
        bucket = by_section.setdefault(screen["section"], {"tp": 0, "fp": 0, "fn": 0, "tn": 0, "tested": 0})
        for key in bucket:
            bucket[key] += screen["counts"][key]
    lift_ok = bool(m["liftExcludesOne"])
    missing: list[str] = []
    if not m["eventYears"]:
        missing.append("No GDACS flood episode falls in a tested year.")
    if not m["tested"]:
        missing.append("No year has enough earlier rainfall to build a baseline.")
    return {
        "schema": "signals-accuracy-v1",
        "generated": payload["generated"],
        "source": "backtest.json",
        "rule": payload["rule"],
        "window": payload["window"],
        "metrics": m,
        "bySection": by_section,
        "reliability": payload["reliability"],
        "totals": {
            "episodes": payload["totals"]["episodes"],
            "tiles": len(payload["tiles"]),
            "testedYears": m["tested"],
            "eventYears": m["eventYears"],
        },
        "outlookEligible": {
            "eligible": False,
            "checks": [
                {"id": "forecast", "pass": False, "text": "No named external 7-day rainfall forecast is wired into a screen."},
                {"id": "sample", "pass": m["sampleSize"] >= 10 if "sampleSize" in m else False, "text": "Historical sample size (events x screens) is too small."},
                {"id": "lift", "pass": lift_ok, "text": f"Backtest lift {m['lift']} {'excludes' if lift_ok else 'does not exclude'} 1." if m["lift"] is not None else "No lift can be computed."},
            ],
            "verdict": "Not enough evidence here.",
        },
        "missing": missing,
    }


def write_frequency(areas_by_country: dict[str, list[dict]]) -> int:
    out = SIGNALS / "frequency"
    out.mkdir(parents=True, exist_ok=True)
    for path in out.glob("*.json"):
        path.unlink()
    written = 0
    for country, rows in sorted(areas_by_country.items()):
        for row in rows:
            extras_path = SIGNALS / "places" / f"{row['id']}.json"
            extras = json.loads(extras_path.read_text(encoding="utf-8")) if extras_path.exists() else None
            payload = frequency_payload(row, extras)
            (out / f"{row['id']}.json").write_text(
                json.dumps(payload, separators=(",", ":"), ensure_ascii=False, sort_keys=True), encoding="utf-8"
            )
            written += 1
    return written


def area_rows_by_country() -> dict[str, list[dict]]:
    """{ISO: [area rows]} from the index place.py writes: [id, name, level, lat, lon]."""
    out: dict[str, list[dict]] = {}
    for path in sorted((SIGNALS / "areas").glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        out[path.stem] = [
            {"id": row[0], "name": row[1], "level": row[2], "centre": [row[3], row[4]], "country": path.stem}
            for level in ("ADM1", "ADM2")
            for row in (payload.get("levels", {}).get(level, {}) or {}).get("rows", [])
        ]
    return out


def event_id(event: dict) -> str:
    """Stable id for one catalogue record: its date, its rounded position and its rank there."""
    return f"gdacs-{event['date']}-{event['lat']:.2f}-{event['lon']:.2f}"


def global_catalogue() -> dict:
    """Every catalogued flood in the study area: the shared record a place compares with.

    The catalogue carries no GDACS event number: the raw GDACS responses are gitignored. The id is
    the record's own date and position, which is enough to find it in the GDACS search.
    """
    events = events_sorted()
    seen: dict[str, int] = {}
    out = []
    for event in events:
        base = event_id(event)
        seen[base] = seen.get(base, 0) + 1
        key = base if seen[base] == 1 else f"{base}-{seen[base]}"
        out.append({"id": key, "start": event["date"], "end": event["end"], "lat": event["lat"], "lon": event["lon"], "alert": event.get("alert")})
    return {
        "schema": "signals-flood-catalogue-v1",
        "source": "GDACS flood alerts (UN/EU), every alert level, inside the study area.",
        "note": "The recording of GDACS flood alerts inside the study area. A missing year is a gap in the catalogue, not a year without floods.",
        "events": out,
    }


def events_sorted() -> list[dict]:
    payload = json.loads(FLOODS.read_text(encoding="utf-8"))
    return sorted(payload, key=lambda e: (e["date"], e["lat"], e["lon"]))


def write_brief(payload: dict) -> None:
    """The compact page brief: rules, tiles, officials and the newest climate snapshot."""
    config = load_config()
    latest = json.loads((WEB / "latest.json").read_text(encoding="utf-8")) if (WEB / "latest.json").exists() else {}
    brief = {
        "schema": "signals-brief-v1",
        "sample": False,
        "official": config["official"],
        "outlook": {
            "days": config["outlook"]["days"],
            "provider": config["outlook"]["provider"],
            "enabled": bool(config["outlook"].get("enabled")),
            "label": config["outlook"]["label"],
        },
        "staleHours": config["staleHours"],
        "episodeRadiusKm": payload["episodeRadiusKm"],
        "intervalCases": FREQUENCY["minIntervalCases"],
        "tiles": [
            {
                **{k: t[k] for k in ("id", "label", "south", "north", "west", "east")},
                "gridDeg": 0.5,
                "rainProduct": "IMERG Late (NASA GPM)",
            }
            for t in config["enabledTiles"]
        ],
        "latest": latest.get("temperature"),
        "latestRain": latest.get("rainfall"),
    }
    (SIGNALS / "brief.json").write_text(json.dumps(brief, indent=1, sort_keys=True), encoding="utf-8")


def main() -> None:
    catalogue = global_catalogue()
    (SIGNALS / "flood-catalogue.json").write_text(json.dumps(catalogue, indent=1, sort_keys=True), encoding="utf-8")
    payload = build()
    (SIGNALS / "backtest.json").write_text(json.dumps(payload, indent=1, sort_keys=True), encoding="utf-8")
    summary = accuracy_summary(payload)
    (SIGNALS / "accuracy.json").write_text(json.dumps(summary, indent=1, sort_keys=True), encoding="utf-8")
    write_brief(payload)
    result = write_case_files(area_rows_by_country(), catalogue)
    good = sum(1 for area in result["areas"] if area["state"] == "ok")
    m = payload["metrics"]
    print(
        f"backtest: {m['tested']} tested years, TP {m['tp']} FP {m['fp']} FN {m['fn']} TN {m['tn']}, "
        f"lift {m['lift']} {m['liftInterval']}; frequency ok for {good} of {len(result['areas'])} areas"
    )


if __name__ == "__main__":
    main()
