import pytest

from intel import confidence as conf

FULL = dict(baseline_n=30, full_baseline_n=30, coverage_pct=100.0, late_days=0, fallback=False)


def test_full_observation_is_high():
    assert conf.observation(**FULL)["grade"] == "high"


@pytest.mark.parametrize(
    "change",
    [{"baseline_n": 24}, {"coverage_pct": 60.0}, {"late_days": 10}],
)
def test_each_input_demotes_exactly_one_grade(change):
    assert conf.observation(**{**FULL, **change})["grade"] == "moderate"


def test_two_degradations_give_low():
    assert conf.observation(**{**FULL, "baseline_n": 24, "late_days": 10})["grade"] == "low"


def test_fallback_geography_gives_low():
    assert conf.observation(**{**FULL, "fallback": True})["grade"] == "low"


def test_short_baseline_is_insufficient():
    assert conf.observation(**{**FULL, "baseline_n": 19})["grade"] == "insufficient"


def test_low_coverage_is_insufficient():
    assert conf.observation(**{**FULL, "coverage_pct": 40.0})["grade"] == "insufficient"


def test_every_grade_has_reasons_in_both_languages():
    for c in (conf.observation(**FULL), conf.observation(**{**FULL, "baseline_n": 3}),
              conf.anomaly(result={}), conf.hazard(applicable=True, linked_driver=False, has_record=True)):
        assert c["reasons"] and all(r["code"] and r["textEn"] and r["textBn"] for r in c["reasons"])


def test_anomaly_near_boundary_is_low():
    assert conf.anomaly(result={"available": True, "boundaryMarginSteps": 0.5, "n": 30})["grade"] == "low"
    assert conf.anomaly(result={"available": True, "boundaryMarginSteps": 2.0, "n": 30})["grade"] == "high"
    assert conf.anomaly(result={"available": True, "boundaryMarginSteps": 2.0, "n": 24})["grade"] == "moderate"
    assert conf.anomaly(result={"available": True, "boundaryMarginSteps": 2.0, "n": 30}, conflicting=True)["grade"] == "low"


def test_hazard_needs_driver_and_record():
    assert conf.hazard(applicable=True, linked_driver=True, has_record=True)["grade"] == "high"
    assert conf.hazard(applicable=True, linked_driver=True, has_record=False)["grade"] == "moderate"
    assert conf.hazard(applicable=True, linked_driver=False, has_record=False)["grade"] == "low"
    assert conf.hazard(applicable=False, linked_driver=True, has_record=True)["grade"] == "insufficient"


def test_validation_respects_independence():
    agree = lambda ind: {"status": "agree", "independence": ind}  # noqa: E731
    assert conf.validation([agree("independent")])["grade"] == "high"
    assert conf.validation([agree("same-input-family")])["grade"] == "moderate"
    assert conf.validation([{"status": "disagree", "independence": "same-input-family"}])["grade"] == "low"
    assert conf.validation([])["grade"] == "insufficient"


def test_cap_lowers_one_grade_and_explains():
    capped = conf.cap(conf.observation(**FULL), 1, "fallback-geography", "x", "y")
    assert capped["grade"] == "moderate" and capped["reasons"][-1]["code"] == "fallback-geography"


def test_weakest_names_the_lowest():
    name, c = conf.weakest({"observation": {"grade": "high"}, "validation": {"grade": "low"}, "hazard": {"grade": "moderate"}})
    assert name == "validation"
