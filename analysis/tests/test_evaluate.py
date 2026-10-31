import json
from pathlib import Path

import numpy as np

from intel.engine import GeoSeries, classify_year
from intel.evaluation import anomaly_accuracy, hazard_backtest, regressions

FIX = Path(__file__).parent / "fixtures"
YEARS = list(range(1981, 2026))


def series(values):
    return {"years": YEARS, "series": values}


def test_no_leakage_future_values_do_not_change_the_past():
    rng = np.random.default_rng(0)
    base = list(np.round(rng.normal(0, 1, len(YEARS)), 3))
    altered = list(base)
    for y in range(2016, 2026):  # change every value after the assessed year
        altered[YEARS.index(y)] = 50.0
    for year in (2012, 2015):
        a = classify_year(YEARS, base, year, daily=False)
        b = classify_year(YEARS, altered, year, daily=False)
        assert a == b, year


def test_full_record_class_can_differ_but_realtime_cannot():
    # A value that is extreme against its own past but normal once the future (much higher) years enter the baseline.
    vals = [0.0] * len(YEARS)
    vals[YEARS.index(2012)] = 3.0
    for y in range(2013, 2021):
        vals[YEARS.index(y)] = 5.0
    g = GeoSeries("t", {"temperature_annual": series(vals)})
    assert g.get("temperature", "annual", 2012)["direction"] == "high"
    acc, _ = anomaly_accuracy([g])
    assert acc["byYear"]["2012"]["agree"] == 0  # leakage would have made this agree


def test_backtest_counts_hits_misses_and_false_alarms():
    zone = json.loads((FIX / "events.json").read_text())
    vals = [100.0] * len(YEARS)
    vals[YEARS.index(2015)] = 200.0  # wet extreme in an event year -> hit
    vals[YEARS.index(2013)] = 190.0  # wet extreme in a quiet year -> false alarm
    g = GeoSeries(zone["id"], {"rainfall_monsoon": series(vals)})
    out = hazard_backtest({zone["id"]: g}, [zone])[zone["id"]]
    assert out["available"]
    assert (out["hits"], out["falseAlarms"], out["misses"]) == (1, 1, 1)  # 2018 is a missed event
    assert out["falseAlarmRate"] == 0.5 and out["missedEventRate"] == 0.5


def test_regression_gate():
    current = {"metrics": {"falseAlarmRate": {"value": 0.50, "byHazard": {"flood": 0.6}}}}
    assert regressions(current, {"falseAlarmRate": {"value": 0.49, "byHazard": {"flood": 0.6}}}, 0.02) == []
    problems = regressions(current, {"falseAlarmRate": {"value": 0.40, "byHazard": {"flood": 0.6}}}, 0.02)
    assert problems and "pooled" in problems[0]
