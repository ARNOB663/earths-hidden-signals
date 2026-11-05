"""Build the committed signal outputs from either sample or real data (plan §5, step 3).

    python3 scripts/signals/build.py --seeded-sample     # deterministic sample, no network
    python3 scripts/signals/build.py --replay-events     # replay JSON for verified GDACS events

Real runs arrive in step 3b once credentials and the one-day timing are confirmed; until then a
real build refuses to invent numbers.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import baseline  # noqa: E402
import engine  # noqa: E402
import sample  # noqa: E402
import tiles as tiles_mod  # noqa: E402
import writer  # noqa: E402

BASELINE_YEARS = sample.SAMPLE_YEARS
STATUS_RANK = {"red": 0, "yellow": 1, "green": 2}
# Grey cells are thinned to a baseline short enough for the engine's own rule to fire
# (needs >= 15 years); the status is never written directly.
THINNED_YEARS = range(2010, 2024)

# The sample day differs per tile so each one shows a different status: the box rows start at
# the tile edge, and the same day across all three boxes put the same values on top.
SAMPLE_END_BY_TILE = {
    "bengal": sample.SAMPLE_END,
    "indus": sample.SAMPLE_END - dt.timedelta(days=10),
    "western-himalaya": sample.SAMPLE_END - dt.timedelta(days=20),
}
# The Red cluster: the rain values of a published-satellite-like loading, written into the 3 days
# ending on the sample day, inside each tile's wet season. Placement comes from each tile's own
# seeded series; the status is decided afterwards by the real engine on the written window.
CLUSTER_DAYS = 3
CLUSTER_BOX = (6, 3)  # row, column of the north-west cell of the 2x2 cluster
RING_SIZE = 4
# Multiples of the cell's own normal 3-day total written into the cluster and its ring. The engine
# decides the status: the cluster gets Red's 3x and the ring 2x, both above the mm floors, and the
# written grids then show Green in between by the same rule.
CLUSTER_FACTOR = 3.0
RING_FACTOR = 2.0
# A normal 3-day total that is too small to clear Blue's mm floors keeps the engine at Green;
# the floor is the tile's demo threshold, never a status.
CLUSTER_FLOOR_MM = {"bengal": 16.0, "indus": 10.0, "western-himalaya": 10.0}
# The thinned (Grey) cluster: a 2x2 block far below the ring, so Grey is a cluster, not a speck.
# Only the Grey cells get the short baseline; the engine's baseline-small rule makes them Grey.
GREY_BOX = (8, 8)
# The "strongest signals" list: at most this many rows, and at most this many Red per tile, so
# the strongest Yellow rows also make the list.
TOP_ROWS = 24
TOP_RED_PER_TILE = 4
TOP_YELLOW = 8


def _windows(
    series: baseline.DaySeries, end: dt.date, config: dict, *, years: range
) -> list[engine.WindowReading]:
    out = []
    for days in config["windows"]:
        stats = baseline.window_stats(
            series,
            end,
            days,
            half=config["doyHalfWindow"],
            years=years,
            wet_day_min_mm=config["wetDayMinMm"],
        )
        out.append(
            engine.WindowReading(
                days=days,
                rain_mm=stats.rain_mm,
                percentile=stats.percentile,
                ratio=stats.ratio if stats.wet_day_count >= config["wetDayCountMin"] else None,
                sample_count=stats.sample_count,
                year_count=stats.year_count,
            )
        )
    return out


def _cell_row(tile, lat, lon, series, end, config, verdict, windows) -> dict:
    # Grey means "we cannot read this place": no numbers beside it, only the reason.
    chosen = next((w for w in windows if w.days == verdict.window_days), windows[0])
    if verdict.is_grey:
        chosen = engine.WindowReading(days=chosen.days, rain_mm=None, percentile=None, ratio=None,
                                      sample_count=chosen.sample_count, year_count=chosen.year_count)
    row = {
        "lat": lat,
        "lon": lon,
        "status": verdict.status,
        "confidence": verdict.confidence,
        "reason": verdict.reason,
        "reasonText": engine.reason_text(verdict, windows),
        "windowDays": verdict.window_days,
        "percentile": None if chosen.percentile is None else round(chosen.percentile, 1),
        "ratio": None if chosen.ratio is None else round(chosen.ratio, 2),
        "day1": None,
        "day3": None,
        "day7": None,
    }
    if not verdict.is_grey:
        for window in windows:
            if window.rain_mm is not None:
                row[f"day{window.days}"] = round(window.rain_mm, 1)
    return row


def _in_box(row: int, col: int, origin: tuple[int, int], size: int) -> bool:
    return origin[0] <= row < origin[0] + size and origin[1] <= col < origin[1] + size


def sample_years(row: int, col: int) -> range:
    """Baseline years a sample cell is judged against; the Grey cluster uses a short baseline."""
    if _in_box(row, col, GREY_BOX, 2):
        return THINNED_YEARS
    return BASELINE_YEARS


def sample_ends() -> dict[str, dt.date]:
    return dict(SAMPLE_END_BY_TILE)


def _cluster_rank(row: int, col: int) -> int | None:
    """0-3 for the 2x2 Red cluster (NW, NE, SW, SE), 4-7 for its ring, None elsewhere."""
    top, left = CLUSTER_BOX
    if top <= row < top + 2 and left <= col < left + 2:
        return (row - top) * 2 + (col - left)
    if _in_box(row, col, (top - 1, left - 1), RING_SIZE):
        return 4 + (row - top + 1) + 2 * (col - left + 1)
    return None


def _cluster_normal(series: baseline.DaySeries, config: dict, end: dt.date) -> float:
    """The cell's normal total for the cluster window: the median of wet days for the same date."""
    stats = baseline.window_stats(series, end, CLUSTER_DAYS, half=config["doyHalfWindow"], years=BASELINE_YEARS)
    return stats.normal_mm * CLUSTER_DAYS if stats.normal_mm else 0.0


