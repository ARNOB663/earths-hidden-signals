import json
from pathlib import Path

import numpy as np
import pytest

from intel.anomalies import classify, duration, percentile_position
from intel.thresholds import CLASS_LEVEL

BASE = np.arange(30, dtype=float)  # 0..29, mean 14.5, sd ~8.8
FIX = Path(__file__).parent / "fixtures"


def test_percentile_is_discrete_mid_rank():
    # Above every baseline value: 100 (n + 1/2) / (n + 1), never 100.
    p, k, t, n = percentile_position(1000.0, BASE)
    assert (k, t, n) == (30, 0, 30)
    assert p == pytest.approx(100 * 30.5 / 31)
    # Steps between neighbouring ranks are 100 / (n + 1).
    p1, *_ = percentile_position(10.5, BASE)
    p2, *_ = percentile_position(11.5, BASE)
    assert p2 - p1 == pytest.approx(100 / 31)


def test_ties_count_half():
    p, k, t, _ = percentile_position(5.0, BASE)
    assert (k, t) == (5, 1)
    assert p == pytest.approx(100 * (5 + 0.5 + 0.5) / 31)


def test_central_value_is_normal():
    r = classify(14.5, BASE)
    assert r["class"] == "normal" and r["level"] == 0


@pytest.mark.parametrize(
    "value,expected",
    [
        (27.5, "above-normal"),    # k=28 -> P=91.9 (>90), z=1.48
        (28.5, "unusually-high"),  # k=29 -> P=95.2 (> 95)
        (31.0, "unusually-high"),  # above all -> P=98.4, z=1.87
        (33.0, "extreme"),         # z >= 2 (percentile alone cannot reach 99 with n=30)
        (1.5, "below-normal"),
        (-1.0, "unusually-low"),
        (-4.0, "extreme"),
    ],
)
def test_class_boundaries(value, expected):
    r = classify(value, BASE)
    assert r["class"] == expected, (value, r)


def test_extreme_needs_z_with_thirty_values():
    r = classify(31.0, BASE)
    assert r["percentile"] < 99
    assert r["class"] != "extreme"


def test_z_gap_is_closed():
    """Rev. 1 left P inside 10-90 with 1 <= |z| < 1.5 unclassified; it is now above/below normal."""
    base = np.array([0.0] * 27 + [10.0] * 3)  # mean 1.0, sd ~3.05
    r = classify(4.5, base)  # above the 27 zeros: P = 88.7; z ~ 1.15
    assert r["percentile"] <= 90
    assert 1.0 <= r["zScore"] < 1.5
    assert r["class"] == "above-normal" and r["trigger"] == "z"


def test_skewed_rainfall_percentile_is_primary():
    data = json.loads((FIX / "skewed_rainfall.json").read_text())
    base = np.array(data["series"][:30], dtype=float)
    r = classify(105.0, base)  # above 29 of 30 values, but far below the outlier-inflated mean
    assert r["direction"] == "high"
    assert r["zScore"] < 0  # mean is dragged up by the 900 mm outlier
    assert r["class"] == "unusually-high" and r["trigger"] == "percentile"


def test_short_baseline_is_unavailable():
    r = classify(1.0, np.arange(19, dtype=float))
    assert r["available"] is False and r["reason"] == "baseline-too-short"
    assert classify(1.0, np.arange(20, dtype=float))["available"] is True


def test_missing_values_are_ignored():
    base = np.concatenate([np.arange(25, dtype=float), [np.nan] * 5])
    assert classify(12.0, base)["n"] == 25


def test_class_levels_are_published():
    assert CLASS_LEVEL["extreme"] == 3 and CLASS_LEVEL["normal"] == 0


def test_duration_counts_same_sign_run():
    assert duration([0, 1, 2, 1]) == 3
    assert duration([1, -1, -2]) == 2
    assert duration([2, 0]) == 0
    assert duration([]) == 0
