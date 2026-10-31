"""Evaluation and backtesting of the intelligence engine (run after intelligence.py).

    python evaluate.py                  # writes web/public/data/intelligence/evaluation.json
    python evaluate.py --check          # also fail (exit 1) if a false-alarm rate regressed
    python evaluate.py --update-baseline  # accept the current metrics as the new baseline

The committed baseline lives in analysis/evaluation_baseline.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from intel import geography, inputs
from intel.engine import GeoSeries
from intel.evaluation import regressions, run
from intel.thresholds import FALSE_ALARM_TOLERANCE

BASELINE = Path(__file__).parent / "evaluation_baseline.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--update-baseline", action="store_true")
    args = ap.parse_args()

    data = inputs.load()
    ps = data["placeSignals"]
    hazard_zones = data["hazardZones"]["zones"]
    locations = geography.build(ps, data["trendZones"]["zones"], hazard_zones)
    ps_by_id = {p["id"]: p for p in ps["places"]}
    geos = [
        GeoSeries(loc["id"], {k: {"years": v["years"], "series": v["series"]} for k, v in ps_by_id[loc["placeSignalsId"]]["signals"].items() if v})
        for loc in locations if loc["kind"] != "city"
    ]
    current = json.loads((inputs.OUT / "current.json").read_text(encoding="utf-8"))
    result = run(geos, hazard_zones, data["cells"], data["manifest"])
    result.update({"asOf": current["asOf"], "pipelineRunId": current["pipelineRunId"], "thresholdsId": current["thresholdsId"],
                   "inputsHash": data["inputsHash"]})

    baseline = json.loads(BASELINE.read_text(encoding="utf-8")) if BASELINE.exists() else None
    result["regressionGate"] = {
        "baselineFile": "analysis/evaluation_baseline.json",
        "tolerance": FALSE_ALARM_TOLERANCE,
        "baseline": baseline,
        "regressions": [] if baseline is None else regressions(result, baseline, FALSE_ALARM_TOLERANCE),
    }
    (inputs.OUT / "evaluation.json").write_text(json.dumps(result, ensure_ascii=False, indent=1, allow_nan=False) + "\n", encoding="utf-8")

    m = result["metrics"]
    print(f"anomaly agreement {m['anomalyDetectionAccuracy']['value']}% (n={m['anomalyDetectionAccuracy']['n']}); "
          f"false alarms {m['falseAlarmRate']['value']} {m['falseAlarmRate']['byHazard']}; missed {m['missedEvents']['value']}")

    if args.update_baseline or baseline is None:
        BASELINE.write_text(json.dumps({"falseAlarmRate": {"value": m["falseAlarmRate"]["value"], "byHazard": m["falseAlarmRate"]["byHazard"]},
                                        "missedEvents": m["missedEvents"]["value"]}, indent=1) + "\n", encoding="utf-8")
        print(f"baseline written to {BASELINE.name}")
    problems = result["regressionGate"]["regressions"]
    if args.check and problems:
        print("REGRESSION: " + "; ".join(problems), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
