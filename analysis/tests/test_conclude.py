"""Checks on the committed intelligence outputs (regenerate with: python intelligence.py --reproduce)."""

import json

import pytest

from intel.conclude import FIELDS, missing_fields
from intel.inputs import OUT


@pytest.fixture(scope="module")
def outputs():
    if not (OUT / "locations.json").exists():
        pytest.skip("intelligence outputs not generated")
    load = lambda n: json.loads((OUT / n).read_text(encoding="utf-8"))  # noqa: E731
    return load("locations.json"), load("current.json"), load("alerts.json")


def test_seven_questions_present_in_both_languages(outputs):
    locations, _, _ = outputs
    assert len(FIELDS) == 7
    for loc in locations["locations"]:
        assert missing_fields(loc["conclusion"]) == [], loc["id"]


def test_headlines_are_short(outputs):
    for loc in outputs[0]["locations"]:
        assert len(loc["conclusion"]["headline"]["en"]) <= 140
        assert len(loc["conclusion"]["headline"]["bn"]) <= 140


def test_every_evidence_id_resolves(outputs):
    locations, current, _ = outputs
    ids = {r["id"] for recs in current["indicators"].values() for r in recs.values()}
    ids |= {c["id"] for cs in current["composites"].values() for c in cs.values()}
    for loc in locations["locations"]:
        assert loc["conclusion"]["evidenceIds"]
        assert set(loc["conclusion"]["evidenceIds"]) <= ids, loc["id"]


def test_cities_state_their_fallback(outputs):
    for loc in outputs[0]["locations"]:
        if loc["kind"] == "city":
            g = loc["geography"]
            assert g["fallback"] is True and g["fallbackReasonEn"] and g["fallbackReasonBn"]
            assert f"not a measurement of {loc['name']}" in loc["conclusion"]["situation"]["en"] or g["sourceKind"] != "region"


def test_four_confidences_never_a_single_number(outputs):
    for loc in outputs[0]["locations"]:
        assert set(loc["confidences"]) == {"observation", "anomaly", "hazard", "validation"}
        for c in loc["confidences"].values():
            assert c["grade"] in {"high", "moderate", "low", "insufficient"}
            assert c["reasons"]


def test_nothing_claims_independence_wrongly(outputs):
    for loc in outputs[0]["locations"]:
        for v in loc["validation"]:
            assert v["independence"] in {"independent", "same-input-family", "consistency-check"}
            if v["independence"] == "independent":
                assert v["status"] == "unavailable"  # no independent source is available offline


def test_alerts_are_separated_and_disclaimed(outputs):
    alerts = outputs[2]
    for a in alerts["computed"] + alerts["reconstructed"]:
        assert a["official"] is False
        assert a["textEn"].startswith("Screening indicator, not a confirmed event.")
    for a in alerts["official"]:
        assert a["official"] is True and "GDACS" in a["provider"]
    keys = [(a["locationId"], a["hazard"]) for a in alerts["computed"] if a["status"] == "active"]
    assert len(keys) == len(set(keys))  # one active alert per (location, hazard)


def test_hazard_entries_carry_the_disclaimer(outputs):
    for loc in outputs[0]["locations"]:
        for h in loc["hazards"]:
            assert "not a forecast" in h["disclaimerEn"]
        assert all("not a forecast" in h["en"] for h in loc["conclusion"]["hazards"])
