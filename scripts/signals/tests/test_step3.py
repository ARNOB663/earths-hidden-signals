"""Step 3 tests: baseline maths, status mapping, Grey precedence, confidence, sample, budgets."""

from __future__ import annotations

import datetime as dt
import importlib.util
import json
import re
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parents[1]


def load(name: str):
    spec = importlib.util.spec_from_file_location(f"signals_{name}", HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


baseline = load("baseline")
engine = load("engine")
sample = load("sample")
writer = load("writer")
tiles_mod = load("tiles")

CONFIG = tiles_mod.load_config()


def reading(rain, pct, ratio, n=1200, years=20, valid=1.0, days=3):
    return engine.WindowReading(days=days, rain_mm=rain, percentile=pct, ratio=ratio,
                                sample_count=n, year_count=years, valid_fraction=valid)


# ---------------------------------------------------------------------------------------
# Status mapping
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("window", "want"),
    [
        (reading(60, 97, 3.5), "red"),
        (reading(60, 96, 3.0), "red"),
        (reading(60, 95.9, 5.0), "yellow"),  # high ratio, percentile short of red
        (reading(12, 86, 2.1), "yellow"),
        (reading(9.9, 99, 6.0), "green"),  # tiny rain cannot escalate
        (reading(40, 60, 3.0), "green"),  # low percentile, big rain
        (reading(40, 99, 1.2), "green"),  # percentile high but not unusual vs wet days
        (reading(0, 0, None), "green"),
    ],
)
def test_mapping_table(window, want) -> None:
    assert engine.evaluate([window], CONFIG).status == want


def test_drizzle_can_never_be_yellow_or_red() -> None:
    for mm in (0.2, 1.0, 4.5, 9.99):
        assert engine.evaluate([reading(mm, 99.9, 12.0)], CONFIG).status == "green"


def test_arid_cell_with_null_ratio_uses_percentile_and_mm_floor() -> None:
    assert engine.evaluate([reading(30, 97, None)], CONFIG).status == "red"
    assert engine.evaluate([reading(12, 88, None)], CONFIG).status == "yellow"
    verdict = engine.evaluate([reading(12, 88, None)], CONFIG)
    assert verdict.confidence == "low"  # capped when the ratio is unavailable


def test_status_is_the_highest_across_windows() -> None:
    windows = [reading(2, 50, 1.0, days=1), reading(70, 99, 4.0, days=3), reading(10, 60, 1.1, days=7)]
    verdict = engine.evaluate(windows, CONFIG)
    assert verdict.status == "red" and verdict.window_days == 3


def test_ratio_text_matches_the_promise() -> None:
    window = reading(60.0, 97, 2.6, days=3)
    verdict = engine.evaluate([window], CONFIG)
    assert engine.reason_text(verdict, [window]) == "3-day rain 2.6x normal for this date (60.0 mm)"


# ---------------------------------------------------------------------------------------
# Grey precedence
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("kwargs", "windows", "reason"),
    [
        ({}, [], "no-data"),
        ({"stale": True}, [reading(200, 99.9, 9.0)], "stale"),
        ({}, [reading(200, 99.9, 9.0, valid=0.5)], "low-coverage"),
        ({}, [reading(200, 99.9, 9.0, n=100, years=10)], "baseline-small"),
        ({"outside_coverage": True}, [reading(200, 99.9, 9.0)], "out-of-coverage"),
    ],
)
def test_grey_beats_any_rain(kwargs, windows, reason) -> None:
    verdict = engine.evaluate(windows, CONFIG, **kwargs)
    assert verdict.status == "grey" and verdict.reason == reason


def test_stale_does_not_apply_to_sample_runs() -> None:
    verdict = engine.evaluate([reading(60, 97, 3.5)], CONFIG, stale=True, basis="sample")
    assert verdict.status == "red"


def test_grey_shows_no_numbers() -> None:
    text = engine.GREY_REASONS["stale"]
    assert not re.search(r"\d", text)


# ---------------------------------------------------------------------------------------
# Confidence enum
# ---------------------------------------------------------------------------------------
def test_confidence_is_only_three_words() -> None:
    for window in (reading(60, 97, 3.5), reading(60, 86, 2.1), reading(12, 88, None), reading(0, 10, 0.2)):
        verdict = engine.evaluate([window], CONFIG)
        assert verdict.confidence in ("low", "medium", "high")
        assert "%" not in verdict.confidence


def test_confidence_rises_with_depth() -> None:
    deep = engine.evaluate([reading(80, 99, 5.0, n=4800, years=25)], CONFIG)
    thin = engine.evaluate([reading(80, 86, 2.2, n=800, years=18)], CONFIG)
    shallow = engine.evaluate([reading(80, 86, 2.2, n=310, years=15)], CONFIG)
    assert deep.confidence == "high"
    assert thin.confidence == "medium"
    assert shallow.confidence == "low"


