"""Tests for the global-future helpers (offline, synthetic grids)."""

import numpy as np

import global_future as gf


def test_seasonal_total_picks_each_cells_own_months():
    years, ny, nx = 2, 1, 2
    monthly = np.zeros((years, 12, ny, nx))
    monthly[:, 5:9, 0, 0] = 100  # Jun-Sep wet in cell (0,0)
    monthly[:, [11, 0, 1, 2], 0, 1] = 50  # Dec-Mar wet in cell (0,1): wraps over the new year
    land = np.ones((ny, nx), dtype=bool)
    idx = gf.wet_season_index(monthly, land)
    tot = gf.seasonal_total(monthly, idx)
    assert np.allclose(tot[:, 0, 0], 400)
    assert np.allclose(tot[:, 0, 1], 200)


def test_summarise_agreement_and_hot_share():
    lats, lons = np.array([0.0, 10.0]), np.array([10.0, 20.0])
    land = np.array([[True, True], [True, False]])
    weights = np.cos(np.deg2rad(lats))[:, None] * land
    def model(dw, hot, lw):
        cell = lambda v: np.where(land, v, np.nan)
        return {sc: {"landWarming": lw, "dt": cell(np.ones((2, 2))), "dw": cell(dw), "hot": cell(hot)} for sc in gf.SCENARIOS}
    dw_a = np.array([[10.0, -5.0], [3.0, 0.0]])
    dw_b = np.array([[12.0, 4.0], [2.0, 0.0]])
    hot = np.array([[1.0, 0.5], [0.95, 0.0]])
    out = gf.summarise({"A": model(dw_a, hot, 2.0), "B": model(dw_b, hot, 3.0)}, lats, lons, land, weights)
    s = out["scenarios"]["ssp245"]
    assert s["landWarming"]["median"] == 2.5
    assert s["wetSeason"]["wetterAgreed"] == 2  # cells (0,0) and (1,0); (0,1) disagrees
    assert s["wetSeason"]["drierAgreed"] == 0
    # hot >= 0.9 on cells (0,0) and (1,0): weights cos(0) + cos(10) out of cos(0)*2 + cos(10)
    share = (1 + np.cos(np.deg2rad(10))) / (2 + np.cos(np.deg2rad(10)))
    assert abs(s["hotEveryYearShare"] - round(share, 3)) < 1e-9
