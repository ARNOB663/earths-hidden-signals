"""Climate hazard intelligence: conclusions, alerts, confidence and history for every location.

Run after build.py, build_hazards.py, cyclones.py, crosscheck.py and latest.py:

    python intelligence.py                 # offline, from the committed outputs
    python intelligence.py --as-of 2026-10-31
    python intelligence.py --reproduce     # re-run with the committed asOf (CI determinism check)
    python intelligence.py --refresh       # also download monthly GISTEMP/GPCP series (needs network)

Writes web/public/data/intelligence/: sources.json, current.json, locations.json, index.json,
history.json, alerts.json, thresholds.json. Then run evaluate.py.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import date
from pathlib import Path

from intel import confidence as conf
from intel import geography, inputs, thresholds, validation
from intel.alerts import lifecycle, official_alerts
from intel.alerts import heat as heat_rule
from intel.conclude import build as build_conclusion
from intel.conclude import missing_fields
from intel.engine import (DATASETS, PERIODS, SCREEN_LEVEL, VARIABLES, GeoSeries, applicable_hazards,
                          composite_record, freshness, indicator_record, screen)
from intel.periods import period_end
from intel.thresholds import EXPECTED_LAG_DAYS, LEVELS, THRESHOLDS_ID

OUT = inputs.OUT
LOGS = Path(__file__).parent / "logs"
HISTORY_RUNS = 24
HISTORY_PERIODS = 36

DATASET_VERSIONS = [
    {"datasetId": "gistemp", "name": "NASA GISTEMP", "version": "v4", "use": "temperature anomalies, very hot months, basin sea warmth"},
    {"datasetId": "gpcp-monthly", "name": "GPCP monthly precipitation", "version": "v2.3", "use": "rainfall totals"},
    {"datasetId": "gpcp-daily", "name": "GPCP 1DD daily precipitation", "version": "v1.3", "use": "heavy-rain days, dry spells, wettest day"},
    {"datasetId": "cru-ts", "name": "CRU TS", "version": "4.10", "use": "trend cross-check (same input family)"},
    {"datasetId": "firms-modis", "name": "NASA FIRMS MODIS active fires", "version": "C6.1", "use": "wildfire event record"},
    {"datasetId": "nasa-glc", "name": "NASA Global Landslide Catalog", "version": "2007–2017 export", "use": "landslide event record"},
    {"datasetId": "gdacs", "name": "GDACS event API", "version": "flood events", "use": "official flood alerts"},
    {"datasetId": "ibtracs", "name": "IBTrACS North Indian basin", "version": "v04r01", "use": "cyclone event record"},
]


def write(name: str, data, compact: bool = True) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":") if compact else None, indent=None if compact else 1, allow_nan=False)
    path.write_text(text + "\n", encoding="utf-8")
    return path


def latest_year(geo: GeoSeries) -> int:
    return max(geo.years("temperature", "annual"))


def resolution_labels(lat: float) -> tuple[str, str, dict]:
    res = {k: geography.resolution(*DATASETS[d]["grid"], lat) for k, d in (("temperature", "gistemp"), ("rainfall", "gpcp-monthly"), ("daily", "gpcp-daily"))}
    en = f"{res['temperature']['latDeg']:g}–{res['rainfall']['latDeg']:g}° grid, about {res['temperature']['approxKmNS']}–{res['rainfall']['approxKmNS']} km"
    bn = f"{res['temperature']['latDeg']:g}–{res['rainfall']['latDeg']:g}° গ্রিড, প্রায় {res['temperature']['approxKmNS']}–{res['rainfall']['approxKmNS']} কিমি"
    from intel.periods import bn_num
    return en, bn_num(bn), res


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", help="assessment date (YYYY-MM-DD); default today")
    ap.add_argument("--reproduce", action="store_true", help="use the asOf stored in the committed current.json")
    ap.add_argument("--refresh", action="store_true", help="download monthly series first (needs network)")
    args = ap.parse_args()
    t0 = time.time()
    log = {"steps": [], "degraded": []}

    if args.refresh:
        import monthly  # noqa: PLC0415  (network path, imported only when asked)
        try:
            monthly.main()
        except Exception as exc:  # degrade, never invent: keep going with the committed record
            log["degraded"].append(f"refresh failed: {exc}")
            print(f"refresh failed, continuing offline: {exc}")

    if args.reproduce:
        as_of = date.fromisoformat(json.loads((OUT / "current.json").read_text(encoding="utf-8"))["asOf"])
    else:
        as_of = date.fromisoformat(args.as_of) if args.as_of else date.today()

    data = inputs.load()
    manifest, ps = data["manifest"], data["placeSignals"]
    hazard_zones = data["hazardZones"]["zones"]
    hz_by_id = {z["id"]: z for z in hazard_zones}
    retrieved = manifest["generated"]
    code = inputs.code_hash()
    run_id = inputs.short_hash({"inputs": data["inputsHash"], "asOf": as_of.isoformat(), "thresholds": THRESHOLDS_ID, "code": code})
    log["steps"].append({"step": "load", "seconds": round(time.time() - t0, 2), "inputs": data["hashes"]})

    # --- Locations and series -----------------------------------------------------------
    locations = geography.build(ps, data["trendZones"]["zones"], hazard_zones)
    by_id = {loc["id"]: loc for loc in locations}
    primary = [loc for loc in locations if loc["kind"] != "city"]
    ps_by_id = {p["id"]: p for p in ps["places"]}
    geos: dict[str, GeoSeries] = {}
    for loc in primary:
        sig = ps_by_id[loc["placeSignalsId"]]["signals"]
        geos[loc["id"]] = GeoSeries(loc["id"], {k: {"years": v["years"], "series": v["series"]} for k, v in sig.items() if v})

    monthly = (data["monthly"] or {}).get("geographies", {})
    for gid, extra in monthly.items():
        if gid in geos:
            geos[gid].series.update({k: {"years": v["years"], "series": v["series"]} for k, v in extra.items()})

    # --- Indicators, composites ---------------------------------------------------------
    indicators: dict[str, dict[str, dict]] = {}
    composites: dict[str, dict[str, dict]] = {}
    for loc in primary:
        g = geos[loc["id"]]
        year = latest_year(g)
        sig = ps_by_id[loc["placeSignalsId"]]["signals"]
        recs = {}
        for var, periods in PERIODS.items():
            grid = manifest["grids"][VARIABLES[var]["grid"]]
            weights = (geography.polygon_weights(loc["_geom"], grid) if loc["kind"] == "country"
                       else geography.box_weights(loc["bbox"], grid))
            for period in periods:
                key = f"{var}_{period}"
                if not g.has(var, period):
                    continue
                cells = data["cells"][key]
                years = manifest["variables"][var]["years"]
                y = max(g.years(var, period))
                cov = geography.coverage(weights, cells, years.index(y))
                s = sig[key]
                src = [{"file": "maps/place-signals.json", "place": loc["placeSignalsId"], "key": key,
                        "sha256": data["hashes"]["maps/place-signals.json"]},
                       {"file": f"trends/{key}_series.json", "sha256": data["hashes"][f"trends/{key}_series.json"],
                        "cellsHash": inputs.short_hash(s.get("cellIndices")) if s.get("cellIndices") else None,
                        "weightsHash": inputs.short_hash(s.get("weights")) if s.get("weights") else None}]
                recs[key] = indicator_record(g, var, period, y, as_of=as_of, retrieved=retrieved, cov=cov, inputs=src)
        for key, mser in sorted(monthly.get(loc["id"], {}).items()):
            var, month = key.split("_")
            if not mser["years"]:
                continue
            y = mser["years"][-1]
            cov = {"cellsUsed": None, "coveragePct": mser["coveragePct"][-1], "weightSum": 1.0}
            src = [{"file": "intelligence/inputs/monthly.json", "geography": loc["id"], "key": key,
                    "sha256": data["hashes"]["intelligence/inputs/monthly.json"]}]
            recs[key] = indicator_record(g, var, month, y, as_of=as_of, retrieved=data["monthly"]["generated"], cov=cov, inputs=src)
        indicators[loc["id"]] = recs
        ids = {k: r["id"] for k, r in recs.items()}
        composites[loc["id"]] = {p: composite_record(g, p, year, ids) for p in ("annual", "pre-monsoon", "monsoon")}

    # --- Validation verdicts per geography -------------------------------------------------
    cross = data["crosscheck"]["zones"]

    def verdicts_for(geo_id: str) -> list[dict]:
        c = cross.get(geo_id) if by_id[geo_id]["kind"] != "country" else None
        out = []
        for var, unit in (("temperature", "°C"), ("rainfall", "mm")):
            entry = (c or {}).get(f"{var}_annual") or {}
            out.append(validation.trend_consistency(var, entry.get("ours"), entry.get("cru"), unit))
        out.append(validation.rainfall_provenance())
        out.append(validation.rainfall_direction())
        return out

    # --- Per-location assessment ----------------------------------------------------------
    assessments = {}
    for loc in locations:
        src_id = loc["sourceId"]
        g = geos[src_id]
        year = latest_year(g)
        seasons = [(year - 1, "pre-monsoon"), (year - 1, "monsoon"), (year, "pre-monsoon"), (year, "monsoon")]
        hazards = []
        for hz in applicable_hazards(loc["exposure"]):
            s = screen(g, hz, year, exposure=loc["exposure"], hazard_zones=hz_by_id, latest_seasons=seasons)
            hconf = conf.hazard(applicable=True, linked_driver=s["linked"], has_record=s["hasRecord"])
            regions = sorted({e["regionId"] for e in loc["exposure"] if e["hazard"] == hz})
            ev = s["evidence"][0] if s["evidence"] else None
            if s["severity"]:
                why_en = f"Based on {ev['variable']} in {s['year']} ({s['period']}): {ev['class']}, P≈{ev['percentile']:.0f}." if ev and ev.get("percentile") is not None else "Based on the latest driver value."
            elif s.get("note") == "no-linked-driver":
                why_en = "No statistically supported link between the driver and past events, so no flag is raised."
            else:
                why_en = "Screening rule not met in the latest assessed season."
            from intel.periods import bn_num
            if s["severity"]:
                why_bn = (f"{bn_num(s['year'])} সালের তথ্যের ভিত্তিতে, P≈{bn_num(round(ev['percentile']))}।" if ev and ev.get("percentile") is not None else "চালকের সর্বশেষ মানের ভিত্তিতে।")
            elif s.get("note") == "no-linked-driver":
                why_bn = "চালক ও অতীতের ঘটনার মধ্যে পরিসংখ্যানগত সম্পর্ক নেই, তাই কোনো সংকেত দেওয়া হয়নি।"
            else:
                why_bn = "সর্বশেষ মূল্যায়িত মৌসুমে স্ক্রিনিং নিয়ম পূরণ হয়নি।"
            hazards.append({
                "hazard": hz, "severity": s["severity"], "level": SCREEN_LEVEL[s["severity"]], "period": s["period"], "year": s["year"],
                "evidence": s["evidence"], "evidenceIds": [f"{src_id}/{e['variable']}/{e['period']}" for e in s["evidence"] if e["variable"] in VARIABLES],
                "linkedDriver": s["linked"], "hasRecord": s["hasRecord"], "regions": regions, "confidence": hconf,
                "whyEn": why_en, "whyBn": why_bn, "note": s.get("note"),
                "disclaimerEn": "A screening indicator derived from observations; it is not a forecast, a probability, or an official warning.",
                "disclaimerBn": "পর্যবেক্ষণ থেকে তৈরি একটি স্ক্রিনিং সূচক; এটি পূর্বাভাস, সম্ভাবনা বা আনুষ্ঠানিক সতর্কতা নয়।",
            })

        ind = indicators[src_id]
        comp = composites[src_id]
        obs = min((ind[k]["confidence"]["observation"] for k in ("temperature_annual", "rainfall_annual") if k in ind),
                  key=lambda c: conf.GRADES.index(c["grade"]))
        an = conf.anomaly(result={**ind["temperature_annual"], "available": ind["temperature_annual"]["available"],
                                  "boundaryMarginSteps": ind["temperature_annual"].get("boundaryMarginSteps", 0),
                                  "n": ind["temperature_annual"].get("baseline", {}).get("n", 0)},
                          conflicting=comp["annual"].get("conflicting", False))
        top = sorted(hazards, key=lambda h: -LEVELS.index(h["level"]))[0]
        verdicts = verdicts_for(src_id)
        val = conf.validation(validation.counted(verdicts))
        if loc["kind"] == "city":
            obs = conf.cap(obs, 1, "fallback-geography", f"Estimated from {by_id[src_id]['name']}, not measured at {loc['name']}.",
                           f"{by_id[src_id]['nameBn']} থেকে অনুমান, {loc['nameBn']}-এ পরিমাপ নয়।")
        confidences = {"observation": obs, "anomaly": an, "hazard": top["confidence"], "validation": val}

        lat = loc["center"][0]
        res_en, res_bn, res = resolution_labels(lat)
        src = by_id[src_id]
        cov_t = ind["temperature_annual"]["coverage"]
        cov_r = ind["rainfall_annual"]["coverage"]
        if loc["kind"] == "city":
            fb_en = {"region": f"Estimate for the {src['name']} region ({res_en}); not a measurement of {loc['name']}.",
                     "country": f"No research region contains {loc['name']}; estimate for {src['name']} as a whole ({res_en}).",
                     "study-area": f"{loc['name']} lies outside the research regions and the six study countries; estimate for the whole South Asia study area ({res_en})."}[loc["sourceKind"]]
            fb_bn = {"region": f"{src['nameBn']} অঞ্চলের অনুমান ({res_bn}); {loc['nameBn']}-এর পরিমাপ নয়।",
                     "country": f"{loc['nameBn']} কোনো গবেষণা অঞ্চলে নেই; পুরো {src['nameBn']}-এর অনুমান ({res_bn})।",
                     "study-area": f"{loc['nameBn']} গবেষণা অঞ্চল ও ছয় দেশের বাইরে; পুরো দক্ষিণ এশিয়া গবেষণা এলাকার অনুমান ({res_bn})।"}[loc["sourceKind"]]
        else:
            fb_en = fb_bn = None
        loc["geography"] = {
            "kind": loc["kind"], "sourceId": src_id, "sourceKind": loc.get("sourceKind", loc["kind"]),
            "sourceNameEn": src["name"], "sourceNameBn": src["nameBn"],
            "spatialResolution": res, "resolutionLabelEn": res_en, "resolutionLabelBn": res_bn,
            "cellsUsed": {"temperature": cov_t["cellsUsed"], "rainfall": cov_r["cellsUsed"]},
            "coveragePct": min(cov_t["coveragePct"], cov_r["coveragePct"]),
            "fallback": loc["fallback"], "fallbackReasonEn": fb_en, "fallbackReasonBn": fb_bn,
            "weighting": ("country polygon area in each cell x cos(latitude)" if src["kind"] == "country"
                          else "share of each cell inside the region box x cos(latitude), land cells only"),
        }
        trend = (ps_by_id[src["placeSignalsId"]]["signals"].get("temperature_annual") or {}).get("trend")
        conclusion = build_conclusion(location=loc, source=src, ind=ind, comp=comp, hazards=hazards,
                                      confidences=confidences, trend=trend, as_of=as_of.isoformat())
        bad = missing_fields(conclusion)
        if bad:
            raise ValueError(f"{loc['id']}: conclusion fields empty: {bad}")
        assessments[loc["id"]] = {"hazards": hazards, "confidences": confidences, "verdicts": verdicts, "conclusion": conclusion}

    # --- Alerts ---------------------------------------------------------------------------
    computed, reconstructed, official = [], [], []
    for loc in primary:
        g = geos[loc["id"]]
        year = latest_year(g)
        names = (loc["name"], loc["nameBn"])
        for hz in applicable_hazards(loc["exposure"]):
            steps = []
            years = [y for y in g.years("rainfall", "monsoon") if y <= year]
            if hz == "heat":
                seq = [(y, p) for y in years for p in ("pre-monsoon", "monsoon")]
                for i, (y, p) in enumerate(seq):
                    r = heat_rule(g.get, y, p, seq[i - 1] if i else None)
                    if g.get("temperature", p, y).get("available"):
                        steps.append({"year": y, "period": p, **r})
                latest = (year, "monsoon")
            else:
                for y in years:
                    s = screen(g, hz, y, exposure=loc["exposure"], hazard_zones=hz_by_id, latest_seasons=[(y, "monsoon")])
                    driver_ok = any(e.get("percentile") is not None for e in s["evidence"])
                    if driver_ok:
                        steps.append({"year": y, "period": s["period"], "severity": s["severity"], "evidence": s["evidence"]})
                latest = (year, {"dry": "monsoon", "flood": "monsoon", "landslide": "monsoon", "wildfire": "pre-monsoon", "cyclone": "annual"}[hz])
            for a in lifecycle(loc["id"], hz, steps, latest, names):
                if hz == "wildfire" and a["reconstructed"]:
                    a["noteEn"] += " The driver link used here is estimated from the full record."
                (reconstructed if a["reconstructed"] else computed).append(a)
        geom = loc["_geom"] if loc["kind"] == "country" else loc["_geom"].buffer(1.0)
        from shapely.geometry import Point
        official += official_alerts(loc["id"], data["floods"], lambda la, lo, gm=geom: gm.covers(Point(lo, la)),
                                    f"{year}-01-01", period_end(year, "annual").isoformat())
    for collection in (computed, reconstructed, official):
        collection.sort(key=lambda a: (a["locationId"], a.get("hazard", ""), a.get("firstPeriod", a.get("date", ""))))
    alerts_json = {
        "schema": "alerts-v1", "asOf": as_of.isoformat(), "alertsId": thresholds.ALERTS_ID, "thresholdsId": THRESHOLDS_ID,
        "pipelineRunId": run_id,
        "noteEn": "Internal alerts are screening indicators computed by this project. Official alerts are GDACS records, attributed and never re-scaled. The two are never merged.",
        "noteBn": "অভ্যন্তরীণ সতর্কতা এই প্রকল্পের স্ক্রিনিং সূচক। আনুষ্ঠানিক সতর্কতা GDACS-এর রেকর্ড। দুটি কখনো একসঙ্গে মেশানো হয় না।",
        "computed": computed, "reconstructed": reconstructed, "official": official,
        "officialWindowNoteEn": "Official records cover the latest assessed year; live GDACS alerts are not fetched by this offline run.",
    }

    # --- History --------------------------------------------------------------------------
    history_path = OUT / "history.json"
    old = json.loads(history_path.read_text(encoding="utf-8")) if history_path.exists() else {"runs": []}
    by_loc_alerts = {}
    for a in computed + reconstructed:
        by_loc_alerts.setdefault(a["locationId"], []).append(a)
    periods_rows = {}
    for loc in primary:
        g = geos[loc["id"]]
        rows, prev = [], None
        years = [y for y in g.years("temperature", "annual") if g.get("temperature", "annual", y).get("available")]
        for y in years[-HISTORY_PERIODS:]:
            t = g.get("temperature", "annual", y)
            comp_y = composite_record(g, "monsoon", y, {})
            hz_levels = {}
            for hz in applicable_hazards(loc["exposure"]):
                seasons = [(y - 1, "pre-monsoon"), (y - 1, "monsoon"), (y, "pre-monsoon"), (y, "monsoon")]
                s = screen(g, hz, y, exposure=loc["exposure"], hazard_zones=hz_by_id, latest_seasons=seasons)
                hz_levels[hz] = SCREEN_LEVEL[s["severity"]]
            lvl = max((LEVELS.index(v) for v in hz_levels.values()), default=0)
            if lvl == 0 and (t.get("level", 0) >= 2 or comp_y.get("level", 0) >= 2):
                lvl = 1
            row = {
                "period": f"{y}", "year": y,
                "indicators": {"temperature_annual": {"class": t.get("class"), "direction": t.get("direction"), "percentile": round(t["percentile"], 1)},
                               "rainfall_monsoon": {"class": comp_y.get("class"), "direction": comp_y.get("direction"), "conflicting": comp_y.get("conflicting")}},
                "conclusionLevel": LEVELS[lvl],
                "hazardLevels": hz_levels,
                "confidences": {"anomaly": conf.anomaly(result=t)["grade"]},
                "alertsOpened": sorted(a["id"] for a in by_loc_alerts.get(loc["id"], []) if a["firstPeriod"].startswith(f"{y}-")),
                "alertsClosed": sorted(a["id"] for a in by_loc_alerts.get(loc["id"], []) if (a["closedAt"] or "").startswith(f"{y}-")),
                "reconstructed": y != latest_year(g),
            }
            changes = []
            if prev:
                for field, a_, b_ in (("temperature class", prev["indicators"]["temperature_annual"]["class"], row["indicators"]["temperature_annual"]["class"]),
                                      ("monsoon rainfall class", prev["indicators"]["rainfall_monsoon"]["class"], row["indicators"]["rainfall_monsoon"]["class"]),
                                      ("conclusion level", prev["conclusionLevel"], row["conclusionLevel"]),
                                      ("anomaly confidence", prev["confidences"]["anomaly"], row["confidences"]["anomaly"])):
                    if a_ != b_:
                        changes.append({"field": field, "from": a_, "to": b_, "reason": "new observation"})
                for hz, lv in hz_levels.items():
                    if prev["hazardLevels"].get(hz) != lv:
                        changes.append({"field": f"{hz} screening", "from": prev["hazardLevels"].get(hz), "to": lv, "reason": "new observation"})
            else:
                changes.append({"field": "assessment", "from": None, "to": row["conclusionLevel"], "reason": "first computable period"})
            row["changedSince"] = changes
            rows.append(row)
            prev = row
        periods_rows[loc["id"]] = rows

    run_row = {
        "asOf": as_of.isoformat(), "pipelineRunId": run_id, "inputsHash": data["inputsHash"], "codeHash": code,
        "levels": {loc["id"]: assessments[loc["id"]]["conclusion"]["level"] for loc in primary},
    }
    same = lambda r: r["inputsHash"] == data["inputsHash"] and r.get("codeHash") == code  # noqa: E731
    runs = [r for r in old.get("runs", []) if not same(r)]
    previous_run = runs[-1] if runs else None
    kept = next((r for r in old.get("runs", []) if same(r)), None)
    if kept:  # same inputs: the same assessment, keep the original row (and its date)
        run_row = kept
    else:
        run_row["changedSince"] = [] if not previous_run else [
            {"field": f"{k} level", "from": previous_run["levels"].get(k), "to": v, "reason": "pipeline run"}
            for k, v in run_row["levels"].items() if previous_run["levels"].get(k) != v
        ]
    runs = (runs + [run_row])[-HISTORY_RUNS:]
    history = {"schema": "history-v1", "noteEn": "periods[] replays each year with only the data available at the time (reconstructed: true for past years); runs[] records real pipeline runs.",
               "runs": runs, "periods": periods_rows}

    # --- Freshness and sources -----------------------------------------------------------
    y_last = manifest["years"][-1]
    latest_m = data["latest"]
    last_flood = max(e["date"] for e in data["floods"])
    observed = {
        "gistemp": [("seasonal and annual series", period_end(y_last, "annual")),
                    ("latest monthly snapshot (latest.json)", period_end(int(latest_m["temperature"]["month"][:4]), latest_m["temperature"]["month"][5:]))],
        "gpcp-monthly": [("seasonal and annual series", period_end(y_last, "annual")),
                         ("latest monthly snapshot (latest.json)", period_end(int(latest_m["rainfall"]["month"][:4]), latest_m["rainfall"]["month"][5:]))],
        "gpcp-daily": [("annual extreme-rain series", period_end(manifest["variables"]["heavy-rain"]["years"][-1], "annual"))],
        "cru-ts": [("trend cross-check", period_end(2025, "annual"))],
        "firms-modis": [("fire counts", period_end(hazard_zones[[z["hazard"] for z in hazard_zones].index("wildfire")]["years"][-1], "annual"))],
        "nasa-glc": [("landslide catalogue", period_end(2017, "annual"))],
        "gdacs": [("flood records", date.fromisoformat(last_flood))],
        "ibtracs": [("cyclone tracks", period_end(hazard_zones[[z["hazard"] for z in hazard_zones].index("cyclone")]["years"][-1], "annual"))],
    }
    datasets = []
    for d in DATASET_VERSIONS:
        rows = [{"product": prod, **freshness(d["datasetId"], end, as_of)} for prod, end in observed[d["datasetId"]]]
        datasets.append({**d, "expectedLagDays": EXPECTED_LAG_DAYS[d["datasetId"]], "products": rows,
                         "sha256": None, "sha256Note": "Raw cache not present in this run; derived inputs are hashed under derivedInputs.",
                         "retrievedAt": retrieved, "checkedAt": as_of.isoformat(),
                         "stale": any(r["stale"] for r in rows)})
    sources = {
        "schema": "sources-v1", "asOf": as_of.isoformat(), "pipelineRunId": run_id, "inputsHash": data["inputsHash"], "codeHash": code,
        "mode": "refresh" if args.refresh and data["monthly"] else "offline",
        "datasets": datasets, "derivedInputs": data["hashes"],
        "lineage": validation.SOURCE_LINEAGE,
        "pipelineOrder": ["build.py", "build_hazards.py", "cyclones.py", "crosscheck.py", "latest.py", "intelligence.py", "evaluate.py"],
        "degraded": log["degraded"] + ([] if data["monthly"] else [
            "No monthly series: assessments use the latest complete seasons and year from the committed record. Run intelligence.py --refresh with network access for monthly assessments."]),
        "latestMonthSnapshot": latest_m,
        "latestMonthNoteEn": "The latest month (latest.json) is shown for context only. It is not classified with class-v1 because the 1991–2020 history for that calendar month is not in the committed record.",
    }

    # --- current.json ---------------------------------------------------------------------
    current = {
        "schema": "current-v1", "asOf": as_of.isoformat(), "pipelineRunId": run_id, "thresholdsId": THRESHOLDS_ID,
        "baselineId": thresholds.BASELINE_ID, "dailyBaselineId": thresholds.DAILY_BASELINE_ID,
        "retrievedAt": retrieved,
        "indicators": {gid: recs for gid, recs in indicators.items()},
        "composites": {gid: c for gid, c in composites.items()},
    }
    resolvable = {r["id"] for recs in indicators.values() for r in recs.values()} | {c["id"] for cs in composites.values() for c in cs.values()}
    for lid, a in assessments.items():
        missing = [e for e in a["conclusion"]["evidenceIds"] if e not in resolvable]
        if missing:
            raise ValueError(f"{lid}: evidence ids do not resolve: {missing}")

    # --- locations.json and index.json ------------------------------------------------------
    loc_out = []
    for loc in locations:
        a = assessments[loc["id"]]
        pub = geography.public(loc)
        loc_out.append({**pub, "schema": "location-v1", "asOf": as_of.isoformat(), "thresholdsId": THRESHOLDS_ID,
                        "conclusion": a["conclusion"], "hazards": a["hazards"], "confidences": a["confidences"],
                        "validation": a["verdicts"], "alertsFrom": loc["sourceId"], "nextReview": None})
    index = {
        "schema": "index-v1", "asOf": as_of.isoformat(), "pipelineRunId": run_id,
        "locations": [{
            "id": loc["id"], "kind": loc["kind"], "name": loc["name"], "nameBn": loc["nameBn"],
            "country": loc.get("country"), "countryBn": loc.get("countryBn"), "countryCodes": loc["countryCodes"],
            "sourceId": loc["sourceId"], "center": loc["center"],
            "level": assessments[loc["id"]]["conclusion"]["level"],
            "headline": assessments[loc["id"]]["conclusion"]["headline"],
            "hazards": [h["hazard"] for h in assessments[loc["id"]]["hazards"]],
            "flagged": [h["hazard"] for h in assessments[loc["id"]]["hazards"] if h["severity"] in ("watch", "warning")],
            "observedThrough": assessments[loc["id"]]["conclusion"]["observedThrough"],
        } for loc in locations],
    }

    write("thresholds.json", thresholds.published(), compact=False)
    write("sources.json", sources, compact=False)
    write("current.json", current)
    write("locations.json", {"schema": "locations-v1", "asOf": as_of.isoformat(), "pipelineRunId": run_id, "locations": loc_out})
    write("index.json", index)
    write("alerts.json", alerts_json)
    write("history.json", history)

    log["steps"].append({"step": "write", "seconds": round(time.time() - t0, 2)})
    log["outputs"] = {p.name: inputs.sha256(p) for p in sorted(OUT.glob("*.json"))}
    LOGS.mkdir(exist_ok=True)
    (LOGS / f"intelligence-{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}.json").write_text(
        json.dumps({"pipelineRunId": run_id, "asOf": as_of.isoformat(), **log}, indent=1), encoding="utf-8")
    levels = {}
    for a in assessments.values():
        levels[a["conclusion"]["level"]] = levels.get(a["conclusion"]["level"], 0) + 1
    print(f"{len(locations)} locations ({levels}); alerts: {len(computed)} computed, {len(reconstructed)} reconstructed, "
          f"{len(official)} official; run {run_id}")


if __name__ == "__main__":
    main()
