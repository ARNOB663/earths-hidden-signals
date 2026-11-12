import numpy as np

from compound import association, flags, month_ranks, window


def test_month_ranks_are_per_calendar_month():
    s = np.zeros((10, 12))
    s[:, 0] = np.arange(10)  # January rises; other months flat
    r = month_ranks(s)
    assert r[9, 0] == 1.0 and r[0, 0] == 0.1


def test_hot_dry_needs_both_in_the_same_month():
    years = 20
    t = np.tile(np.arange(years)[:, None], (1, 12)).astype(float)  # last years hottest
    r = np.tile(np.arange(years)[::-1][:, None], (1, 12)).astype(float)  # last years driest
    f = flags(t, r)
    # top 10% of 20 years = the last 2 years: hot and dry together in 24 months
    assert f["hotDry"].sum() == 24
    assert window(f["hotDry"], (1981, 1995)) == 0


def test_association_needs_enough_event_months():
    flag = np.zeros(120, dtype=bool)
    flag[:10] = True
    assert association(flag, {1, 2}, 0, 119) is None
    out = association(flag, {0, 1, 2, 3, 4, 50}, 0, 119)
    assert out["inEvents"] == 5 and out["eventMonths"] == 6
    assert out["lift"] > 5 and out["p"] < 0.01
