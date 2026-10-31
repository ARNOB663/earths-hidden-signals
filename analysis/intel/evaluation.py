"""Evaluation and backtesting (evaluation-v1). Six metrics, each a number or null with a reason.

No leakage: every replayed assessment for year Y uses only baseline years before Y and the value
of Y itself (engine.classify_year). Event records are the ground truth.
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np

from . import confidence as conf
from .anomalies import classify
from .engine import PERIODS, VARIABLES, GeoSeries, screen
from .periods import baseline_years
from .thresholds import EVALUATION_ID, MIN_BASELINE_VALUES

EVENT_DEFINITION = ("An 'event year' is a year in the top quarter of the region's own event record "
                    "(highEventYears in hazards/zones.json): GDACS floods, NASA Global Landslide Catalog, "
                    "FIRMS MODIS fire detections or IBTrACS cyclones.")


def full_record_class(g: GeoSeries, var: str, period: str, year: int) -> dict:
    """Class of `year` against the complete baseline (which may include `year` and later years)."""
    s = g.series.get(f"{var}_{period}")
    idx = {y: i for i, y in enumerate(s["years"])}
    base = [s["series"][idx[y]] for y in baseline_years(VARIABLES[var]["daily"]) if y in idx and s["series"][idx[y]] is not None]
    v = s["series"][idx[year]] if year in idx else None
    return classify(None if v is None else float(v), np.array(base, dtype=float))


def anomaly_accuracy(geos: list[GeoSeries]) -> tuple[dict, dict]:
    """Real-time class vs full-record class for cutoff years where the two baselines differ."""
    per_class = defaultdict(lambda: [0, 0])
    per_year = defaultdict(lambda: [0, 0])
    by_grade = defaultdict(lambda: [0, 0])
    for g in geos:
        for var, periods in PERIODS.items():
            for period in periods:
                if not g.has(var, period):
                    continue
                for y in g.years(var, period):
                    if y > baseline_years(VARIABLES[var]["daily"])[-1]:
                        continue  # from 2021 the real-time baseline is the full normal: agreement by construction
                    rt = g.get(var, period, y)
                    if not rt.get("available"):
                        continue
                    full = full_record_class(g, var, period, y)
                    hit = int(rt["class"] == full["class"] and rt["direction"] == full["direction"]) if full["level"] else int(rt["class"] == full["class"])
                    per_class[full["class"] if full["level"] == 0 else f"{full['class']}:{full['direction']}"][0] += hit
                    per_class[full["class"] if full["level"] == 0 else f"{full['class']}:{full['direction']}"][1] += 1
                    per_year[y][0] += hit
                    per_year[y][1] += 1
                    grade = conf.anomaly(result=rt)["grade"]
                    by_grade[grade][0] += hit
                    by_grade[grade][1] += 1
    total_hit = sum(v[0] for v in per_year.values())
    total = sum(v[1] for v in per_year.values())
    accuracy = {
        "value": None if not total else round(total_hit / total * 100, 1),
        "unit": "% agreement",
        "n": total,
        "window": [min(per_year), max(per_year)] if per_year else None,
        "definition": ("For each cutoff year Y, the class computed with only baseline years before Y is compared with the class "
                       "from the complete 1991–2020 (daily: 1997–2020) baseline. Years from 2021 are excluded because both "
                       f"baselines are then identical. Years before the baseline reached {MIN_BASELINE_VALUES} values are not computable."),
        "byClass": {k: {"agree": v[0], "n": v[1], "pct": round(v[0] / v[1] * 100, 1)} for k, v in sorted(per_class.items())},
        "byYear": {str(k): {"agree": v[0], "n": v[1]} for k, v in sorted(per_year.items())},
    }
    calibration = {
        "definition": "Share of real-time anomaly assessments, per anomaly-confidence grade, whose class matched the full-record class.",
        "byGrade": {k: {"agree": v[0], "n": v[1], "pct": round(v[0] / v[1] * 100, 1)} for k, v in sorted(by_grade.items())},
        "value": None if not by_grade else {k: round(v[0] / v[1] * 100, 1) for k, v in sorted(by_grade.items())},
        "monotonic": None,
    }
    order = [g for g in ("high", "moderate", "low") if g in by_grade]
    if len(order) >= 2:
        vals = [by_grade[g][0] / by_grade[g][1] for g in order]
        calibration["monotonic"] = all(a >= b for a, b in zip(vals, vals[1:]))
    return accuracy, calibration


def cyclone_backtest(z: dict) -> dict:
    """Flag year Y when that year's basin sea warmth, ranked among years up to Y only, reaches the
    percentile typical of past high-cyclone years. The link requirement is not applied (it is
    estimated from the full record)."""
    driver = z["drivers"][0] if z["drivers"] else {}
    series = driver.get("series")
    typical = driver.get("highEventYearsPercentile")
    if not series or typical is None:
        return {"available": False,
                "reason": "The basin sea-warmth series is not in the committed record (only its latest value); cyclones.py publishes it from the next run with network access."}
    vals = dict(zip(series["years"], series["values"]))
    events = set(z["highEventYears"])
    hits = misses = false_alarms = quiet = 0
    years = []
    for y in z["years"]:
        past = [vals[x] for x in vals if x < y]
        if y not in vals or len(past) < 20:
            continue
        years.append(y)
        pct = float((np.array(past) < vals[y]).mean() * 100)
        flagged, event = pct >= typical, y in events
        hits += flagged and event
        misses += (not flagged) and event
        false_alarms += flagged and not event
        quiet += (not flagged) and not event
    return {"available": bool(years), "window": [years[0], years[-1]] if years else None, "years": len(years),
            "hits": hits, "misses": misses, "falseAlarms": false_alarms, "correctNegatives": quiet,
            "falseAlarmRate": None if not hits + false_alarms else round(false_alarms / (hits + false_alarms), 3),
            "falseAlarmRateReason": None if hits + false_alarms else "No year in the window was flagged.",
            "missedEventRate": None if not hits + misses else round(misses / (hits + misses), 3),
            "missedEventRateReason": None if hits + misses else "No event year in the window.",
            "linkRequirementApplied": False}


def hazard_backtest(geo_by_id: dict[str, GeoSeries], hazard_zones: list[dict]) -> dict:
    out = {}
    for z in hazard_zones:
        hazard = z["hazard"]
        g = geo_by_id.get(z["id"])
        entry = {"regionId": z["id"], "hazard": hazard, "eventSource": z.get("eventSource")}
        if hazard == "cyclone":
            out[z["id"]] = {**entry, **cyclone_backtest(z)}
            continue
        if g is None:
            out[z["id"]] = {**entry, "available": False, "reason": "No climate series for this region."}
            continue
        events = set(z["highEventYears"])
        exposure = [{"hazard": hazard, "regionId": z["id"]}]
        hz_map = {z["id"]: z}
        hits = misses = false_alarms = quiet = 0
        years = []
        for y in z["years"]:
            if hazard == "wildfire":
                r = screen(g, hazard, y, exposure=exposure, hazard_zones=hz_map, latest_seasons=[(y, "pre-monsoon")], linked_override=None)
                driver = g.get("rainfall", "pre-monsoon", y)
            else:
                r = screen(g, hazard, y, exposure=exposure, hazard_zones=hz_map, latest_seasons=[(y, "monsoon")])
                driver = g.get("rainfall", "monsoon", y)
            if not driver.get("available"):
                continue  # real-time baseline not yet long enough
            years.append(y)
            flagged = r["severity"] in ("watch", "warning")
            event = y in events
            hits += flagged and event
            misses += (not flagged) and event
            false_alarms += flagged and not event
            quiet += (not flagged) and not event
        flagged_n = hits + false_alarms
        event_n = hits + misses
        out[z["id"]] = {
            **entry,
            "available": bool(years),
            "window": [years[0], years[-1]] if years else None,
            "years": len(years),
            "hits": hits, "misses": misses, "falseAlarms": false_alarms, "correctNegatives": quiet,
            "falseAlarmRate": None if not flagged_n else round(false_alarms / flagged_n, 3),
            "falseAlarmRateReason": None if flagged_n else "No year in the window was flagged (watch or warning).",
            "missedEventRate": None if not event_n else round(misses / event_n, 3),
            "missedEventRateReason": None if event_n else "No event year in the window.",
            "linkRequirementApplied": False if hazard == "wildfire" else None,
        }
    return out


def geographic_coverage(cell_series: dict[str, list], manifest: dict) -> dict:
    """% of study-area land cells with >= MIN_BASELINE_VALUES baseline values and a value in the latest year."""
    out = {}
    for key, series in cell_series.items():
        var = key.split("_")[0]
        years = manifest["variables"][var]["years"]
        base = [years.index(y) for y in baseline_years(VARIABLES[var]["daily"]) if y in years]
        land = [s for s in series if s is not None]
        ok = sum(1 for s in land if sum(s[i] is not None for i in base) >= MIN_BASELINE_VALUES and s[-1] is not None)
        out[key] = {"landCells": len(land), "usableCells": ok, "pct": round(ok / len(land) * 100, 1) if land else None}
    return out


def run(geos: list[GeoSeries], hazard_zones: list[dict], cell_series: dict, manifest: dict) -> dict:
    accuracy, calibration = anomaly_accuracy(geos)
    backtest = hazard_backtest({g.id: g for g in geos}, hazard_zones)
    usable = [b for b in backtest.values() if b.get("available")]

    def pooled(num_key, den_keys):
        num = sum(b[num_key] for b in usable)
        den = sum(sum(b[k] for k in den_keys) for b in usable)
        return None if not den else round(num / den, 3)

    by_hazard = defaultdict(list)
    for b in usable:
        by_hazard[b["hazard"]].append(b)
    false_alarm = {h: (None if not sum(b["hits"] + b["falseAlarms"] for b in bs) else
                       round(sum(b["falseAlarms"] for b in bs) / sum(b["hits"] + b["falseAlarms"] for b in bs), 3))
                   for h, bs in sorted(by_hazard.items())}
    return {
        "schema": EVALUATION_ID,
        "eventDefinition": EVENT_DEFINITION,
        "metrics": {
            "anomalyDetectionAccuracy": accuracy,
            "falseAlarmRate": {
                "value": pooled("falseAlarms", ["hits", "falseAlarms"]),
                "byHazard": false_alarm,
                "definition": "Flagged (watch or warning) seasons that were not event years, as a share of all flagged seasons, pooled over hazard regions. Same-season matching replaces the 30-day window because the inputs are seasonal.",
                "reason": None if usable else "No hazard region could be backtested.",
            },
            "missedEvents": {
                "value": pooled("misses", ["hits", "misses"]),
                "definition": "Event years with no watch or warning in the same season, as a share of all event years, pooled over hazard regions.",
                "reason": None if usable else "No hazard region could be backtested.",
            },
            "leadTime": {
                "value": None,
                "reason": "Not computable: seasonal screening is only possible after the season has ended and been published, so it cannot precede an event inside that season. Lead time needs daily or monthly inputs (intelligence.py --refresh).",
            },
            "confidenceCalibration": calibration,
            "geographicCoverage": {
                "value": geographic_coverage(cell_series, manifest),
                "definition": f"Share of study-area land cells with at least {MIN_BASELINE_VALUES} baseline values and a value in the latest year, per variable and season.",
            },
        },
        "backtest": backtest,
        "limitations": [
            "Event records are uneven: news-based landslide reports under-count remote areas, GDACS coverage improved over time, and MODIS overpass times drifted after about 2020.",
            "The wildfire backtest does not require a linked driver, because the link itself is estimated from the full record.",
            "Hazard regions are approximate boxes; countries and cities are not backtested separately.",
        ],
    }


def regressions(current: dict, baseline: dict, tolerance: float) -> list[str]:
    """False-alarm rates that rose more than `tolerance` above the committed baseline."""
    problems = []
    cur = current["metrics"]["falseAlarmRate"]
    base = baseline.get("falseAlarmRate", {})
    pairs = [("pooled", cur["value"], base.get("value"))] + [
        (h, v, base.get("byHazard", {}).get(h)) for h, v in cur["byHazard"].items()
    ]
    for name, now, then in pairs:
        if now is not None and then is not None and now > then + tolerance:
            problems.append(f"false-alarm rate ({name}) rose from {then} to {now}")
    return problems
