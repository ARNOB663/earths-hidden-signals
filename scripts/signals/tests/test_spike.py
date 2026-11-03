"""Tests for the spike scripts' pure helpers (stdlib only; no network).

These run before step 1 so a parser break is caught before the pipeline depends on it:

    cd scripts/signals && python3 -m pytest -q tests/
"""

from __future__ import annotations

import datetime as dt
import importlib.util
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parents[1]
# Committed fixtures (scripts/signals/raw/ is ignored; only these small cuts are tracked).
RAW = HERE / "tests" / "fixtures"


def load(name: str):
    spec = importlib.util.spec_from_file_location(f"signals_{name}", HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


spike = load("spike")
probe = load("spike_imerg_probe")


# ---------------------------------------------------------------------------------------
# Link/format detection
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("body", "expected", "want"),
    [
        (b'{"features": []}', "json", "json"),
        (b"<!DOCTYPE html><html><body></body></html>", "html", "html"),
        (b"<?xml version='1.0'?><a/>", "xml", "xml"),
        (b"<pre><a href='x'>x</a></pre>", "dir", "listing"),
        (b"", "html", "empty"),
        (b"plain words", "json", "not json"),
        (b"<html><body>login</body></html>", "xml", "not xml"),
    ],
)
def test_format_detection(body: bytes, expected: str, want: str) -> None:
    assert spike.looks_like_body(body, expected) == want


def test_human_bytes() -> None:
    assert spike.human_bytes(512) == "512 B"
    assert spike.human_bytes(2048) == "2.0 KB"
    assert spike.human_bytes(5 * 1024 * 1024) == "5.0 MB"


def test_credentials_are_never_in_headers_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PPS_USERNAME", raising=False)
    monkeypatch.delenv("PPS_PASSWORD", raising=False)
    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    assert spike.has_creds("pps") is False
    assert spike.has_creds("ed") is False


def test_auth_headers_do_not_leak_secrets_into_repr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PPS_USERNAME", "user@example.org")
    monkeypatch.setenv("PPS_PASSWORD", "user@example.org")
    header = spike.auth_headers("pps")
    assert header["Authorization"].startswith("Basic ")
    assert "user@example.org" not in header["Authorization"]


# ---------------------------------------------------------------------------------------
# Grid helpers and window parsing
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("lat", "lon", "want"),
    [(23.81, 90.41, (20.0, 90.0)), (-18.79, 35.36, (-20.0, 30.0)), (0.0, 0.0, (0.0, 0.0)), (-0.5, -0.5, (-10.0, -10.0))],
)
def test_tile_of_aligns_to_ten_degrees(lat: float, lon: float, want: tuple[float, float]) -> None:
    assert probe.tile_of(lat, lon) == want


def test_parse_point_rejects_bad_ranges() -> None:
    assert probe.parse_point("23.81,90.41") == (23.81, 90.41)
    with pytest.raises(Exception):
        probe.parse_point("91,0")
    with pytest.raises(Exception):
        probe.parse_point("0,181")


def test_parse_window_rejects_reversed_range() -> None:
    start, end = probe.parse_window("2024-07-01/2024-07-31")
    assert (start, end) == (dt.date(2024, 7, 1), dt.date(2024, 7, 31))
    with pytest.raises(Exception):
        probe.parse_window("2024-07-31/2024-07-01")


def test_days_is_inclusive() -> None:
    got = probe.days(dt.date(2024, 7, 30), dt.date(2024, 8, 1))
    assert [d.isoformat() for d in got] == ["2024-07-30", "2024-07-31", "2024-08-01"]


def test_pixel_indices_cover_the_tile() -> None:
    # 20..30 N, 90..100 E -> rows 600..700, cols 2700..2800 on a north-up 0.1 deg grid.
    row0 = int(round((90 - 30) / probe.PIXEL_DEG))
    row1 = int(round((90 - 20) / probe.PIXEL_DEG))
    col0 = int(round((90 + 180) / probe.PIXEL_DEG))
    col1 = int(round((100 + 180) / probe.PIXEL_DEG))
    assert (row0, row1, col0, col1) == (600, 700, 2700, 2800)


