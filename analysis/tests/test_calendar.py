import calendar as stdlib_calendar
from datetime import date

from intel import periods
from intel.thresholds import BASELINE_YEARS, DAILY_BASELINE_YEARS


def test_baseline_is_thirty_years():
    assert BASELINE_YEARS[0] == 1991 and BASELINE_YEARS[-1] == 2020
    assert len(BASELINE_YEARS) == 30


def test_daily_baseline_is_twenty_four_years():
    assert DAILY_BASELINE_YEARS[0] == 1997 and DAILY_BASELINE_YEARS[-1] == 2020
    assert len(DAILY_BASELINE_YEARS) == 24


def test_stdlib_calendar_is_not_shadowed():
    # A top-level analysis/calendar.py would break build.py and latest.py.
    assert hasattr(stdlib_calendar, "monthrange")
    assert "site-packages" not in (stdlib_calendar.__file__ or "") and "analysis" not in (stdlib_calendar.__file__ or "")


def test_leap_years_and_short_months():
    assert periods.days_in_period(2024, "02") == 29
    assert periods.days_in_period(2023, "02") == 28
    assert periods.days_in_period(2024, "annual") == 366
    assert periods.days_in_period(2025, "monsoon") == 30 + 31 + 31 + 30
    assert periods.period_end(2024, "02") == date(2024, 2, 29)
    assert periods.period_start(2025, "pre-monsoon") == date(2025, 3, 1)


def test_gpcp_rate_converted_to_total_exactly_once():
    assert periods.monthly_total_mm(10.0, 2024, 2) == 290.0
    assert periods.monthly_total_mm(10.0, 2023, 2) == 280.0


def test_realtime_baseline_never_contains_the_assessed_year_or_later():
    for year in (2005, 2011, 2020, 2021, 2030):
        years = periods.realtime_baseline_years(year, daily=False)
        assert all(y < year for y in years)
        assert set(years) <= set(BASELINE_YEARS)
    assert periods.realtime_baseline_years(2021, daily=False) == BASELINE_YEARS


def test_chronological_order_uses_period_end():
    obs = [(2025, "annual"), (2025, "monsoon"), (2025, "pre-monsoon"), (2024, "monsoon")]
    assert periods.chronological(obs) == [(2024, "monsoon"), (2025, "pre-monsoon"), (2025, "monsoon"), (2025, "annual")]


def test_bangla_digits():
    assert periods.bn_num("2025") == "২০২৫"
    assert periods.bn_num(-3) == "−৩"
