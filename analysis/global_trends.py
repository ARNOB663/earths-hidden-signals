"""Global trends: the same tests as the South Asia trend map, for every land grid cell on Earth.

Uses the global NASA records already downloaded for build.py (GISTEMP v4 temperature, 2 degrees;
GPCP v2.3 monthly rain, 2.5 degrees) and the Natural Earth land mask cached by twins.py. For each
land cell (at least 35% land, 55S-75N) and each series it runs the Hamed-Rao Mann-Kendall test with
Sen's slope (stats.trend) and Benjamini-Hochberg control across the map (stats.fdr_significant),
exactly as the South Asia map does.

Series per cell:
- temperature: annual mean anomaly (deg C per decade)
- rainfall:    annual total (% of the cell's mean per decade, so wet and dry places compare)
- wet season:  the cell's own four wettest consecutive months (% per decade); hemisphere-neutral

Also writes the global land-mean temperature series (area-weighted) for the warming stripes and
global disaster counts (GDACS floods, droughts, tropical cyclones 2000-2025; NASA Global Landslide
Catalog), reusing twins.py's cached catalogues.

    python global_trends.py        # offline after twins.py has run once
"""

from __future__ import annotations

import json
import warnings
from datetime import date

import numpy as np

import twins
from stats import fdr_significant, trend

OUT = twins.ROOT.parent / "web" / "public" / "data" / "global"
YEARS = twins.YEARS
LAT_RANGE = (-55.0, 75.0)
MIN_LAND = 0.35


