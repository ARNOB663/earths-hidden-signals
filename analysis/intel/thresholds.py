"""Every threshold used by the intelligence engine. Nothing else defines a cut-off.

The web app never re-implements these numbers: intelligence.py publishes this module as
web/public/data/intelligence/thresholds.json and /methods renders that file.
"""

from __future__ import annotations

# --- Baselines ------------------------------------------------------------------------------

BASELINE_ID = "1991-2020"
BASELINE_YEARS = list(range(1991, 2021))  # 1991..2020 inclusive = 30 years
# GPCP 1DD starts in October 1996, so daily-derived indicators use the 24 full years 1997-2020.
DAILY_BASELINE_ID = "1997-2020"
DAILY_BASELINE_YEARS = list(range(1997, 2021))
# An anomaly is computed only with at least this many baseline values for the calendar period.
MIN_BASELINE_VALUES = 20
# Share of the location's weighted grid cells that must hold a value for the period.
MIN_COVERAGE_PCT = 50.0

# --- Classifier (class-v1) ------------------------------------------------------------------

THRESHOLDS_ID = "class-v1"
# Evaluated top-down; the first rule whose percentile OR z condition holds sets the class.
# Percentile is the primary classifier and also sets the direction (high if P >= 50).
# z = (value - baseline mean) / baseline SD only counts when it points the same way.
CLASS_RULES = [
    {"level": 3, "high": "extreme", "low": "extreme", "pctOutside": 99.0, "z": 2.0,
     "rationale": "about 99% two-sided, or 2 standard deviations"},
    {"level": 2, "high": "unusually-high", "low": "unusually-low", "pctOutside": 95.0, "z": 1.5,
     "rationale": "about 95% two-sided, or 1.5 standard deviations"},
    {"level": 1, "high": "above-normal", "low": "below-normal", "pctOutside": 90.0, "z": 1.0,
     "rationale": "outside the central 80% of the baseline, or 1 standard deviation"},
]
NORMAL_RULE = {"level": 0, "class": "normal", "rationale": "inside the central 80% of the baseline and |z| < 1"}
CLASS_LEVEL = {
    "normal": 0,
    "above-normal": 1, "below-normal": 1,
    "unusually-high": 2, "unusually-low": 2,
    "extreme": 3,
}
PERCENTILE_METHOD = (
    "Mid-rank plotting position: P = 100 x (k + t/2 + 1/2) / (n + 1), where k baseline values are "
    "below the observation and t are equal to it. With n = 30 the percentile moves in steps of "
    "about 3.2 points and cannot exceed 98.4 or fall below 1.6, so an 'extreme' class needs z >= 2."
)

# --- Composite rainfall (composite-v1) ------------------------------------------------------

COMPOSITE_ID = "composite-v1"
COMPOSITE_RULE = (
    "The period's rainfall total is the anchor: if it is normal, the composite is normal (daily "
    "components are shown, but one daily outlier cannot create a class). If the total is above or "
    "below normal, its class stands, except that 'extreme' needs at least one other counted "
    "component on the same side (otherwise it is capped at 'unusually'). If any other counted "
    "component points to the opposite side at least one class away from normal, the composite is "
    "normal and marked conflicting. Mean daily intensity (total / days) is reported but never "
    "counted: within one calendar period it is the total divided by a constant."
)

# --- Alerts (alert-v1) ----------------------------------------------------------------------

ALERTS_ID = "alert-v1"
ALERT_RULES = [
    {"hazard": "heat", "severity": "watch", "rule": "Seasonal temperature unusually high (P > 95 or z >= 1.5)."},
    {"hazard": "heat", "severity": "warning", "rule": "Seasonal temperature extreme, or unusually high in 2+ consecutive assessed seasons."},
    {"hazard": "dry", "severity": "watch", "rule": "Monsoon rainfall at or below P10 and longest monsoon dry spell unusually high."},
    {"hazard": "dry", "severity": "warning", "rule": "Dry watch conditions in two consecutive monsoons."},
    {"hazard": "flood", "severity": "watch", "rule": "Monsoon rainfall at or above P90, in a location exposed to a flood region."},
    {"hazard": "flood", "severity": "warning", "rule": "Monsoon rainfall at or above P95 and very-heavy-rain days (calendar year) unusually high."},
    {"hazard": "landslide", "severity": "watch", "rule": "Monsoon rainfall at or above P90, in a location exposed to a landslide region."},
    {"hazard": "landslide", "severity": "warning", "rule": "Monsoon rainfall at or above P95 and very-heavy-rain days (calendar year) unusually high."},
    {"hazard": "wildfire", "severity": "info", "rule": "Linked fire driver and one of: pre-monsoon temperature above normal, pre-monsoon rainfall below normal."},
    {"hazard": "wildfire", "severity": "watch", "rule": "Linked fire driver, pre-monsoon temperature above normal and pre-monsoon rainfall below normal."},
    {"hazard": "cyclone", "severity": "watch", "rule": "Linked basin sea-warmth driver at or above the percentile typical of past high-cyclone years."},
]
SEVERITY_RANK = {"info": 1, "watch": 2, "warning": 3}
INTERNAL_ALERT_PREFIX_EN = "Screening indicator, not a confirmed event."
INTERNAL_ALERT_PREFIX_BN = "স্ক্রিনিং সূচক, নিশ্চিত কোনো ঘটনা নয়।"