# ---------------------------------------------------------------------------------------
# Baseline maths
# ---------------------------------------------------------------------------------------
baseline.season_factor_test = lambda day: abs(day.month - 8) <= 1  # Aug-Sep wet season for fixtures


def multi_year(values_by_year) -> baseline.DaySeries:
    days = {}
    for year, fn in values_by_year.items():
        for n in range(366):
            day = dt.date(year, 1, 1) + dt.timedelta(days=n)
            days[day] = fn(day)
    return baseline.DaySeries(days)


def test_percentile_handles_zero_heavy_data() -> None:
    series = multi_year({y: (lambda d: 0.0 if d.timetuple().tm_yday % 7 else 4.0) for y in range(2005, 2025)})
    series.values[dt.date(2025, 8, 31)] = 4.0
    stats = baseline.window_stats(series, dt.date(2025, 8, 31), 1, half=15, years=range(2005, 2025))
    assert stats.rain_mm is not None
    assert 0 <= stats.percentile <= 100
    assert stats.sample_count == 31 * 20  # zeros are included in the reference set
    # Zeros dominate, so the median reference value is 0 and a 4 mm day is rare, not extreme.
    assert stats.percentiles[50] == 0.0
    assert stats.percentile == 100  # 4 mm is the wettest value this fixture has
    quiet = baseline.window_stats(series, dt.date(2025, 8, 31), 1, half=15, years=range(2005, 2025))
    assert quiet.percentile == stats.percentile  # zeros cannot push a dry day high


def test_rain_hand_computed_ratio() -> None:
    # Every baseline day is 15 mm in the season, so the wet-day median is 15 and rain 42 -> 2.8.
    series = multi_year({y: (lambda d: 15.0) for y in range(2005, 2020)})
    series.values[dt.date(2025, 8, 31)] = 42.0
    stats = baseline.window_stats(series, dt.date(2025, 8, 31), 1, half=15, years=range(2005, 2020))
    assert stats.rain_mm == pytest.approx(42.0)
    assert stats.ratio == pytest.approx(2.8)


def test_ratio_null_when_wet_days_are_few() -> None:
    series = multi_year({y: (lambda d: 5.0 if d.month == 8 and d.day == 31 else 0.0) for y in range(2005, 2020)})
    series.values[dt.date(2025, 8, 31)] = 3.0
    stats = baseline.window_stats(series, dt.date(2025, 8, 31), 1, half=15, years=range(2005, 2020))
    assert stats.wet_day_count < 30
    window = engine.WindowReading(days=1, rain_mm=stats.rain_mm, percentile=stats.percentile, ratio=None,
                                  sample_count=stats.sample_count, year_count=stats.year_count)
    assert window.ratio is None


def test_leap_day_maps_to_the_same_season() -> None:
    # doy 59 is 28 February in a non-leap year, so the window reaches 29 February in 2020.
    leap = baseline.season_days(2020, 59, 2)
    plain = baseline.season_days(2021, 59, 2)
    assert dt.date(2020, 2, 29) in leap
    assert dt.date(2021, 2, 28) in plain
    assert dt.date(2021, 3, 1) in plain


def test_own_year_is_excluded_from_replay_baseline() -> None:
    # A wet season in 2019 that is otherwise as ordinary as every other year.
    series = multi_year({y: (lambda d: 10.0 if baseline.season_factor_test(d) else 0.0) for y in range(2005, 2021)})
    for day_offset in range(-3, 4):
        series.values[dt.date(2019, 8, 31) + dt.timedelta(days=day_offset)] = 90.0
    excluded = baseline.window_stats(series, dt.date(2019, 8, 31), 3, half=15, years=range(2005, 2019))
    included = baseline.window_stats(series, dt.date(2019, 8, 31), 3, half=15, years=range(2005, 2020))
    assert excluded.rain_mm == pytest.approx(270.0)
    # The event year is absent from its own reference set: same median, smaller sample.
    assert excluded.normal_mm == pytest.approx(30.0)
    assert excluded.sample_count < included.sample_count
    assert excluded.year_count == 14 and included.year_count == 15


# ---------------------------------------------------------------------------------------
# Sample mode
# ---------------------------------------------------------------------------------------
def test_sample_is_deterministic() -> None:
    first = sample.series_for("bengal", 25.5, 88.5)
    second = sample.series_for("bengal", 25.5, 88.5)
    assert first == second


def test_sample_clock_is_fixed_and_not_before_any_tile_day() -> None:
    assert sample.SAMPLE_CLOCK == CONFIG["sampleClock"]
    assert sample.SAMPLE_CLOCK.startswith(sample.SAMPLE_END.isoformat())


