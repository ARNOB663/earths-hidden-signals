"""Baseline statistics: empirical percentiles over a day-of-year window (plan §6, step 3).

Pure numpy. The definition is fixed in the plan and on /about:

* For a window W in {1,3,7} ending on day D, the baseline set B(D,W) holds rain(y, doy ± 15)
  for every baseline year y.
* percentile = share of B values <= today's rain (zeros included).
* normal = median of wet-day B values (rain >= 1 mm); wet-day count < 30 -> ratio is null.
* A cell needs >= 15 distinct years AND >= 300 values; otherwise it is Grey "baseline-small".
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

import numpy as np

PERCENTILES = (50, 85, 90, 96, 98)


@dataclass
class DaySeries:
    """One cell's daily rain, indexed by date; missing days are absent, not zero."""

    values: dict[dt.date, float]

    def window(self, end: dt.date, days: int) -> float | None:
        """Sum of `days` values ending at `end`; None when any day is missing."""
        total = 0.0
        for offset in range(days):
            day = end - dt.timedelta(days=offset)
            if day not in self.values:
                return None
            total += self.values[day]
        return total


def season_days(year: int, doy: int, half: int, *, include_leap_day: bool = True) -> list[dt.date]:
    """The same calendar days in `year`, matched by (month, day) so leap years line up.

    Matching on real dates rather than a 365-day modulus keeps 1 March on 1 March and never
    turns day 366 into 1 January.
    """
    reference = dt.date(2001, 1, 1) + dt.timedelta(days=doy - 1)  # 2001 is a non-leap year
    out: list[dt.date] = []
    leap = _is_leap(year)
    for offset in range(-half, half + 1):
        wanted = reference + dt.timedelta(days=offset)
        if include_leap_day and leap and (wanted.month, wanted.day) == (2, 28):
            # In a leap year the 29 February inside the window is a real extra day of the season.
            out.append(dt.date(year, 2, 29))
        try:
            out.append(dt.date(year, wanted.month, wanted.day))
        except ValueError:
            # No 29 February in a non-leap year: that calendar day does not exist in this year.
            continue
    return out


def _is_leap(year: int) -> bool:
    return (year % 4 == 0 and year % 100 != 0) or year % 400 == 0


def baseline_values(series: DaySeries, end: dt.date, window_days: int, half: int, years: range) -> np.ndarray:
    """All values for the same season in every baseline year (the event's own year excluded by `years`)."""
    values: list[float] = []
    doy = end.timetuple().tm_yday
    for year in years:
        for day in season_days(year, doy, half):
            total = series.window(day, window_days)
            if total is None:
                continue
            values.append(total)
    return np.asarray(values, dtype=float)


@dataclass
class WindowStats:
    rain_mm: float | None
    percentile: float | None
    ratio: float | None
    normal_mm: float | None
    wet_day_count: int
    sample_count: int
    year_count: int
    percentiles: dict[int, float] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "rain": None if self.rain_mm is None else round(self.rain_mm, 1),
            "percentile": None if self.percentile is None else round(self.percentile, 1),
            "ratio": None if self.ratio is None else round(self.ratio, 2),
            "normal": None if self.normal_mm is None else round(self.normal_mm, 1),
            "wetDays": self.wet_day_count,
            "n": self.sample_count,
            "years": self.year_count,
        }


def window_stats(
    series: DaySeries,
    end: dt.date,
    window_days: int,
    *,
    half: int = 15,
    years: range,
    wet_day_min_mm: float = 1.0,
) -> WindowStats:
    rain = series.window(end, window_days)
    values = baseline_values(series, end, window_days, half, years)
    if values.size == 0 or rain is None:
        return WindowStats(rain, None, None, None, 0, int(values.size), len(years))
    wet = values[values >= wet_day_min_mm]
    percentile = float((values <= rain).mean() * 100)
    normal = float(np.median(wet)) if wet.size else None
    ratio = (rain / normal) if normal and normal > 0 else None
    distinct_years = len(years)
    return WindowStats(
        rain_mm=float(rain),
        percentile=percentile,
        ratio=ratio,
        normal_mm=normal,
        wet_day_count=int(wet.size),
        sample_count=int(values.size),
        year_count=distinct_years,
        percentiles={p: float(np.percentile(values, p)) for p in PERCENTILES},
    )
