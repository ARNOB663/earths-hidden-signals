"""Step 2 tests: config, tiles, IMERG encoding, ladder, outlook, auth classification.

No network. The GeoTIFF fixture is synthesised with tifffile at the documented geometry, so the
reader's assertions (two-byte, 0.1 deg, north-up, 29999 fill) are exercised on a real file.
"""

from __future__ import annotations

import datetime as dt
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
import pytest

HERE = Path(__file__).resolve().parents[1]
FIXTURES = HERE / "tests" / "fixtures"


def load(name: str):
    spec = importlib.util.spec_from_file_location(f"signals_{name.replace('-', '_')}", HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


tiles_mod = load("tiles")
imerg = load("imerg")
auth = load("auth")
outlook = load("outlook")

CONFIG = tiles_mod.load_config()


# ---------------------------------------------------------------------------------------
# Config and the browser copy
# ---------------------------------------------------------------------------------------
def test_config_copy_is_byte_identical() -> None:
    public = tiles_mod.PUBLIC_CONFIG
    if not public.exists():
        pytest.skip("web/public/data/signals/config.json is written by the step-3 writer")
    assert public.read_bytes() == tiles_mod.CONFIG_PATH.read_bytes()


def test_thresholds_present_and_monotonic() -> None:
    assert CONFIG["yellow"]["percentile"] < CONFIG["red"]["percentile"]
    assert CONFIG["yellow"]["mm"] < CONFIG["red"]["mm"]
    assert CONFIG["red"]["ratio"] > CONFIG["yellow"]["ratio"]


def test_no_country_names_in_config() -> None:
    text = tiles_mod.CONFIG_PATH.read_text().lower()
    for word in ("bangladesh", "india", "pakistan", "nepal", "bhutan", "sri lanka"):
        assert word not in text


def test_launch_tiles_are_the_approved_three() -> None:
    ids = [tile.id for tile in tiles_mod.tiles(CONFIG)]
    assert ids == ["bengal", "indus", "western-himalaya"]


def test_tiles_respect_the_latitude_limit() -> None:
    for tile in tiles_mod.tiles(CONFIG):
        assert abs(tile.north) <= CONFIG["maxAbsLat"]
        assert abs(tile.south) <= CONFIG["maxAbsLat"]


def test_tile_lookup_and_cell_snapping() -> None:
    tile = tiles_mod.tile_for(23.81, 90.41, CONFIG)
    assert tile is not None and tile.id == "bengal"
    assert tiles_mod.tile_for(0.0, 0.0, CONFIG) is None
    assert tiles_mod.cell_of(23.81, 90.41, 0.5) == (23.75, 90.25)


def test_place_url_rounds_to_one_eighth() -> None:
    assert tiles_mod.round_for_url(23.81) == 23.75  # nearest eighth: 23.75, not 23.875
    assert tiles_mod.round_for_url(90.41) == 90.375
    assert tiles_mod.round_for_url(0.06) == 0.0


def test_tile_grid_is_north_up() -> None:
    tile = [t for t in tiles_mod.tiles(CONFIG) if t.id == "bengal"][0]
    grid = tile.grid(0.5)
    assert len(grid) == 20 * 20
    assert grid[0] == (29.75, 85.25)  # first cell: north-west corner
    assert grid[-1] == (20.25, 94.75)


def test_event_area_radius() -> None:
    tile = [t for t in tiles_mod.tiles(CONFIG) if t.id == "bengal"][0]
    cells = tiles_mod.cells_within(23.81, 90.41, CONFIG["eventRadiusKm"], 0.5, tile)
    assert cells
    for lat, lon in cells:
        assert tiles_mod.distance_km(23.81, 90.41, lat, lon) <= CONFIG["eventRadiusKm"]
    # 50 km at 0.5 deg cells (55 km north-south) is at most a handful of cells.
    assert len(cells) <= 18


# ---------------------------------------------------------------------------------------
# GeoTIFF encoding
# ---------------------------------------------------------------------------------------
def make_geotiff(path: Path, values: np.ndarray, *, dtype=np.uint16, px: float = 0.1, flip: bool = False) -> Path:
    """Write a fixture at the documented IMERG geometry (tags 33550/33922 = pixel scale/tiepoint)."""
    tifffile = pytest.importorskip("tifffile", reason="tifffile is a step-2 dependency: pip install tifffile")
    data = values.astype(dtype)
    tifffile.imwrite(
        path,
        data,
        photometric="minisblack",
        extratags=[(33550, "d", 3, (px, px, 0.0), False), (33922, "d", 6, (0, 0, 0, -180, 90, 0), False)],
    )
    return path


def test_decode_scale_and_fill() -> None:
    raw = np.array([[0, 10, 29999], [65535, 5, 100]], dtype=np.uint16)
    mm = imerg.decode(raw)
    assert mm[0, 0] == 0.0
    assert mm[0, 1] == 1.0
    assert np.isnan(mm[0, 2])  # 29999 is missing, not 2999.9 mm
    assert mm[1, 0] == 6553.5  # an out-of-range value is kept as-is, not silently dropped
    assert mm[1, 1] == 0.5
    assert mm[1, 2] == 10.0


def test_read_geotiff_roundtrip(tmp_path: Path) -> None:
    values = np.full((20, 20), 29999, dtype=np.uint16)
    values[3, 4] = 123
    path = make_geotiff(tmp_path / "a.tif", values)
    raster = imerg.read_geotiff(path)
    assert raster.pixels_per_deg == 10
    assert raster.nw == (90.0, -180.0)
    assert raster.valid_fraction == pytest.approx(1 / 400)
    # row 3, col 4 -> centre lat 89.65, lon -179.55
    assert raster.at(89.65, -179.55) == pytest.approx(12.3)


def test_read_geotiff_rejects_wrong_dtype(tmp_path: Path) -> None:
    path = make_geotiff(tmp_path / "b.tif", np.zeros((4, 4)), dtype=np.float32)
    with pytest.raises(imerg.ImergEncodingError):
        imerg.read_geotiff(path)


def test_read_geotiff_rejects_wrong_pixel_size(tmp_path: Path) -> None:
    path = make_geotiff(tmp_path / "c.tif", np.zeros((4, 4)), px=0.25)
    with pytest.raises(imerg.ImergEncodingError):
        imerg.read_geotiff(path)


def test_window_sum_refuses_mixed_versions() -> None:
    a = imerg.Raster(np.zeros((2, 2)), 1.0, (90, -180), 10, "x.20200101.V07B.tif")
    b = imerg.Raster(np.zeros((2, 2)), 1.0, (90, -180), 10, "x.20200102.V07C.tif")
    with pytest.raises(imerg.ImergEncodingError):
        imerg.window_sum([a, b], 2)


def test_window_sum_counts() -> None:
    a = imerg.Raster(np.full((2, 2), 1.0), 1.0, (90, -180), 10, "x.20200101.V07B.tif")
    b = imerg.Raster(np.full((2, 2), 2.0), 1.0, (90, -180), 10, "x.20200102.V07B.tif")
    c = imerg.Raster(np.full((2, 2), 3.5), 1.0, (90, -180), 10, "x.20200103.V07B.tif")
    result = imerg.window_sum([a, b, c], 3)
    assert result.mm == pytest.approx(6.5)


# ---------------------------------------------------------------------------------------
# README.GIS assertions
# ---------------------------------------------------------------------------------------
README_OK = """
IMERG GIS contains a grid of unsigned two-byte integers. Precipitation accumulation in
millimeters is multiplied by 10 before it is written, e.g. 1 mm is 10. A value of 29999 is
used to indicate missing data. Each grid box is 0.1 degree. The centre of the north-westernmost
grid box is 89.95N, 179.95W. Products: V07B and V07C.
"""

README_BAD = "IMERG GIS stores precipitation rates as floats. Version V06."


def test_readme_parse_finds_the_facts() -> None:
    facts = imerg.parse_readme_gis(README_OK)
    assert facts["scale"] and facts["missing"] and facts["pixels_per_deg"] and facts["northwest"]
    assert facts["versions"] == ["V07B", "V07C"]
    imerg.assert_readme_matches(README_OK)


def test_readme_mismatch_aborts() -> None:
    with pytest.raises(imerg.ImergEncodingError) as error:
        imerg.assert_readme_matches(README_BAD)
    assert "scale" in str(error.value)


# ---------------------------------------------------------------------------------------
# Granule naming and the ladder
# ---------------------------------------------------------------------------------------
def test_granule_url_shape_for_late_and_early() -> None:
    day = dt.date(2024, 7, 15)
    late = imerg.granule_url(CONFIG["imerg"]["ppsBase"], "late", day, 1)
    early = imerg.granule_url(CONFIG["imerg"]["ppsBase"], "early", day, 3)
    assert late.endswith("/2024/07/3B-1DAY-L.GIS.IMERG.20240715-S000000-E235959.V07B.tif")
    assert early.endswith("/2024/07/3B-3DAY-E.GIS.IMERG.20240715-S000000-E235959.V07B.tif")


def test_granule_url_rejects_unsupported_window() -> None:
    with pytest.raises(ValueError):
        imerg.granule_url("https://x", "late", dt.date(2024, 1, 1), 2)


def test_ladder_order_matches_config() -> None:
    ladder = imerg.ladder("late", 7)
    names = ["late-3imerg", "late-sums-of-1day", "early-sums-of-1day"]
    canonical = []
    seen = []
    for step in ladder:
        key = "late-3imerg" if step == "late" and not seen else f"{step}-sums-of-1day"
        seen.append(step)
        canonical.append(key)
    assert canonical == names == CONFIG["imerg"]["ladder"]


# ---------------------------------------------------------------------------------------
# Outlook and credentials
# ---------------------------------------------------------------------------------------
def test_outlook_never_marks_itself_as_status_input() -> None:
    result = outlook.Outlook([("2026-11-03", 1.5), ("2026-11-04", None)], "Open-Meteo (CC-BY 4.0)", dt.datetime.now(dt.timezone.utc))
    payload = result.as_dict()
    assert payload["usedInStatus"] is False
    assert payload["totalMm"] == 1.5
    assert "not our signal" in payload["label"] and "not an official warning" in payload["label"]


def test_outlook_provider_failure_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    import requests

    def boom(*args, **kwargs):
        raise requests.RequestException("down")

    monkeypatch.setattr(outlook.requests, "get", boom)
    assert outlook.fetch(23.8, 90.4, "https://example.invalid") is None


def test_credentials_repr_hides_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PPS_USERNAME", "someone@example.org")
    monkeypatch.setenv("PPS_PASSWORD", "someone@example.org")
    monkeypatch.setenv("EARTHDATA_TOKEN", "secret-token-value")
    creds = auth.Credentials.from_env()
    text = repr(creds)
    assert "secret-token-value" not in text and "someone@example.org" not in text
    assert "set" in text


def test_credentials_missing_is_reported_not_faked(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("PPS_USERNAME", "PPS_PASSWORD", "EARTHDATA_TOKEN"):
        monkeypatch.delenv(name, raising=False)
    creds = auth.Credentials.from_env()
    assert auth.probe_pps(creds) == "missing"
    assert auth.probe_earthdata(creds) == "missing"


@pytest.mark.parametrize(
    ("status", "body", "want"),
    [
        (200, b"", "OK"),
        (401, b"Unauthorized", "rejected"),
        (401, b"token expired", "expired"),
        (403, b"", "rejected"),
        (302, b"", "rejected"),
        (404, b"", "OK"),
        (500, b"", "unexpected-500"),
    ],
)
def test_auth_classification(status: int, body: bytes, want: str) -> None:
    assert auth._classify(status, body) == want


def test_fixtures_are_committed_and_small() -> None:
    total = sum(p.stat().st_size for p in FIXTURES.rglob("*") if p.is_file())
    assert total < 1024 * 1024
    assert (FIXTURES / "gdacs_flood_features.json").exists()
    assert json.loads((FIXTURES / "gdacs_flood_features.json").read_text())
