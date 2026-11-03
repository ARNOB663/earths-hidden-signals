"""Deterministic sample generator (plan §3.6, step 3).

Sample mode exists so the site and the CI determinism check can run before real data arrives.
Rules: fixed clock, seeded rng, `sampleData: true`, `basis: "sample"`, never mixed with a real
baseline, and the pipeline refuses `sampleData: false` when any input is a sample.

The series is synthetic but climatologically shaped: a wet season and a dry season per tile, year
to year variability, and a few extreme days, so the engine sees realistic percentiles and ratios.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import math
import random

SAMPLE_CLOCK = "2025-09-10T00:00:00Z"
SAMPLE_END = dt.date(2025, 9, 10)
SAMPLE_YEARS = range(2010, 2025)  # 15 baseline years, as the engine requires

# Seasonal shape per tile: (peak day-of-year, wet-season width in days, peak intensity mm/day).
SEASONS = {
    "bengal": (220, 90, 16.0),
    "indus": (210, 70, 11.0),
    "western-himalaya": (200, 80, 9.0),
}


def seed_for(tile_id: str) -> int:
    """Stable per tile, so two runs on any machine give the same bytes."""
    return int(hashlib.sha256(tile_id.encode()).hexdigest()[:8], 16)


def _tile_season(tile_id: str) -> tuple[int, int, float]:
    return SEASONS.get(tile_id, (210, 80, 10.0))


def season_factor(tile_id: str, day: dt.date) -> float:
    """0 in the dry season, up to 1 at the wet-season peak."""
    peak, width, _ = _tile_season(tile_id)
    doy = day.timetuple().tm_yday
    phase = 2 * math.pi * (doy - peak) / 365.0
    return max(0.0, math.cos(phase)) ** 2


def season_peak(tile_id: str, year: int) -> dt.date:
    """The wettest calendar day of `year` for this tile (the seasonal shape is annual)."""
    peak, _, _ = _tile_season(tile_id)
    day = dt.date(year, 1, 1)
    candidates = [day + dt.timedelta(days=n) for n in range(int(peak) - 2, int(peak) + 3)]
    return max(candidates, key=lambda d: season_factor(tile_id, d))


def series_for(tile_id: str, lat: float, lon: float) -> dict[dt.date, float]:
    """Daily rain in mm for one cell, 2010-01-01 to SAMPLE_END, byte-stable."""
    rng = random.Random(seed_for(tile_id) ^ (int(round(lat * 100)) * 7919) ^ int(round(lon * 100)))
    _, _, peak_mm = _tile_season(tile_id)
    # Tiles are wetter in the south of the box, like the real monsoon gradient.
    gradient = 0.75 + 0.5 * rng.random()
    out: dict[dt.date, float] = {}
    wet_state = 0.0
    day = dt.date(SAMPLE_YEARS.start, 1, 1)
    while day <= SAMPLE_END:
        factor = season_factor(tile_id, day)
        annual = 0.8 + 0.4 * rng.random()  # year-to-year variability
        wet_state = max(0.0, wet_state * 0.6 + rng.gauss(0, peak_mm * factor * gradient * annual))
        if factor > 0.05 and rng.random() < 0.004:  # rare extreme burst
            wet_state += rng.uniform(30, 90) * factor
        out[day] = round(wet_state, 1)
        day += dt.timedelta(days=1)
    return out


def assert_no_mixing(sample_data: bool, sources: list[dict]) -> None:
    """A run may not claim to be real while any input is a sample."""
    if sample_data:
        return
    sampled = [s.get("name", "?") for s in sources if s.get("status") == "sample" or s.get("sample")]
    if sampled:
        raise SystemExit(
            "refusing sampleData:false: these inputs are sample data -> " + ", ".join(sorted(sampled))
        )
