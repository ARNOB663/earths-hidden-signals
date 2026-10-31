"""Four separate confidence grades (confidence-v1). Pure functions, no I/O.

Each returns {grade, reasons: [{code, textEn, textBn}]}. Grades are never combined into one
number; the conclusion names the weakest one.
"""

from __future__ import annotations

from .periods import bn_num
from .thresholds import COVERAGE_FULL_PCT, LATE_DAYS_DEGRADED, MIN_BASELINE_VALUES, MIN_COVERAGE_PCT

GRADES = ["insufficient", "low", "moderate", "high"]


def _r(code: str, en: str, bn: str) -> dict:
    return {"code": code, "textEn": en, "textBn": bn}


def _grade_from_degradations(n: int) -> str:
    return "high" if n == 0 else "moderate" if n == 1 else "low"


def observation(*, baseline_n: int, full_baseline_n: int, coverage_pct: float | None, late_days: int | None,
                fallback: bool, available: bool = True) -> dict:
    """Quality of the observation itself: baseline length, spatial coverage, timeliness, geography."""
    if not available:
        return {"grade": "insufficient", "reasons": [_r("unavailable", "The indicator is not available for this period.", "এই সময়ের জন্য সূচকটি পাওয়া যায় না।")]}
    if baseline_n < MIN_BASELINE_VALUES:
        return {"grade": "insufficient", "reasons": [_r("baseline-too-short", f"Only {baseline_n} baseline values (at least {MIN_BASELINE_VALUES} needed).", f"বেসলাইনে মাত্র {bn_num(baseline_n)}টি মান (কমপক্ষে {bn_num(MIN_BASELINE_VALUES)}টি দরকার)।")]}
    if coverage_pct is not None and coverage_pct < MIN_COVERAGE_PCT:
        return {"grade": "insufficient", "reasons": [_r("coverage-too-low", f"Only {coverage_pct:.0f}% of the area's grid cells have data.", f"এলাকার গ্রিড বর্গের মাত্র {bn_num(round(coverage_pct))}% এ তথ্য আছে।")]}
    reasons, degraded = [], 0
    if baseline_n < full_baseline_n:
        degraded += 1
        reasons.append(_r("short-baseline", f"Baseline has {baseline_n} years, not the full {full_baseline_n}.", f"বেসলাইনে {bn_num(baseline_n)} বছর, পূর্ণ {bn_num(full_baseline_n)} নয়।"))
    if coverage_pct is not None and coverage_pct < COVERAGE_FULL_PCT:
        degraded += 1
        reasons.append(_r("partial-coverage", f"{coverage_pct:.0f}% of grid cells have data (below {COVERAGE_FULL_PCT:.0f}%).", f"{bn_num(round(coverage_pct))}% গ্রিড বর্গে তথ্য আছে।"))
    if late_days is not None and late_days > LATE_DAYS_DEGRADED:
        degraded += 1
        reasons.append(_r("late", f"The latest observation is {late_days} days later than the dataset's usual publication delay.", f"সর্বশেষ পর্যবেক্ষণ তথ্যসেটের স্বাভাবিক প্রকাশের চেয়ে {bn_num(late_days)} দিন পুরোনো।"))
    if fallback:
        degraded = max(degraded, 2)
        reasons.append(_r("fallback-geography", "Estimated from a larger area than the place itself.", "জায়গাটির চেয়ে বড় এলাকা থেকে অনুমান করা।"))
    if not reasons:
        reasons.append(_r("complete", "Full baseline, full coverage, published on time.", "পূর্ণ বেসলাইন, পূর্ণ আওতা, সময়মতো প্রকাশিত।"))
    return {"grade": _grade_from_degradations(degraded), "reasons": reasons}