def cell_trends(series: np.ndarray, scale: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    """series[years, lat, lon] -> (slope per decade, p) per cell; NaN where data is missing."""
    _, ny, nx = series.shape
    slope = np.full((ny, nx), np.nan)
    p = np.full((ny, nx), np.nan)
    for i in range(ny):
        for j in range(nx):
            y = series[:, i, j]
            if not np.isfinite(y).all():
                continue
            t = trend(y)
            if t is None:
                continue
            slope[i, j] = t.slope * 10 * (scale[i, j] if scale is not None else 1.0)
            p[i, j] = t.p
    return slope, p


def grid_payload(lats, lons, d, slope, sig, decimals) -> dict:
    cells = []
    for i in range(lats.size):
        for j in range(lons.size):
            if np.isfinite(slope[i, j]):
                cells.append([round(float(lats[i]), 2), round(float(lons[j]), 2), round(float(slope[i, j]), decimals), int(sig[i, j])])
    return {"cell": d, "cells": cells}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    land = twins.land_geometry()
    print("Loading GISTEMP and GPCP (global)")
    t_lats, t_lons, temp = twins.load_gistemp()
    r_lats, r_lons, rain = twins.load_gpcp()
    t_land = twins.cached_land_fraction("gistemp2", t_lats, t_lons, 2.0, 2.0, land)
    r_land = twins.cached_land_fraction("gpcp25", r_lats, r_lons, 2.5, 2.5, land)

    def keep(lats, frac):
        band = (lats >= LAT_RANGE[0]) & (lats <= LAT_RANGE[1])
        return (frac >= MIN_LAND) & band[:, None]

    # Temperature: annual mean anomaly per cell.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        t_annual = np.nanmean(temp, axis=1)
    t_annual[:, ~keep(t_lats, t_land)] = np.nan
    print("Temperature trends")
    t_slope, t_p = cell_trends(t_annual)

    # Rainfall: annual total and the local wet season, both as % of the cell's mean per decade.
    r_annual = rain.sum(axis=1)
    r_annual[:, ~keep(r_lats, r_land)] = np.nan
    clim = np.nanmean(rain[:30], axis=0)  # 1981-2010 monthly climatology [12, lat, lon]
    wet = np.full_like(r_annual, np.nan)
    for i in range(r_lats.size):
        for j in range(r_lons.size):
            if np.isfinite(r_annual[:, i, j]).all():
                months = twins.wettest_months(clim[:, i, j])
                wet[:, i, j] = rain[:, months, i, j].sum(axis=1)
    with np.errstate(divide="ignore", invalid="ignore"):
        r_scale = np.where(r_annual.mean(axis=0) >= 50, 100.0 / r_annual.mean(axis=0), np.nan)
        w_scale = np.where(wet.mean(axis=0) >= 30, 100.0 / wet.mean(axis=0), np.nan)
    print("Rainfall trends")
    r_slope, r_p = cell_trends(r_annual, r_scale)
    w_slope, w_p = cell_trends(wet, w_scale)

    def fdr(p):
        sig = np.zeros(p.shape, dtype=bool)
        ok = np.isfinite(p)
        sig[ok] = fdr_significant(p[ok])
        return sig

    t_sig, r_sig, w_sig = fdr(t_p), fdr(r_p), fdr(w_p)

    # Global land-mean temperature (area-weighted), for the stripes.
    wts = t_land * np.cos(np.deg2rad(t_lats))[:, None] * keep(t_lats, t_land)
    land_mean = [
        round(float(np.nansum(t_annual[k] * wts) / np.nansum(np.where(np.isfinite(t_annual[k]), wts, 0))), 3)
        for k in range(len(YEARS))
    ]
    lm = trend(np.array(land_mean))

    def count(slope, sig):
        ok = np.isfinite(slope)
        return {
            "cells": int(ok.sum()),
            "increase": int((sig & (slope > 0)).sum()),
            "decrease": int((sig & (slope < 0)).sum()),
        }

    events = twins.global_events()
    ev_counts = {k: sum(1 for e in events if e["type"] == k) for k in ("flood", "drought", "cyclone", "landslide")}
    severe = {k: sum(1 for e in events if e["type"] == k and e["alert"] in ("Orange", "Red")) for k in ev_counts}

    summary = {
        "generated": date.today().isoformat(),
        "years": [YEARS[0], YEARS[-1]],
        "method": "Hamed-Rao Mann-Kendall, Sen's slope, Benjamini-Hochberg (alpha_FDR 0.10) across land cells; NASA GISTEMP v4, GPCP v2.3",
        "landMean": {
            "series": land_mean,
            "perDecade": round(lm.slope * 10, 3),
            "p": round(float(lm.p), 6),
            "total": round(lm.slope * (YEARS[-1] - YEARS[0]), 2),
        },
        "temperature": count(t_slope, t_sig),
        "rainfall": count(r_slope, r_sig),
        "wetSeason": count(w_slope, w_sig),
        "events": {"all": ev_counts, "severe": severe, "years": [2000, 2025], "landslideYears": [2007, 2017]},
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")

    # Climate-twin fingerprint for every rain cell (2.5 degrees): warming (nearest temperature cell),
    # yearly and rainy-season rain trends (% per decade), how wet (log10 mm) and how seasonal. Same
    # features and weights as twins.py, robustly standardised over land; names via Natural Earth.
    countries = twins.load_countries()
    r_mean = r_annual.mean(axis=0)
    w_mean = wet.mean(axis=0)
    feats, where = [], []
    for i, la in enumerate(r_lats):
        for j, lo in enumerate(r_lons):
            if not (np.isfinite(r_slope[i, j]) and np.isfinite(w_slope[i, j]) and r_mean[i, j] > 0):
                continue
            ti = int(np.argmin(np.abs(t_lats - la)))
            tj = int(np.argmin(np.abs(t_lons - lo)))
            if not np.isfinite(t_slope[ti, tj]):
                continue
            feats.append([t_slope[ti, tj], r_slope[i, j], w_slope[i, j], np.log10(r_mean[i, j]), w_mean[i, j] / r_mean[i, j]])
            where.append((float(la), float(lo)))
    F = np.array(feats)
    med = np.median(F, axis=0)
    scale = (np.percentile(F, 75, axis=0) - np.percentile(F, 25, axis=0)) / 1.349
    scale = np.where(scale > 0, scale, 1.0)
    weights = [w for *_, w in twins.FEATURES]
    twin_cells = []
    for (la, lo), f in zip(where, F):
        name, _ = twins.block_name((la - 1.25, la + 1.25, lo - 1.25, lo + 1.25), countries)
        twin_cells.append([la, lo, name, *[round(float(v), 3) for v in f]])
    (OUT / "twins-grid.json").write_text(
        json.dumps({"features": [k for k, *_ in twins.FEATURES], "weights": weights,
                    "median": [round(float(v), 4) for v in med], "scale": [round(float(v), 4) for v in scale],
                    "cells": twin_cells}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Per-cell annual temperature series for each place's own warming stripes, in 30-degree tiles so a
    # page loads only the tile it needs.
    tiles: dict[str, dict[str, list]] = {}
    for i, la in enumerate(t_lats):
        for j, lo in enumerate(t_lons):
            ser = t_annual[:, i, j]
            if not np.isfinite(ser).all():
                continue
            tile = f"{int(np.floor(la / 30) * 30)}_{int(np.floor(lo / 30) * 30)}"
            tiles.setdefault(tile, {})[f"{la:g},{lo:g}"] = [round(float(v), 2) for v in ser]
    (OUT / "stripes").mkdir(exist_ok=True)
    for tile, cells in tiles.items():
        (OUT / "stripes" / f"{tile}.json").write_text(json.dumps(cells, separators=(",", ":")), encoding="utf-8")

    # Recorded disasters on a 1-degree grid (cell centre, counts per type), for the place report.
    kinds = ("flood", "cyclone", "drought", "landslide")
    grid: dict[tuple[float, float], list[int]] = {}
    for e in events:
        key = (np.floor(e["lat"]) + 0.5, np.floor(e["lon"]) + 0.5)
        grid.setdefault(key, [0, 0, 0, 0])[kinds.index(e["type"])] += 1
    (OUT / "events-grid.json").write_text(
        json.dumps({"kinds": kinds, "years": {"gdacs": [2000, 2025], "landslide": [2007, 2017]},
                    "cells": [[float(k[0]), float(k[1]), *v] for k, v in sorted(grid.items())]}, separators=(",", ":")),
        encoding="utf-8",
    )
    for name, lats, lons, d, slope, sig, dec in (
        ("temperature", t_lats, t_lons, 2.0, t_slope, t_sig, 3),
        ("wet-season", r_lats, r_lons, 2.5, w_slope, w_sig, 2),
        ("rainfall", r_lats, r_lons, 2.5, r_slope, r_sig, 2),
    ):
        (OUT / f"{name}.json").write_text(json.dumps(grid_payload(lats, lons, d, slope, sig, dec), separators=(",", ":")), encoding="utf-8")

    print(f"Land mean: {summary['landMean']['perDecade']:+.3f} C/decade, {summary['landMean']['total']:+.2f} C since {YEARS[0]}")
    for k in ("temperature", "rainfall", "wetSeason"):
        c = summary[k]
        print(f"  {k:12s} cells {c['cells']}, clear increase {c['increase']}, clear decrease {c['decrease']}")
    print(f"  events {ev_counts}, severe {severe}")


if __name__ == "__main__":
    main()