def test_sample_refuses_to_be_called_real() -> None:
    with pytest.raises(SystemExit):
        sample.assert_no_mixing(False, [{"name": "imerg-late", "status": "sample"}])
    sample.assert_no_mixing(True, [{"name": "imerg-late", "status": "sample"}])


def test_sample_committed_outputs_are_consistent() -> None:
    meta = json.loads((writer.OUT / "meta.json").read_text())
    assert meta["sampleData"] is True and meta["basis"] == "sample"
    for tile in CONFIG["enabledTiles"]:
        grid = json.loads((writer.OUT / "grid" / f"{tile['id']}.json").read_text())
        assert len(grid["cells"]) == 100
        for cell in grid["cells"]:
            assert cell["status"] in ("green", "yellow", "red", "grey")
            assert cell["confidence"] in ("low", "medium", "high")


# ---------------------------------------------------------------------------------------
# Step 1a: sample cells sit on the tile grid (never a diagonal)
# ---------------------------------------------------------------------------------------
def committed_grid(tile_id: str) -> dict:
    return json.loads((writer.OUT / "grid" / f"{tile_id}.json").read_text())


@pytest.mark.parametrize("tile", tiles_mod.tiles(CONFIG), ids=lambda t: t.id)
def test_every_sample_cell_centre_is_inside_its_tile(tile: tiles_mod.Tile) -> None:
    cells = committed_grid(tile.id)["cells"]
    for cell in cells:
        assert tile.south <= cell["lat"] < tile.north, cell
        assert tile.west <= cell["lon"] < tile.east, cell


@pytest.mark.parametrize("tile", tiles_mod.tiles(CONFIG), ids=lambda t: t.id)
def test_sample_cell_set_is_the_tile_grid(tile: tiles_mod.Tile) -> None:
    cells = committed_grid(tile.id)["cells"]
    side = CONFIG["tileDeg"] // 1
    assert len(cells) == side * side
    got = {(cell["lat"], cell["lon"]) for cell in cells}
    assert got == set(tile.grid(1))
    assert len(got) == len(cells)


def test_bengal_sample_covers_the_delta_centre_not_only_a_corner() -> None:
    bengal = next(tile for tile in tiles_mod.tiles(CONFIG) if tile.id == "bengal")
    cells = committed_grid("bengal")["cells"]
    near = [c for c in cells if abs(c["lat"] - 22) <= 0.5 and abs(c["lon"] - 90) <= 0.5]
    assert near, "no sampled cell within 0.5 deg of 22N 90E"
    lons = sorted({c["lon"] for c in cells})
    lats = sorted({c["lat"] for c in cells})
    assert lons == [85.5 + i for i in range(10)] and lats == [20.5 + i for i in range(10)]
    assert bengal.contains(22.5, 90.5)


# ---------------------------------------------------------------------------------------
# Step 1c: the sample shows all four statuses, produced by the real engine
# ---------------------------------------------------------------------------------------
def test_every_tile_shows_all_four_statuses() -> None:
    for tile in tiles_mod.tiles(CONFIG):
        histogram = {}
        for cell in committed_grid(tile.id)["cells"]:
            histogram[cell["status"]] = histogram.get(cell["status"], 0) + 1
        for status in ("red", "yellow", "green", "grey"):
            assert histogram.get(status, 0) >= 2, f"{tile.id}: {status} x{histogram.get(status, 0)}"


def test_red_cells_carry_the_engine_reason_and_meet_red_rules() -> None:
    rules = CONFIG["red"]
    for tile in tiles_mod.tiles(CONFIG):
        for cell in committed_grid(tile.id)["cells"]:
            if cell["status"] != "red":
                continue
            assert cell["reason"] == "ratio", cell
            assert cell["percentile"] >= rules["percentile"]
            assert cell["ratio"] >= rules["ratio"]
            window = f"day{cell['windowDays']}"
            assert cell[window] is not None and cell[window] >= rules["mm"]


def test_grey_cells_are_baseline_small_from_a_short_baseline() -> None:
    for tile in tiles_mod.tiles(CONFIG):
        grey = [c for c in committed_grid(tile.id)["cells"] if c["status"] == "grey"]
        assert grey and all(c["reason"] == "baseline-small" for c in grey)
        assert all(c["reasonText"] == engine.GREY_REASONS["baseline-small"] for c in grey)
        assert all(c["day1"] is None and c["day3"] is None and c["day7"] is None for c in grey)


def test_grey_thinning_covers_exactly_one_cell_per_tile() -> None:
    import build

    thinned = [(r, c) for r in range(10) for c in range(10) if build.sample_years(r, c) is not build.BASELINE_YEARS]
    top, left = build.GREY_BOX
    assert thinned == [(r, c) for r in range(top, top + 2) for c in range(left, left + 2)]
    assert len(build.THINNED_YEARS) < CONFIG["baselineYearsMin"]


