"""Tests for the Future Outlook summaries (offline; synthetic model output)."""

import numpy as np

import future


def test_longest_dry_counts_consecutive_days():
    days = np.array([5, 0, 0, 0.5, 3, 0, 0, 0, 0, 2], dtype=float)[:, None, None]
    assert future.longest_dry(days)[0, 0] == 4


def test_zone_mask_keeps_land_inside_box_only():
    lats = np.array([10.0, 20.0, 30.0])
    lons = np.array([70.0, 80.0, 90.0])
    land = np.ones((3, 3), dtype=bool)
    land[1, 1] = False
    w = future.zone_mask((15, 35, 75, 95), lats, lons, land)
    assert w[0].sum() == 0  # 10N is outside
    assert w[1, 1] == 0  # sea
    assert w[2, 2] > 0 and w[1, 2] > 0


def _fake(models, hist, fut):
    zones = [{"id": "z", "name": "Z", "hazard": "flood", "bbox": [0, 1, 0, 1]}]
    per_model = {}
    for m in models:
        per_model[m] = {"historical": {"z": {}}, "ssp245": {"z": {}}, "ssp585": {"z": {}}}
        for k in future.METRICS:
            per_model[m]["historical"]["z"][k] = list(hist)
            per_model[m]["ssp245"]["z"][k] = list(fut)
            per_model[m]["ssp585"]["z"][k] = list(fut)
    return future.summarise(per_model, zones)[0]


def test_summary_reports_median_change_and_agreement():
    hist = np.linspace(100, 119, 20)  # mean 109.5
    fut = hist * 1.2  # +20 %
    r = _fake(["A", "B", "C"], hist, fut)
    m = r["scenarios"]["ssp585"]["metrics"]
    assert abs(m["monsoonRain"]["median"] - 20) < 0.01  # pct metric
    assert abs(m["tMean"]["median"] - 21.9) < 0.01  # abs metric: 131.4 - 109.5
    assert m["monsoonRain"]["agree"] == 3


def test_exceedance_counts_years_above_present_90th_percentile():
    hist = np.arange(20, dtype=float)  # 90th percentile = 17.1
    fut = np.array([0] * 10 + [18] * 10, dtype=float)  # half the years above it
    r = _fake(["A"], hist, fut)
    e = r["scenarios"]["ssp245"]["exceedance"]
    assert e["wetMonsoon"]["median"] == 0.5
    assert e["dryMonsoon"]["median"] == 0.5  # the zeros fall below the 10th percentile (1.9)
    assert e["wetMonsoon"]["today"] == 0.1
