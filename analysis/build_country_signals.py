"""Country context for the satellite map, from the existing annual research grids.

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


def country_signal(geometry, grid, series, years, meta):
    polygon = shape(geometry)
    weights = []
    cells = []
    for k, values in enumerate(series):
        if values is None or any(v is None for v in values):
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
    normalized = np.array(weights) / sum(weights)
    aggregate = np.array([series[k] for k in cells]).T @ normalized
    result = trend(aggregate)
    summary = None if result is None else dict(slopePerDecade=result.slope*10, lowerPerDecade=result.lower*10, upperPerDecade=result.upper*10, p=result.p)
    return dict(years=years, series=[round(float(v), meta['decimals']) for v in aggregate], trend=summary,
                unit=meta['unit'], source=meta['dataset'], baseline=meta['baseline'], gridDegrees=grid['dLat'],
                cells=len(cells), cellIndices=cells, weights=normalized.round(12).tolist())


def main():
    manifest = json.loads((DATA/'trends/manifest.json').read_text())
    boundaries = json.loads((DATA/'maps/south-asia-boundaries.json').read_text())
    zones = json.loads((DATA/'trends/zones.json').read_text())['zones']
    series = {v: json.loads((DATA/f'trends/{v}_annual_series.json').read_text()) for v in ['temperature', 'rainfall']}
    places = []
    for feature in boundaries['features']:
        polygon = shape(feature['geometry'])
        lo0, la0, lo1, la1 = polygon.bounds
        signals = {v: country_signal(feature['geometry'], manifest['grids'][v], series[v], manifest['years'], manifest['variables'][v]) for v in series}
        places.append(dict(id=feature['id'].lower(), name=feature['properties']['name'], type='country', countryCode=feature['id'],
                           bounds=[[la0, lo0], [la1, lo1]], geometry=feature['geometry'], signals=signals))
    for z in zones:
        la0, la1, lo0, lo1 = z['bbox']
        signals = {}
        for v in series:
            r = z['results'].get(f'{v}_annual')
            meta = manifest['variables'][v]
            signals[v] = None if not r else dict(years=manifest['years'], series=r['series'], trend=r['trend'], unit=meta['unit'],
                           baseline=meta['baseline'], source=meta['dataset'], gridDegrees=manifest['grids'][v]['dLat'], cells=None)
        places.append(dict(id=z['id'], name='South Asia' if z['id']=='study-area' else z['name'], type='region',
                           bounds=[[la0, lo0], [la1, lo1]], geometry=mapping(box(lo0, la0, lo1, la1)), signals=signals))
    output = dict(generated=manifest['generated'], method='Country-land polygon overlap × cos(latitude), retained analysis cells; stats.py trend tests. Published rounded annual series.', places=places)
    (DATA/'maps/place-signals.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n')
    print(f'Wrote {len(places)} places with annual temperature and rainfall context')

if __name__ == '__main__':
    main()