def test_status_is_never_written_without_the_engine() -> None:
    """The sample builder assigns no status: every status comes from engine.evaluate."""
    source = (HERE / "build.py").read_text()
    assert not re.search(r"status\s*=\s*[\"'](green|yellow|red|grey)[\"']", source)
    assert "engine.evaluate(" in source
    assert not re.search(r"(set|write)_?status", source)


def test_top_json_mixes_red_and_yellow_and_all_tiles() -> None:
    top = json.loads((writer.OUT / "top.json").read_text())
    rows = top["rows"]
    assert {"red", "yellow"} <= {row["status"] for row in rows}
    assert {row["tile"] for row in rows} == {tile.id for tile in tiles_mod.tiles(CONFIG)}
    assert rows[0]["status"] == "red"
    assert len(rows) <= 24


def test_sample_meta_is_not_ahead_of_any_tile() -> None:
    import build

    meta = json.loads((writer.OUT / "meta.json").read_text())
    assert meta["clock"] == sample.SAMPLE_CLOCK and meta["sampleData"] is True
    for tile_id, end in build.sample_ends().items():
        assert build.sample_day(end, tile_id) <= sample.SAMPLE_END, tile_id


# ---------------------------------------------------------------------------------------
# Budgets and copying
# ---------------------------------------------------------------------------------------
def test_config_copy_is_byte_identical() -> None:
    writer.write_config_copy()
    assert (writer.OUT / "config.json").read_bytes() == (HERE / "config.json").read_bytes()


def test_budget_check_rejects_oversize() -> None:
    with pytest.raises(writer.BudgetError):
        writer.check_budget("grid/x.json", 300_000, CONFIG["budgets"]["gridBytes"])


def test_committed_files_are_within_budget() -> None:
    for path in (writer.OUT / "grid").glob("*.json"):
        assert path.stat().st_size <= CONFIG["budgets"]["gridBytes"]
    assert (writer.OUT / "meta.json").stat().st_size < 64 * 1024


# ---------------------------------------------------------------------------------------
# Wording and no country coupling
# ---------------------------------------------------------------------------------------
def test_green_sentence_is_exact() -> None:
    assert engine.GREEN_TEXT_EN == "No unusual signal in our data. Always follow official warnings."


def test_no_forbidden_words_in_sources() -> None:
    for path in (HERE).glob("*.py"):
        text = path.read_text()
        assert "false alarm" not in text.lower(), path.name
        for word in ("bangladesh", "pakistan", "sri lanka"):
            assert word not in text.lower(), f"{path.name} mentions {word}"


# ---------------------------------------------------------------------------------------
# Step 4: what-to-watch reads the archive and never invents a rise
# ---------------------------------------------------------------------------------------
watch_mod = load("watch")


def test_watch_with_one_entry_has_no_rises(tmp_path) -> None:
    (tmp_path / "2025-08-31.json").write_text(
        json.dumps({"date": "2025-08-31", "sample": True, "rises": []}), encoding="utf-8"
    )
    summary = watch_mod.summary(watch_mod.read_archive(tmp_path))
    assert summary["entries"] == 1 and summary["previous"] is None and summary["rises"] == []


def test_watch_reports_only_real_rises_between_the_last_two_entries(tmp_path) -> None:
    for day, status in (("2025-09-01", "green"), ("2025-09-02", "red")):
        payload = {"date": day, "sample": False, "rises": [{"lat": 22.5, "lon": 90.5, "date": day, "status": status}]}
        (tmp_path / f"{day}.json").write_text(json.dumps(payload), encoding="utf-8")
    summary = watch_mod.summary(watch_mod.read_archive(tmp_path))
    assert len(summary["rises"]) == 1
    assert summary["rises"][0]["from"] == "green" and summary["rises"][0]["status"] == "red"


def test_watch_ignores_sample_archives(tmp_path) -> None:
    for day, status in (("2025-09-01", "green"), ("2025-09-02", "red")):
        payload = {"date": day, "sample": True, "rises": [{"lat": 22.5, "lon": 90.5, "date": day, "status": status}]}
        (tmp_path / f"{day}.json").write_text(json.dumps(payload), encoding="utf-8")
    assert watch_mod.summary(watch_mod.read_archive(tmp_path))["rises"] == []


def test_committed_watch_json_matches_the_archive() -> None:
    watch = json.loads((writer.OUT / "watch.json").read_text())
    archive = watch_mod.read_archive(writer.OUT / "archive")
    assert watch == watch_mod.summary(archive)
    assert watch["entries"] == len(archive)
