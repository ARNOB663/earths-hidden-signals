"""Signals data: reusable geography identifiers and measured coverage."""

import json

import build_geography
import build_signal_scores


def test_geography_ids_are_unique_and_level_tagged():
    """Every committed area ID is unique and carries its ISO code and level prefix."""
    index = json.loads((build_geography.OUT / "index.json").read_text(encoding="utf-8"))
    ids: list[str] = []
    for country in index["countries"]:
        iso = country["code"].lower()
        for level in ("ADM1", "ADM2"):
            for area in country.get("areas", {}).get(level, []):
                area_id = area["id"]
                assert area_id.startswith(f"{iso}-{level.lower()}-"), area_id
                ids.append(area_id)
    assert ids, "the geography index carries no area ids"
    assert len(ids) == len(set(ids)), "area identifiers must be stable and unique"


def test_no_score_or_probability_is_published():
    """The demo scores are gone: coverage files carry measured cell counts, never a score."""
    data = build_signal_scores.json.loads((build_signal_scores.OUT / "coverage.json").read_text(encoding="utf-8"))
    for area in data["areas"]:
        for cell in area["cells"].values():
            assert set(cell) == {"areaCells", "coveredCells", "covered"}
            assert cell["coveredCells"] <= cell["areaCells"]
    assert not (build_signal_scores.OUT / "demo-scores.json").exists()
