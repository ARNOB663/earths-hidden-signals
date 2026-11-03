"""Calendar periods: seasons and months, their dates, day counts and labels.

Named periods.py (not calendar.py) so it never shadows the standard-library calendar module.
"""

from __future__ import annotations

import calendar
from datetime import date

from .thresholds import BASELINE_YEARS, DAILY_BASELINE_YEARS

SEASON_MONTHS = {
    "annual": list(range(1, 13)),
    "pre-monsoon": [3, 4, 5],
    "monsoon": [6, 7, 8, 9],
}
MONTH_KEYS = [f"{m:02d}" for m in range(1, 13)]
SUB_ANNUAL = ["pre-monsoon", "monsoon", *MONTH_KEYS]

MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August",
             "September", "October", "November", "December"]
MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট",
             "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"]
BN_DIGITS = "০১২৩৪৫৬৭৮৯"


def bn_num(value) -> str:
    """Latin digits (and minus) to Bangla digits."""
    return "".join(BN_DIGITS[int(c)] if c.isdigit() else c for c in str(value)).replace("-", "−")


def months_of(period: str) -> list[int]:
    if period in SEASON_MONTHS:
        return SEASON_MONTHS[period]
    if period in MONTH_KEYS:
        return [int(period)]
    raise ValueError(f"unknown calendar period {period!r}")


def period_start(year: int, period: str) -> date:
    return date(year, months_of(period)[0], 1)


def period_end(year: int, period: str) -> date:
    last = months_of(period)[-1]
    return date(year, last, calendar.monthrange(year, last)[1])


def days_in_period(year: int, period: str) -> int:
    """Leap years and short months included."""
    return sum(calendar.monthrange(year, m)[1] for m in months_of(period))


def monthly_total_mm(rate_mm_per_day: float, year: int, month: int) -> float:
    """GPCP monthly values are a mean rate (mm/day). Convert to a monthly total exactly once."""
    return rate_mm_per_day * calendar.monthrange(year, month)[1]


def baseline_years(daily: bool) -> list[int]:
    return DAILY_BASELINE_YEARS if daily else BASELINE_YEARS


def realtime_baseline_years(year: int, daily: bool) -> list[int]:
    """The baseline an assessment made at the end of `year` could have used: baseline years
    strictly before `year`. From 2021 on this is the full 1991-2020 normal; before that it is
    the part of the normal that already existed (so no future value leaks into the past)."""
    return [y for y in baseline_years(daily) if y < year]


def label(period: str, year: int, lang: str = "en") -> str:
    if lang == "bn":
        y = bn_num(year)
        if period == "annual":
            return f"{y} সাল"
        if period == "pre-monsoon":
            return f"{y} সালের প্রাক-বর্ষা (মার্চ–মে)"
        if period == "monsoon":
            return f"{y} সালের বর্ষা (জুন–সেপ্টেম্বর)"
        return f"{MONTHS_BN[int(period) - 1]} {y}"
    if period == "annual":
        return f"the year {year}"
    if period == "pre-monsoon":
        return f"the {year} pre-monsoon (Mar–May)"
    if period == "monsoon":
        return f"the {year} monsoon (Jun–Sep)"
    return f"{MONTHS_EN[int(period) - 1]} {year}"


def chronological(observations: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Sort (year, period) pairs by the period's end date."""
    return sorted(observations, key=lambda yp: (period_end(*yp), -len(months_of(yp[1]))))
