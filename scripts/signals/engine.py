"""Status engine: the only place that turns numbers into a status (plan §9, step 3).

Pure functions, thresholds read from config.json. Precedence, exactly as the plan states:

    no-data > stale (real runs only) > low-coverage > baseline-small > out-of-coverage > rain status

Grey always beats any rain. Confidence is an enum of three words, never a percentage. Nothing here
knows about countries, forecasts or "safe"; the caller supplies the words.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Status = Literal["green", "yellow", "red", "grey"]
Confidence = Literal["low", "medium", "high"]
GreyReason = Literal["no-data", "stale", "low-coverage", "baseline-small", "out-of-coverage"]

# The only sentence allowed on a Green surface. Kept here so tests can assert it verbatim.
GREEN_TEXT_EN = "No unusual signal in our data. Always follow official warnings."
GREEN_TEXT_BN = "আমাদের তথ্যে অস্বাভাবিক কোনো সংকেত নেই। সর্বদা সরকারি সতর্কবার্তা মেনে চলুন।"


@dataclass(frozen=True)
class WindowReading:
    """Everything the engine needs about one window (day1/day3/day7)."""

    days: int
    rain_mm: float | None
    percentile: float | None
    ratio: float | None
    sample_count: int
    year_count: int
    valid_fraction: float = 1.0


@dataclass(frozen=True)
class Verdict:
    status: Status
    confidence: Confidence
    reason: str  # machine key: "ratio" | "percentile" | "dry" | grey reason
    window_days: int | None = None

    @property
    def is_grey(self) -> bool:
        return self.status == "grey"


def _rain_status(window: WindowReading, config: dict) -> Status:
    red, yellow = config["red"], config["yellow"]
    pct = window.percentile
    if pct is None or window.rain_mm is None:
        return "green"
    rain = window.rain_mm

    def passes(rule: dict) -> bool:
        ratio_ok = window.ratio is None or window.ratio >= rule["ratio"]
        return pct >= rule["percentile"] and ratio_ok and rain >= rule["mm"]

    if passes(red):
        return "red"
    if passes(yellow):
        return "yellow"
    return "green"


def _confidence(window: WindowReading, config: dict, status: Status) -> Confidence:
    """Low / Medium / High from data completeness, baseline depth and ratio availability."""
    if status == "green":
        return "low"
    ratio_missing = window.ratio is None
    if ratio_missing or window.sample_count < config["baselineCountMin"] * 2 or window.year_count < config["baselineYearsMin"] + 3:
        return "low"
    if window.percentile is not None and window.percentile >= config["red"]["percentile"] and window.sample_count >= config["baselineCountMin"] * 4:
        return "high"
    return "medium"


def evaluate(
    windows: list[WindowReading],
    config: dict,
    *,
    outside_coverage: bool = False,
    stale: bool = False,
    basis: str = "real",
) -> Verdict:
    """Status for one cell. `stale` is only meaningful for real runs; sample runs never age."""
    if not windows:
        return Verdict("grey", "low", "no-data")
    if stale and basis == "real":
        return Verdict("grey", "low", "stale")
    if any(w.valid_fraction < config["minValidFraction"] for w in windows):
        return Verdict("grey", "low", "low-coverage")
    if all(w.sample_count < config["baselineCountMin"] or w.year_count < config["baselineYearsMin"] for w in windows):
        return Verdict("grey", "low", "baseline-small")
    if outside_coverage:
        return Verdict("grey", "low", "out-of-coverage")

    best: tuple[Status, WindowReading] | None = None
    rank = {"green": 0, "yellow": 1, "red": 2}
    for window in windows:
        status = _rain_status(window, config)
        if best is None or rank[status] > rank[best[0]]:
            best = (status, window)
    assert best is not None
    status, window = best
    reason = "ratio" if window.ratio is not None else "percentile"
    if status == "green" and (window.rain_mm or 0) < config["wetDayMinMm"]:
        reason = "dry"
    return Verdict(status, _confidence(window, config, status), reason, window.days if status != "green" else None)


def reason_text(verdict: Verdict, windows: list[WindowReading]) -> str:
    """The one-line reason shown next to a status, e.g. '3-day rain 2.6x normal for this date'."""
    if verdict.status == "grey":
        return GREY_REASONS[verdict.reason]
    chosen = next((w for w in windows if w.days == verdict.window_days), windows[0])
    if chosen.rain_mm is None:
        return "No reading for this place yet."
    # Always one decimal, matching the Why box, so the same reading never shows two values.
    mm = f"{chosen.rain_mm:.1f} mm"
    if chosen.ratio is not None:
        return f"{chosen.days}-day rain {chosen.ratio:.1f}x normal for this date ({mm})"
    return f"{chosen.days}-day rain {mm}; unusually wet for this date"


GREY_REASONS = {
    "no-data": "No satellite data for this place yet.",
    "stale": "Data too old.",
    "low-coverage": "Too few valid satellite cells in this area.",
    "baseline-small": "Not enough past years to compare with.",
    "out-of-coverage": "Outside the area this tool covers.",
}