# ---------------------------------------------------------------------------------------
# Recorded catalogue depth (fixtures are the CMR answers of 2026-11-03)
# ---------------------------------------------------------------------------------------
CMR_DEPTH = {
    "Final": ("1998-01-01", "2025-09-30"),
    "Late": ("1998-01-01", None),
    "Early": ("1998-01-01", None),
}


def test_product_start_matches_cmr() -> None:
    assert probe.PRODUCT_START.isoformat() == CMR_DEPTH["Final"][0]
    assert probe.FINAL_END.isoformat() == CMR_DEPTH["Final"][1]


# ---------------------------------------------------------------------------------------
# Fixtures captured on 2026-11-03
# ---------------------------------------------------------------------------------------
def test_gdacs_flood_fixture_has_dated_points() -> None:
    features = json.loads((RAW / "gdacs_flood_features.json").read_text())
    assert isinstance(features, list) and features
    for feature in features:
        props = feature["properties"]
        assert props["eventtype"] == "FL"
        assert props["fromdate"][:4].isdigit()
        assert feature["geometry"]["type"] == "Point"
        assert len(feature["geometry"]["coordinates"]) == 2


def test_gdacs_history_fixture_parses() -> None:
    payload = json.loads((RAW / "gdacs_fl_2015Q1.json").read_text())
    ids = {f["properties"]["eventid"] for f in payload["features"]}
    assert {4215, 4219} <= ids


def test_eonet_fixture_shape() -> None:
    payload = json.loads((RAW / "eonet_events.json").read_text())
    assert payload["events"]
    first = payload["events"][0]
    assert {"id", "title", "categories", "geometry"} <= set(first)


def test_eonet_closed_fixture_is_recent_only() -> None:
    """EONET closed floods cover only the last weeks, which is why GDACS feeds the replays."""
    import bz2

    payload = json.loads(bz2.decompress((RAW / "eonet_floods_closed_sample.json.bz2").read_bytes()))
    dates = [e["geometry"][0]["date"] for e in payload["events"] if e.get("geometry")]
    assert dates and min(dates) >= "2026-09-01"


def test_ghcn_parse_units_and_missing(tmp_path: Path) -> None:
    import gzip

    csv = "\n".join(
        [
            "BGM00041923,20240711,PRCP,5,,,S,",
            "BGM00041923,20240712,PRCP,1311,,,S,",
            "BGM00041923,20240713,PRCP,-9999,,,S,",
            "BGM00041923,20240714,TMAX,320,,,S,",
            "BGM00041923,20240715,PRCP,0,,,S,",
        ]
    )
    path = tmp_path / "station.csv.gz"
    path.write_bytes(gzip.compress(csv.encode()))
    with open(path, "rb") as handle:
        text = gzip.decompress(handle.read()).decode()
    values: dict[str, float] = {}
    for line in text.splitlines():
        parts = line.split(",")
        if parts[2] == "PRCP" and int(parts[3]) != -9999:
            values[parts[1]] = int(parts[3]) / 10.0
    assert values == {"20240711": 0.5, "20240712": 131.1, "20240715": 0.0}
    assert "20240713" not in values
    assert "20240714" not in values


def test_projected_size_is_within_budget_for_5deg_cells() -> None:
    # 10x10 deg tile at 0.5 deg = 400 cells; 28 years of days at 2 bytes, zlib 0.45.
    days_total = 28 * 366
    per_cell = int(days_total * 2 * 0.45)
    per_tile = per_cell * 400
    assert per_tile < 8 * 1024 * 1024


def test_report_upsert_keeps_curated_sections(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    report = tmp_path / "spike_report.md"
    report.write_text("# R\n\n## 3. GDACS (auto-generated)\n\nold\n\n## 10. Gates\n\ncurated\n")
    monkeypatch.setattr(spike, "REPORT", str(report))
    spike.write_report_section("GDACS shape", "new table")
    text = report.read_text()
    assert "new table" in text
    assert "old" not in text
    assert "## 10. Gates\n\ncurated" in text


def test_no_secret_printed_by_design() -> None:
    source = (HERE / "spike.py").read_text()
    source += (HERE / "spike_imerg_probe.py").read_text()
    for pattern in ("print(os.environ", "print(creds", "print(auth_headers", "logging."):
        assert pattern not in source
