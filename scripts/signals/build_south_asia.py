"""The Signals map's context layer: the analysis pipeline's own South Asia trend grids.

Run from the repo root with the analysis venv (``python scripts/signals/build_south_asia.py``). It
reads only committed files, so it is offline and deterministic, and writes
``web/public/data/signals/south-asia/``:

* ``{variable}_annual.json``  — extent, unit, colour stops and provenance.
* ``{variable}_annual.rgb``   — one packed RGB triple per grid cell, south edge first.
* ``{variable}_annual.alpha`` — one alpha byte per cell (0 where the pipeline has no value).

The grid is the pipeline's own cell centres at their native spacing, not resampled: a coarse
analysis grid drawn as a smooth field would be false precision. The map draws it cell by cell under
the area outlines, and the legend names the years and the unit.

Rain is expressed as a percentage of the 1981–2025 mean at the same cell, so one colour scale is
comparable across a wet delta and a dry plain.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
TRENDS = ROOT / "web" / "public" / "data" / "trends"
OUT = ROOT / "web" / "public" / "data" / "signals" / "south-asia"

STOPS = [
    (0, (232, 222, 200)),
    (20, (210, 214, 150)),
    (40, (110, 160, 110)),
    (60, (45, 110, 160)),
    (80, (60, 60, 140)),
    (100, (90, 30, 90)),
]


def colour(values: np.ndarray, low: float, high: float) -> tuple[bytes, bytes]:
    """Piecewise-linear ramp from the file's own stops; NaN becomes alpha 0."""
    t = np.clip((values - low) / ((high - low) or 1) * 100, 0, 100)
    out = np.zeros(values.shape + (3,), dtype=np.uint8)
    for (p0, c0), (p1, c1) in zip(STOPS, STOPS[1:]):
        mask = (t >= p0) & (t <= p1)
        f = ((t[mask] - p0) / (p1 - p0))[:, None] if p1 > p0 else np.zeros((int(mask.sum()), 1))
        out[mask] = (np.array(c0) * (1 - f) + np.array(c1) * f).round().astype(np.uint8)
    alpha = np.where(np.isnan(values), 0, 255).astype(np.uint8)
    return out.tobytes(), alpha.tobytes()


def cell_values(manifest: dict, stats: dict, var: str, as_percent: bool) -> dict[tuple[float, float], float]:
    grid = manifest["grids"][var]
    lat = grid["lat0"] + np.arange(grid["nLat"]) * grid["dLat"]
    lon = grid["lon0"] + np.arange(grid["nLon"]) * grid["dLon"]
    series = json.loads((TRENDS / f"{var}_annual_series.json").read_text(encoding="utf-8"))
    slopes = stats["slopePerDecade"]
    out: dict[tuple[float, float], float] = {}
    for a in range(grid["nLat"]):
        for b in range(grid["nLon"]):
            index = a * grid["nLon"] + b
            value = slopes[index]
            if value is None:
                continue
            if as_percent:
                years = [v for v in (series[index] or []) if v is not None]
                if not years:
                    continue
                normal = sum(years) / len(years)
                if not normal:
                    continue
                value = value / normal * 100
            out[(round(float(lat[a]), 2), round(float(lon[b]), 2))] = float(value)
    return out


def write_variable(manifest: dict, key: str, var: str, label_en: str, label_bn: str, low: float, high: float, unit: str, as_percent: bool) -> None:
    stats = json.loads((TRENDS / f"{var}_annual.json").read_text(encoding="utf-8"))
    grid = manifest["grids"][var]
    values = cell_values(manifest, stats, var, as_percent)
    # Keep the pipeline's spacing: the cells are drawn at their own resolution, gaps included.
    values_grid = np.full((grid["nLat"], grid["nLon"]), np.nan)
    for a in range(grid["nLat"]):
        for b in range(grid["nLon"]):
            la = round(float(grid["lat0"] + a * grid["dLat"]), 2)
            lo = round(float(grid["lon0"] + b * grid["dLon"]), 2)
            if (la, lo) in values:
                values_grid[a, b] = values[(la, lo)]
    rgb, alpha = colour(values_grid, low, high)
    years = manifest["years"]
    payload = {
        "variable": var,
        "season": "annual",
        "label": label_en,
        "labelBn": label_bn,
        "unit": unit,
        "range": [low, high],
        "legend": [{"at": at, "rgb": list(rgb_stop)} for at, rgb_stop in STOPS],
        "lat0": grid["lat0"],
        "lon0": grid["lon0"],
        "dLat": grid["dLat"],
        "dLon": grid["dLon"],
        "nLat": grid["nLat"],
        "nLon": grid["nLon"],
        "yearFirst": years[0],
        "yearLast": years[-1],
        "cellsWithData": len(values),
        "dataset": stats.get("dataset") or "NASA GISTEMP v4 / GPCP (analysis pipeline)",
        "source": "Sen slope per decade from web/public/data/trends; drawn at the analysis grid's own cell centres.",
        "updated": dt.date.today().isoformat(),
    }
    (OUT / f"{key}.rgb").write_bytes(rgb)
    (OUT / f"{key}.alpha").write_bytes(alpha)
    (OUT / f"{key}.json").write_text(json.dumps(payload, sort_keys=True, separators=(",", ":")), encoding="utf-8")
    print(f"{key}: {len(values)} cells with data of {grid['nLat'] * grid['nLon']}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((TRENDS / "manifest.json").read_text(encoding="utf-8"))
    write_variable(manifest, "temperature_annual", "temperature", "Temperature change", "তাপমাত্রার পরিবর্তন", 0.0, 0.6, "°C/decade", False)
    write_variable(manifest, "rainfall_annual", "rainfall", "Rain change", "বৃষ্টির পরিবর্তন", -6.0, 6.0, "%/decade", True)
    (OUT / "index.json").write_text(
        json.dumps(
            {
                "default": "temperature_annual",
                "variables": [
                    {"key": "temperature_annual", "label": "Temperature change", "labelBn": "তাপমাত্রার পরিবর্তন"},
                    {"key": "rainfall_annual", "label": "Rain change", "labelBn": "বৃষ্টির পরিবর্তন"},
                ],
            },
            sort_keys=True,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    for stale in ("default.json",):
        (OUT / stale).unlink(missing_ok=True)
    print("south-asia written")


if __name__ == "__main__":
    main()
