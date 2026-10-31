"""Country context for the satellite map and country dashboards, from the existing
annual research grids.

No satellite tile values are inferred. Country weights are the country-land area
inside each retained analysis cell, times cos(latitude), extending build.py's
area/land-share/latitude weighting from rectangular zones to country polygons.
Series are reconstructed from the published (rounded) cell series; trend testing
uses stats.py unchanged. Regional results are copied unchanged from zones.json.
Run after build.py: python analysis/build_country_signals.py
"""
import json
from pathlib import Path
import numpy as np
from shapely.geometry import box, shape, mapping
from stats import trend

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'web/public/data'
# Every variable and season build.py publishes, so a country dashboard has the same
# coverage as the regional results (annual + seasonal means, extremes, dry spells).
CORE = ['temperature', 'rainfall']
EXTRA = ['hot-months', 'heavy-rain', 'dry-spell', 'wettest-day']


def cell_weights(geometry, grid):
    """Country-land area in each retained analysis cell, times cos(latitude)."""
    polygon = shape(geometry)
    weights, cells = [], []
    present = grid.get('present')
    for k in range(grid['nLat'] * grid['nLon']):
        if present is not None and not present[k]:
            continue
        i, j = divmod(k, grid['nLon'])
        lat = grid['lat0'] + i * grid['dLat']
        lon = grid['lon0'] + j * grid['dLon']
        cell = box(lon-grid['dLon']/2, lat-grid['dLat']/2, lon+grid['dLon']/2, lat+grid['dLat']/2)
        overlap = polygon.intersection(cell).area
        weight = overlap * np.cos(np.deg2rad(lat))
        if weight > 1e-12:
            cells.append(k)
            weights.append(float(weight))
    if not weights:
        return None
    return cells, np.array(weights) / sum(weights)


def country_signal(geometry, grid, series, years, meta, weights=None):
    """Area-weighted country series and its trend. `weights` lets callers reuse one
    geometry pass across every variable on the same grid."""
    if weights is None:
        weights = cell_weights(geometry, grid)
    if weights is None:
        return None
    cells, normalized = weights
    # A cell with no series (sea, or too little land) contributes nothing.
    keep = [n for n, k in enumerate(cells) if series[k] is not None and not any(v is None for v in series[k])]
    if not keep:
        return None
    cells = [cells[n] for n in keep]
    normalized = normalized[keep] / normalized[keep].sum()
    aggregate = np.array([series[k] for k in cells]).T @ normalized
    result = trend(aggregate)
    summary = None if result is None else dict(slopePerDecade=result.slope*10, lowerPerDecade=result.lower*10, upperPerDecade=result.upper*10, p=result.p)
    return dict(years=years, series=[round(float(v), meta['decimals']) for v in aggregate], trend=summary,
                unit=meta['unit'], source=meta['dataset'], baseline=meta['baseline'], gridDegrees=grid['dLat'],
                cells=len(cells), cellIndices=cells, weights=normalized.round(12).tolist())


def series_grid(manifest, key, series):
    """The build.py grid for one variable, plus which of its cells hold a series."""
    grid = dict(manifest['grids'][key.split('_')[0]])
    grid['present'] = [v is not None and not any(x is None for x in v) for v in series[key]]
    return grid


def country_signals(geometry, manifest, keys, series):
    """Signals for several variables/seasons, sharing the geometry pass per grid."""
    shared = {}
    out = {}
    for key in keys:
        var = key.split('_')[0]
        grid = series_grid(manifest, key, series)
        if var not in shared:
            shared[var] = cell_weights(geometry, grid)
        weights = shared[var]
        out[key] = None if weights is None else country_signal(geometry, grid, series[key], manifest['variables'][var]['years'], manifest['variables'][var], weights)
    return out


def main():
    manifest = json.loads((DATA/'trends/manifest.json').read_text())
    boundaries = json.loads((DATA/'maps/south-asia-boundaries.json').read_text())
    zones = json.loads((DATA/'trends/zones.json').read_text())['zones']
    keys = [f'{v}_{s}' for v in CORE for s in ('annual', 'pre-monsoon', 'monsoon')]
    keys += [f'{v}_annual' for v in EXTRA]
    series = {k: json.loads((DATA/f'trends/{k}_series.json').read_text()) for k in keys}
    places = []
    for feature in boundaries['features']:
        polygon = shape(feature['geometry'])
        lo0, la0, lo1, la1 = polygon.bounds
        places.append(dict(id=feature['id'].lower(), name=feature['properties']['name'], type='country', countryCode=feature['id'],
                           bounds=[[la0, lo0], [la1, lo1]], geometry=feature['geometry'],
                           signals=country_signals(feature['geometry'], manifest, keys, series)))
    for z in zones:
        la0, la1, lo0, lo1 = z['bbox']
        signals = {}
        for key in keys:
            var = key.split('_')[0]
            r = z['results'].get(key)
            meta = manifest['variables'][var]
            signals[key] = None if not r else dict(years=meta['years'], series=r['series'], trend=r['trend'], unit=meta['unit'],
                           baseline=meta['baseline'], source=meta['dataset'], gridDegrees=manifest['grids'][var]['dLat'], cells=None)
        places.append(dict(id=z['id'], name='South Asia' if z['id']=='study-area' else z['name'], type='region',
                           bounds=[[la0, lo0], [la1, lo1]], geometry=mapping(box(lo0, la0, lo1, la1)), signals=signals))
    output = dict(generated=manifest['generated'], method='Country-land polygon overlap × cos(latitude), retained analysis cells; stats.py trend tests. Published rounded annual series.', places=places)
    (DATA/'maps/place-signals.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n')
    print(f'Wrote {len(places)} places with {len(keys)} temperature, rainfall and extreme series each')

if __name__ == '__main__':
    main()
