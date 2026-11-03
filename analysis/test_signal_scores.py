"""Signals data: reusable geography identifiers, demo labels and measured coverage."""

import build_geography
import build_signal_scores


def test_geography_ids_are_unique_and_level_tagged():
    ids = []
    for country in build_geography.COUNTRIES:
        for level in ("ADM1", "ADM2"):
            path = build_geography.geo_path(country, level)
            if not path.exists():
                continue
            geo = build_geography.json.loads(path.read_text(encoding="utf-8"))
            used: dict[str, int] = {}
            for feature in geo["features"]:
                name, _ = build_geography.feature_names(feature)
                area_id = build_geography.level_key(country, level, name, used)
                assert area_id.startswith(f"{country.lower()}-{level.lower()}-")
                ids.append(area_id)
    assert len(ids) == len(set(ids)), "area identifiers must be stable and unique"


def test_demo_scores_are_deterministic_and_separately_labelled():
    first = build_signal_scores.demo_score("bgd-adm2-dhaka")
    assert first == build_signal_scores.demo_score("bgd-adm2-dhaka")
    assert first["signal"] in ("green", "yellow", "red")
    assert 0.0 <= first["probability"] <= 1.0
    assert 0.0 <= first["modelConfidence"] <= 1.0
    # Confidence is generated separately: it is not the score under another name.
    assert first["probability"] != first["modelConfidence"]
