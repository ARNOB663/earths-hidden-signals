"""Checks country weighting independently of real country climate values."""
import numpy as np
from shapely.geometry import box, mapping
from build_country_signals import country_signal

META = {'unit': '°C', 'dataset': 'test', 'baseline': 'test', 'decimals': 6}
GRID = {'lat0': 0, 'lon0': 0, 'dLat': 2, 'dLon': 2, 'nLat': 2, 'nLon': 1}
YEARS = list(range(1981, 1993))


def test_country_intersection_and_latitude_weights():
    # Exactly half of each of two equally-sized cells. Latitude is the only difference.
    polygon = mapping(box(-1, 0, 1, 2))
    result = country_signal(polygon, GRID, [[0.0]*12, [10.0]*12], YEARS, META)
    expected = 10*np.cos(np.deg2rad(2))/(1+np.cos(np.deg2rad(2)))
    assert result['cells'] == 2
    assert abs(sum(result['weights'])-1) < 1e-10
    assert np.allclose(result['series'], expected, atol=1e-6)


def test_outside_cells_and_missing_land_are_excluded():
    result = country_signal(mapping(box(-1, -1, 1, 1)), GRID, [[3.0]*12, [90.0]*12], YEARS, META)
    assert result['cellIndices'] == [0]
    assert result['series'] == [3.0]*12
    assert country_signal(mapping(box(-1, -1, 1, 1)), GRID, [None, [90.0]*12], YEARS, META) is None


def test_aggregate_uses_existing_trend_method():
    from stats import trend
    series = [[i*0.1 for i in range(12)], [i*0.2 for i in range(12)]]
    result = country_signal(mapping(box(-1, -1, 1, 3)), GRID, series, YEARS, META)
    expected_series = np.array(series).T @ np.array(result['weights'])
    expected = trend(expected_series)
    assert np.isclose(result['trend']['slopePerDecade'], expected.slope*10)
    assert np.isclose(result['trend']['p'], expected.p)
