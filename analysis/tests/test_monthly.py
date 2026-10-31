"""The --refresh aggregation, on synthetic grids (no network)."""

import numpy as np

import monthly


def test_weighted_mean_skips_missing_cells():
    values = np.array([[[1.0, 3.0], [np.nan, 5.0]]])  # one time step, 2x2 grid
    weights = np.array([[1.0, 1.0], [1.0, 2.0]])
    series, cov = monthly.aggregate(values, weights)
    assert series[0] == (1 + 3 + 10) / 4
    assert cov[0] == 80.0


def test_low_coverage_is_not_reported():
    values = np.array([[[np.nan, np.nan], [np.nan, 5.0]]])
    series, cov = monthly.aggregate(values, np.ones((2, 2)))
    assert np.isnan(series[0]) and cov[0] == 25.0


def test_rates_become_totals_once_with_leap_years():
    rates = np.ones((2, 12, 1, 1))
    totals = monthly.to_totals(rates, [2023, 2024])
    assert totals[0, 1, 0, 0] == 28 and totals[1, 1, 0, 0] == 29
    assert totals[1].sum() == 366
