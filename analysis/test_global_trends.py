"""Tests for the global trend helpers (offline, synthetic grids)."""

import numpy as np

import global_trends as g


def test_cell_trends_rate_and_missing_cells():
    years = 45
    rng = np.random.default_rng(2)
    series = np.full((years, 2, 2), np.nan)
    series[:, 0, 0] = 0.03 * np.arange(years) + rng.normal(0, 0.05, years)  # +0.3 per decade
    series[:, 0, 1] = rng.normal(0, 1, years)  # noise
    slope, p = g.cell_trends(series)
    assert 0.25 < slope[0, 0] < 0.35 and p[0, 0] < 0.001
    assert np.isnan(slope[1, 0]) and np.isnan(slope[1, 1])  # all-missing cells stay empty


def test_cell_trends_scale_gives_percent_per_decade():
    years = 45
    series = np.zeros((years, 1, 1))
    series[:, 0, 0] = 100 + 0.5 * np.arange(years)  # +5 per decade on a mean of 111
    slope, _ = g.cell_trends(series, np.array([[100 / series[:, 0, 0].mean()]]))
    assert abs(slope[0, 0] - 5 * 100 / series[:, 0, 0].mean()) < 1e-6


def test_grid_payload_lists_only_valid_cells():
    lats, lons = np.array([0.0, 2.0]), np.array([10.0])
    slope = np.array([[0.2], [np.nan]])
    sig = np.array([[True], [False]])
    out = g.grid_payload(lats, lons, 2.0, slope, sig, 2)
    assert out == {"cell": 2.0, "cells": [[0.0, 10.0, 0.2, 1]]}
