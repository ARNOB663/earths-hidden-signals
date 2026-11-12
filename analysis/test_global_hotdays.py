import numpy as np

from global_hotdays import days_above


def test_counts_days_above_each_cells_own_threshold_per_year():
    daily = np.array([[30, 10], [31, 12], [36, 15], [40, 11]], dtype="f4")  # 4 days, 2 cells
    thr = np.array([31.0, 11.0])
    out = days_above(daily, thr, years=2)
    assert out.tolist() == [1.0, 1.0]  # cell 0: 36, 40 -> 2 days / 2 years; cell 1: 12, 15 -> 2 / 2


def test_today_has_five_percent_of_days_by_construction():
    rng = np.random.default_rng(0)
    hist = rng.normal(300, 5, size=(7300, 3)).astype("f4")
    thr = np.percentile(hist, 95, axis=0)
    assert np.allclose(days_above(hist, thr, years=20), 365 * 0.05, atol=0.5)
