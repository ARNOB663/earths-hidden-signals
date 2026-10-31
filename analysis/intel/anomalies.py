"""Classify one observation against the same calendar period in a baseline (class-v1).

Percentile is the primary classifier and sets the direction; z is supplementary and only
raises the class when it points the same way. Thresholds come from thresholds.py only.
"""

from __future__ import annotations

import math

import numpy as np

from .thresholds import CLASS_RULES, MIN_BASELINE_VALUES, NORMAL_RULE


def percentile_position(value: float, baseline: np.ndarray) -> tuple[float, int, int, int]:
    """Mid-rank plotting position of `value` within `baseline`.

    Returns (P in 0..100, values below, ties, n). P = 100 (k + t/2 + 1/2) / (n + 1), so a value above
    the whole baseline sits at 100 (n + 1/2) / (n + 1) (98.4 for n = 30), never at an impossible 100.
    """
    b = np.asarray(baseline, dtype=float)
    n = int(b.size)
    k = int((b < value).sum())
    t = int((b == value).sum())
    return 100.0 * (k + t / 2 + 0.5) / (n + 1), k, t, n


def classify(value: float | None, baseline: np.ndarray | list, *, min_values: int = MIN_BASELINE_VALUES) -> dict:
    """Classify `value` against `baseline` (values of the same calendar period, NaN for missing years).

    Always returns a dict with `available`; when False, `reason` says why and no class is given.
    """
    b = np.asarray(baseline, dtype=float)
    b = b[np.isfinite(b)]
    if value is None or not math.isfinite(value):
        return {"available": False, "reason": "no-current-value", "n": int(b.size)}
    if b.size < min_values:
        return {"available": False, "reason": "baseline-too-short", "n": int(b.size)}

    pct, k, t, n = percentile_position(value, b)
    mean = float(b.mean())
    sd = float(b.std(ddof=1))
    z = None if sd == 0 else (value - mean) / sd
    high = pct >= 50.0
    pct_out = pct if high else 100.0 - pct  # distance into the tail on the observation's side
    z_side = None if z is None else (z if high else -z)  # only counts when it points the same way

    cls, level, trigger = NORMAL_RULE["class"], 0, None
    for rule in CLASS_RULES:
        by_pct = pct_out > rule["pctOutside"]
        by_z = z_side is not None and z_side >= rule["z"]
        if by_pct or by_z:
            cls = rule["high"] if high else rule["low"]
            level = rule["level"]
            trigger = "percentile" if by_pct else "z"
            break

    # Distance to the nearest percentile class boundary, in units of one rank step (100/(n+1)).
    step = 100.0 / (n + 1)
    boundaries = [10.0, 90.0, 5.0, 95.0, 1.0, 99.0]
    margin_steps = min(abs(pct - bnd) for bnd in boundaries) / step

    return {
        "available": True,
        "value": float(value),
        "n": n,
        "mean": mean,
        "sd": sd,
        "percentile": pct,
        "below": k,
        "ties": t,
        "rankHigh": int((b > value).sum()) + 1,  # 1 = highest among baseline + this value
        "zScore": z,
        "difference": float(value - mean),
        "class": cls,
        "direction": "high" if high else "low",
        "level": level,
        "trigger": trigger,
        "boundaryMarginSteps": margin_steps,
    }


def signed_level(result: dict) -> int:
    """+level for high, -level for low, 0 for normal or unavailable."""
    if not result.get("available") or result["level"] == 0:
        return 0
    return result["level"] if result["direction"] == "high" else -result["level"]


def duration(signed_levels: list[int]) -> int:
    """Consecutive most-recent entries with a non-zero level of the same sign as the last one."""
    if not signed_levels or signed_levels[-1] == 0:
        return 0
    sign = 1 if signed_levels[-1] > 0 else -1
    count = 0
    for s in reversed(signed_levels):
        if s * sign > 0:
            count += 1
        else:
            break
    return count
