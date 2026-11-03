"""Tests for the per-place payload. Every input is a committed file, so results are deterministic."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import place  # noqa: E402


@pytest.fixture(scope="module")
def built():
    import tiles

    return place.build_areas(tiles.load_config())


def test_areas_are_inside_the_tiles_and_carry_a_trust_label(built):
    assert built["items"], "no covered areas: tiles or boundaries changed"
    for area in built["items"]:
        assert area["tile"] in {"bengal", "indus", "western-himalaya"}
        assert area["trust"]["state"] in {"detectable", "blind-spot", "no-data"}
        assert area["level"] in {"ADM1", "ADM2"}


def test_detectable_needs_an_interval_that_leaves_zero(built):
    """Trust is the engine's CI, so the label must agree with the variables it carries."""
    for area in built["items"]:
        trust = area["trust"]
        if trust["state"] != "detectable":
            continue
        consistent = [v["key"] for v in area["before"]["variables"] if v["ciConsistent"]]
        assert consistent, f"{area['id']} is Detectable with no variable outside the noise"
        assert set(trust["variables"]) == set(consistent)


def test_blind_spot_has_no_interval_away_from_zero(built):
    for area in built["items"]:
        if area["trust"]["state"] != "blind-spot":
            continue
        for variable in area["before"]["variables"]:
            if variable["lowerPerDecade"] is None:
                continue
            assert variable["lowerPerDecade"] <= 0 <= variable["upperPerDecade"] or not variable["ciConsistent"]


def test_every_area_has_the_five_strips(built):
    area = next(item for item in built["items"] if item["trust"]["state"] == "detectable")
    for key in ("before", "now", "trust", "action"):
        assert key in area
    assert area["action"]["en"] and area["action"]["bn"]
    assert area["before"]["years"] and len(area["before"]["variables"]) == 3


def test_payload_is_byte_identical_on_rebuild(tmp_path, built):
    first = json.dumps(built, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    second = json.dumps(place.build_areas(json.loads((place.SIGNALS / "config.json").read_text())), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    assert first == second


def test_bangla_reason_matches_the_engine_numbers(built):
    """The Bangla sentence is generated from the same cell, so both must quote the same figure."""
    for area in built["items"]:
        for cell in area["now"]["cells"]:
            if cell["status"] in {"red", "yellow"} and cell["ratio"] is not None:
                assert "গুণ" in cell["reasonTextBn"]
                assert place._bn(cell["ratio"]) in cell["reasonTextBn"]
                return
    pytest.skip("no non-green cell in the sample clock")