# --- Conclusion levels ----------------------------------------------------------------------

LEVELS = ["quiet", "notable", "elevated", "high"]
LEVEL_RULE = (
    "high: any internal warning; elevated: any watch; notable: any info alert or any indicator "
    "at least unusually high/low; quiet: none of these."
)

# --- Confidence (confidence-v1) -------------------------------------------------------------

CONFIDENCE_ID = "confidence-v1"
COVERAGE_FULL_PCT = 75.0  # 50-75% coverage counts as one degradation
LATE_DAYS_DEGRADED = 5  # more than 5 days past the expected publication lag counts as one degradation

# --- Freshness (freshness-v1) ---------------------------------------------------------------

FRESHNESS_ID = "freshness-v1"
# Typical delay between the end of an observed period and the dataset publishing it.
EXPECTED_LAG_DAYS = {
    "gistemp": 20,
    "gpcp-monthly": 90,
    "gpcp-daily": 120,
    "cru-ts": 400,
    "firms-modis": 90,
    "nasa-glc": None,  # closed catalogue, no further updates expected
    "gdacs": 2,
    "ibtracs": 30,
}
# A dataset is stale when it is this many days later than its expected lag.
STALE_AFTER_DAYS = 30

# --- Evaluation -----------------------------------------------------------------------------

EVALUATION_ID = "evaluation-v1"
# CI fails if any false-alarm rate rises more than this above the committed baseline.
FALSE_ALARM_TOLERANCE = 0.02


def published() -> dict:
    """The thresholds as data, for thresholds.json and the /methods page."""
    return {
        "schema": "thresholds-v1",
        "thresholdsId": THRESHOLDS_ID,
        "baseline": {
            "id": BASELINE_ID,
            "years": [BASELINE_YEARS[0], BASELINE_YEARS[-1]],
            "length": len(BASELINE_YEARS),
            "dailyId": DAILY_BASELINE_ID,
            "dailyYears": [DAILY_BASELINE_YEARS[0], DAILY_BASELINE_YEARS[-1]],
            "dailyLength": len(DAILY_BASELINE_YEARS),
            "minValues": MIN_BASELINE_VALUES,
            "minCoveragePct": MIN_COVERAGE_PCT,
            "comparison": "Same calendar period only: a season is compared with that season in every baseline year.",
        },
        "classes": [
            {"class": NORMAL_RULE["class"], "level": 0, "rule": "10 <= P <= 90 and |z| < 1.0", "rationale": NORMAL_RULE["rationale"]},
            *[
                {
                    "class": f"{r['low']} / {r['high']}" if r["low"] != r["high"] else r["high"],
                    "level": r["level"],
                    "rule": f"P < {100 - r['pctOutside']:g} or P > {r['pctOutside']:g}, or |z| >= {r['z']:g}",
                    "rationale": r["rationale"],
                }
                for r in reversed(CLASS_RULES)
            ],
        ],
        "percentileMethod": PERCENTILE_METHOD,
        "composite": {"id": COMPOSITE_ID, "rule": COMPOSITE_RULE},
        "alerts": {"id": ALERTS_ID, "rules": ALERT_RULES, "prefixEn": INTERNAL_ALERT_PREFIX_EN, "prefixBn": INTERNAL_ALERT_PREFIX_BN},
        "levels": {"values": LEVELS, "rule": LEVEL_RULE},
        "confidence": {
            "id": CONFIDENCE_ID,
            "coverageFullPct": COVERAGE_FULL_PCT,
            "lateDaysDegraded": LATE_DAYS_DEGRADED,
        },
        "freshness": {"id": FRESHNESS_ID, "expectedLagDays": EXPECTED_LAG_DAYS, "staleAfterDays": STALE_AFTER_DAYS},
        "evaluation": {"id": EVALUATION_ID, "falseAlarmTolerance": FALSE_ALARM_TOLERANCE},
    }