def _apply_cluster(
    series: baseline.DaySeries, tile_id: str, rank: int, end: dt.date, config: dict
) -> baseline.DaySeries:
    """Write a three-day loading into a cell's series, in proportion to that cell's own normal.

    The engine, not this function, decides the status: cluster cells receive Red's 3x the normal
    3-day total split over the three days, ring cells Yellow's 2x, both above the mm floors. No
    status is written here.
    """
    factor = CLUSTER_FACTOR if rank < 4 else RING_FACTOR
    normal = _cluster_normal(series, config, end)
    target = max(normal, CLUSTER_FLOOR_MM.get(tile_id, 0.0)) * factor
    # Spread the same total over the three days in proportion to each day's own normal share, so
    # the loading lands on the days this cell normally gets its rain.
    shares = []
    for offset in range(CLUSTER_DAYS):
        day = end - dt.timedelta(days=offset)
        stats = baseline.window_stats(series, day, 1, half=config["doyHalfWindow"], years=BASELINE_YEARS)
        shares.append(max(stats.normal_mm or 0.0, series.values.get(day, 0.0)))
    total = sum(shares) or float(CLUSTER_DAYS)
    values = dict(series.values)
    for offset, share in enumerate(shares):
        day = end - dt.timedelta(days=offset)
        values[day] = round(max(values.get(day, 0.0), target * share / total), 1)
    return baseline.DaySeries(values)


def sample_day(end: dt.date, tile_id: str) -> dt.date:
    """The sample's demonstration day: the tile's wettest calendar day in the year it reports."""
    return sample.season_peak(tile_id, end.year)


def _sample_cell(tile_id: str, lat: float, lon: float, end: dt.date, config: dict, years: range, rank: int | None) -> dict:
    series = baseline.DaySeries(sample.series_for(tile_id, lat, lon))
    if rank is not None:
        series = _apply_cluster(series, tile_id, rank, end, config)
    windows = _windows(series, end, config, years=years)
    verdict = engine.evaluate(windows, config, basis="sample")
    cell = _cell_row(tile_id, lat, lon, series, end, config, verdict, windows)
    cell["sample"] = True
    return cell


