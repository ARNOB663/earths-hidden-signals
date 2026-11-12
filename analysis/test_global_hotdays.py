import numpy as np

from global_hotdays import hot_days


def test_counts_days_strictly_above_35c_per_cell():
    k = 273.15
    t = np.full((5, 1, 3), 20 + k, dtype="f4")
    t[:3, 0, 0] = 36 + k  # 3 hot days
    t[:, 0, 1] = 35 + k  # exactly 35: not above
    t[0, 0, 2] = np.nan  # ocean / missing: no value
    out = hot_days(t)
    assert out[0, 0] == 3
    assert out[0, 1] == 0
    assert np.isnan(out[0, 2])
