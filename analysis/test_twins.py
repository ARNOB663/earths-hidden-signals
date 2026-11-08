"""Tests for the Climate Twins helpers (offline; no data files needed)."""

import numpy as np
from shapely.geometry import MultiPolygon, box

import twins


def test_wettest_months_wraps_over_new_year():
    clim = np.array([90, 80, 10, 5, 5, 5, 5, 5, 5, 10, 70, 100], dtype=float)
    assert sorted(twins.wettest_months(clim)) == [0, 1, 10, 11]


def test_wettest_months_monsoon():
    clim = np.array([5, 5, 10, 20, 60, 300, 400, 380, 250, 60, 10, 5], dtype=float)
    assert sorted(twins.wettest_months(clim)) == [5, 6, 7, 8]


def test_fingerprint_detects_drying_and_warming():
    years = 45
    rng = np.random.default_rng(1)
    temp = np.repeat((0.03 * np.arange(years) + rng.normal(0, 0.05, years))[:, None], 12, axis=1)
    base = np.array([5, 5, 10, 20, 60, 300, 400, 380, 250, 60, 10, 5], dtype=float)
    factor = (1 - 0.005 * np.arange(years))[:, None]  # -0.5 % of the first year's rain per year
    rain = base[None, :] * factor * (1 + rng.normal(0, 0.03, (years, 1)))
    fp = twins.fingerprint(temp, rain)
    assert fp is not None
    assert 0.25 < fp["features"]["warming"] < 0.35
    assert fp["features"]["wetTrend"] < -3
    assert fp["tests"]["wetTrend"]["p"] < 0.05
    assert fp["wetMonths"] == [6, 7, 8, 9]


def test_fingerprint_refuses_gaps_instead_of_inventing_data():
    temp = np.zeros((45, 12))
    temp[10] = np.nan
    rain = np.full((45, 12), 50.0)
    assert twins.fingerprint(temp, rain) is None


def test_compass_uses_main_landmass():
    mainland = box(-125, 25, -67, 49)
    alaska = box(-170, 52, -130, 71)
    usa = MultiPolygon([mainland, alaska])
    # With Alaska in the bounds, Colorado came out "eastern"; against the mainland it is not.
    assert "east" not in twins.compass(38.8, -105, usa)
    assert "west" in twins.compass(37, -121, usa)  # California
    assert "east" in twins.compass(42, -71, usa)  # Boston


def test_plausible_rejects_far_away_points():
    lookup = {"china": box(73, 18, 135, 53)}
    assert twins.plausible(30, 110, "China", lookup)
    assert not twins.plausible(15, 0, "China", lookup)  # a "Flood in China" placed in Mali
    assert twins.plausible(15, 0, "Atlantis", lookup)  # unknown name: keep


def test_events_in_counts_severe_separately():
    events = [
        {"type": "flood", "date": "2020-07-01", "lat": 1, "lon": 1, "alert": "Red", "title": "A"},
        {"type": "flood", "date": "2021-07-01", "lat": 2, "lon": 2, "alert": "Green", "title": "B"},
        {"type": "drought", "date": "2019-01-01", "lat": 50, "lon": 50, "alert": "Red", "title": "far"},
    ]
    got = twins.events_in((0, 5, 0, 5), events)
    assert got["counts"]["flood"] == {"all": 2, "severe": 1}
    assert got["counts"]["drought"] == {"all": 0, "severe": 0}
    assert [e["title"] for e in got["notable"]] == ["A"]