def build_sample(config: dict) -> None:
    writer.write_config_copy()
    writer.write_sources(
        {
            "imerg-late": {"status": "sample", "sample": True, "checkedOn": "2026-11-03"},
            "outlook-open-meteo": {"status": "not-integrated", "sample": False},
        }
    )
    tile_list = tiles_mod.tiles(config)
    ends = sample_ends()
    # The clock is the latest tile day, so no tile claims a measurement in the future.
    clock_day = max(ends[tile.id] for tile in tile_list)
    clock = f"{clock_day.isoformat()}T00:00:00Z"

    top: list[dict] = []
    for tile in tile_list:
        # A 1-degree sample grid keeps the sample believable and the JSON small.
        grid = tile.grid(1)
        side = int(round(len(grid) ** 0.5))
        end = sample_day(ends[tile.id], tile.id)
        cells = []
        for index, (lat, lon) in enumerate(grid):
            row, col = divmod(index, side)
            cell = _sample_cell(tile.id, lat, lon, end, config, sample_years(row, col), _cluster_rank(row, col))
            cells.append(cell)
        writer.write_grid(tile.id, cells, config)
        for cell in cells:
            if cell["status"] in ("red", "yellow"):
                top.append({"tile": tile.id, "tileLabel": tile.label, **cell})
    top.sort(key=lambda r: (STATUS_RANK.get(r["status"], 3), -(r["day3"] or 0)))
    # The list must show the mix, not only the twenty-four Red cells: keep the strongest Yellow
    # rows as well, and cap how many rows one tile contributes so the three tiles all appear.
    ranked = [r for r in top if r["status"] == "red"] + [r for r in top if r["status"] == "yellow"]
    rows: list[dict] = []
    red_per_tile: dict[str, int] = {}
    yellows = 0
    for row in ranked:
        if len(rows) >= TOP_ROWS:
            break
        if row["status"] == "yellow":
            if yellows < TOP_YELLOW:
                rows.append(row)
                yellows += 1
            continue
        if red_per_tile.get(row["tile"], 0) < TOP_RED_PER_TILE:
            rows.append(row)
            red_per_tile[row["tile"]] = red_per_tile.get(row["tile"], 0) + 1
    rows.sort(key=lambda r: (STATUS_RANK.get(r["status"], 3), -(r["day3"] or 0)))
    writer.write_meta(
        {
            "sampleData": True,
            "basis": "sample",
            "clock": clock,
            "measurementTime": clock,
            "tiles": [tile.id for tile in tile_list],
            "tileLabels": {tile.id: tile.label for tile in tile_list},
            "generatedAt": clock,
            "product": "sample",
            "note": "Sample mode: age is not applicable.",
        },
        config,
    )
    writer.write_archive(
        dt.date(2025, 8, 31),
        {"date": "2025-08-31", "sample": True, "rises": []},
        config,
    )
    # What-to-watch reads the whole archive: one entry, so the page must say "no rise recorded yet".
    import watch as watch_mod

    writer.write_watch(watch_mod.summary(watch_mod.read_archive(writer.OUT / "archive")), config)
    print(f"sample build written to {writer.OUT}")


def build_replays(config: dict) -> None:
    """Replay series need real IMERG; without it, write the event list as 'not enough data yet'."""
    import replay as replay_mod

    for event in replay_mod.EVENTS:
        writer.write_replay(
            event["id"],
            {
                **event,
                "product": config["baseline"]["product"],
                "series": [],
                "status": "pending-real-data",
                "label": "Historical replay, not live",
                "note": "Replay series are written from real IMERG once credentials are available; no numbers are invented.",
            },
            config,
        )
    # Accuracy counts are derived from the same replay files, so the page cannot drift from them.
    replay_mod.accuracy(config)
    print(f"{len(replay_mod.EVENTS)} replay records and accuracy.json written")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build signals outputs.")
    parser.add_argument("--seeded-sample", action="store_true", help="deterministic sample build, no network")
    parser.add_argument("--replay-events", action="store_true", help="write replay records for verified events")
    args = parser.parse_args(argv)
    config = tiles_mod.load_config()
    if args.seeded_sample:
        build_sample(config)
    if args.replay_events:
        build_replays(config)
    if not any((args.seeded_sample, args.replay_events)):
        parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