def anomaly(*, result: dict, conflicting: bool = False) -> dict:
    """How firmly the class is assigned: distance from a class boundary, sample size, conflicts."""
    if not result.get("available"):
        return {"grade": "insufficient", "reasons": [_r("not-computable", "No anomaly could be computed.", "কোনো অস্বাভাবিকতা গণনা করা যায়নি।")]}
    if conflicting:
        return {"grade": "low", "reasons": [_r("conflicting", "Rainfall components point in opposite directions.", "বৃষ্টির উপাদানগুলো বিপরীত দিক দেখায়।")]}
    margin = result["boundaryMarginSteps"]
    n = result["n"]
    if margin < 1.0:
        return {"grade": "low", "reasons": [_r("near-boundary", "The value sits within one rank step of a class boundary.", "মানটি শ্রেণির সীমার এক ধাপের মধ্যে।")]}
    if n >= 30 and margin >= 1.5:
        return {"grade": "high", "reasons": [_r("clear-margin", f"Clear of class boundaries, {n}-year baseline.", f"শ্রেণির সীমা থেকে স্পষ্ট দূরে, {bn_num(n)} বছরের বেসলাইন।")]}
    why = []
    if n < 30:
        why.append(_r("adequate-sample", f"{n}-year baseline (adequate, not full).", f"{bn_num(n)} বছরের বেসলাইন (পর্যাপ্ত, পূর্ণ নয়)।"))
    if margin < 1.5:
        why.append(_r("modest-margin", "Between one and one-and-a-half rank steps from a class boundary.", "শ্রেণির সীমা থেকে এক থেকে দেড় ধাপ দূরে।"))
    return {"grade": "moderate", "reasons": why}


def hazard(*, applicable: bool, linked_driver: bool, has_record: bool, computable: bool = True) -> dict:
    """Support for a hazard screening: a statistically linked driver and a historical event record."""
    if not applicable or not computable:
        return {"grade": "insufficient", "reasons": [_r("not-computable", "This hazard cannot be screened here.", "এখানে এই দুর্যোগের স্ক্রিনিং সম্ভব নয়।")]}
    reasons = [
        _r("linked-driver", "A climate driver is statistically linked to past events (detrended, p < 0.05).", "জলবায়ুর একটি চালক অতীতের ঘটনার সঙ্গে পরিসংখ্যানগতভাবে যুক্ত।")
        if linked_driver
        else _r("no-linked-driver", "No statistically supported link between the driver and past events.", "চালক ও অতীতের ঘটনার মধ্যে পরিসংখ্যানগত সম্পর্ক পাওয়া যায়নি।"),
        _r("event-record", "Past events are recorded in the overlapping hazard region.", "সংলগ্ন দুর্যোগ অঞ্চলে অতীতের ঘটনা নথিভুক্ত।")
        if has_record
        else _r("no-event-record", "No event record overlaps this location.", "এই স্থানে কোনো ঘটনার রেকর্ড নেই।"),
    ]
    grade = "high" if linked_driver and has_record else "moderate" if linked_driver or has_record else "low"
    return {"grade": grade, "reasons": reasons}


def validation(verdicts: list[dict]) -> dict:
    """Number and independence of agreeing sources."""
    if not verdicts:
        return {"grade": "insufficient", "reasons": [_r("none", "No second source is available.", "দ্বিতীয় কোনো উৎস নেই।")]}
    agreeing = [v for v in verdicts if v["status"] == "agree"]
    if any(v["independence"] == "independent" for v in agreeing):
        return {"grade": "high", "reasons": [_r("independent-agrees", "An independent source agrees.", "একটি স্বাধীন উৎস একমত।")]}
    if any(v["independence"] == "same-input-family" for v in agreeing):
        return {"grade": "moderate", "reasons": [_r("same-family-agrees", "A second source agrees, but it shares input stations, so it checks processing rather than raw data.", "দ্বিতীয় উৎস একমত, তবে একই স্টেশন ব্যবহার করে, তাই এটি কাঁচা তথ্য নয়, প্রক্রিয়াকরণ যাচাই করে।")]}
    if any(v["status"] in ("disagree", "partly") for v in verdicts):
        return {"grade": "low", "reasons": [_r("sources-disagree", "The second source does not fully agree.", "দ্বিতীয় উৎস পুরোপুরি একমত নয়।")]}
    return {"grade": "low", "reasons": [_r("unavailable", "No usable second source for this location.", "এই স্থানের জন্য ব্যবহারযোগ্য দ্বিতীয় উৎস নেই।")]}


def cap(conf: dict, steps: int, code: str, en: str, bn: str) -> dict:
    """Lower a grade by `steps` (never below 'low' unless already insufficient)."""
    if conf["grade"] == "insufficient":
        return conf
    i = max(GRADES.index("low"), GRADES.index(conf["grade"]) - steps)
    return {"grade": GRADES[i], "reasons": [*conf["reasons"], _r(code, en, bn)]}


def weakest(confidences: dict[str, dict]) -> tuple[str, dict]:
    """(name, confidence) with the lowest grade; ties resolve in dict order."""
    return min(confidences.items(), key=lambda kv: GRADES.index(kv[1]["grade"]))
