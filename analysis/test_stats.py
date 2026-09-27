import numpy as np
import pymannkendall as mk

from stats import fdr_significant, sen_confidence_interval, trend


def test_clear_trend_is_significant_with_correct_rate():
    rng = np.random.default_rng(0)
    y = 0.03 * np.arange(45) + rng.normal(0, 0.2, 45)
    t = trend(y)
    assert t is not None
    assert t.p < 0.01
    assert abs(t.slope - 0.03) < 0.01
    assert t.lower < t.slope < t.upper


def test_pure_noise_is_usually_not_significant():
    rng = np.random.default_rng(1)
    hits = sum(trend(rng.normal(0, 1, 45)).p < 0.05 for _ in range(200))
    # Expect about 5% false positives; allow sampling slack.
    assert hits < 25


def test_ci_matches_gilbert_example_shape():
    y = np.array([1.0, 2.0, 4.0, 3.0, 5.0, 7.0, 6.0, 8.0, 9.0, 11.0, 10.0, 12.0])
    lo, hi = sen_confidence_interval(y, mk.original_test(y).var_s)
    assert lo <= mk.sens_slope(y).slope <= hi


def test_missing_or_flat_series_are_skipped():
    assert trend(np.full(30, 5.0)) is None
    y = np.arange(30, dtype=float)
    y[3] = np.nan
    assert trend(y) is None


def test_fdr_keeps_strong_signals_and_drops_noise():
    p = np.array([0.0001, 0.001, 0.2, 0.5, 0.9, np.nan])
    assert fdr_significant(p).tolist() == [True, True, False, False, False, False]
