"""Composite rainfall assessment (composite-v1): one class from several rainfall components.

Each component is classified with anomalies.classify. A component's high side is either 'wet'
(rain total, heavy-rain days, wettest day) or 'dry' (dry days, dry-spell length). The rainfall
total anchors the result; see thresholds.COMPOSITE_RULE, which /methods publishes verbatim.
"""

from __future__ import annotations

from .thresholds import CLASS_RULES, COMPOSITE_ID

_LEVEL_CLASS = {r["level"]: (r["high"], r["low"]) for r in CLASS_RULES}


def component_side(result: dict, high_side: str) -> str | None:
    """'wet', 'dry' or None (normal / unavailable) for one classified component."""
    if not result.get("available") or result["level"] == 0:
        return None
    if result["direction"] == "high":
        return high_side
    return "dry" if high_side == "wet" else "wet"


def combine(components: list[dict]) -> dict:
    """components: [{id, result, highSide: 'wet'|'dry', counted: bool}], with the anchor id 'total'.

    Returns {available, class, level, side, direction, conflicting, dominantComponent, corroboratedBy, ...}.
    """
    usable = [c for c in components if c["counted"] and c["result"].get("available")]
    base = {"compositeId": COMPOSITE_ID, "countedComponents": [c["id"] for c in usable], "usable": len(usable),
            "corroboratedBy": []}
    total = next((c for c in usable if c["id"] == "total"), None)
    if total is None:
        return {**base, "available": False, "reason": "no-rainfall-total", "class": None, "level": 0,
                "side": None, "direction": None, "conflicting": False, "dominantComponent": None}
    side = component_side(total["result"], "wet")
    if side is None:
        return {**base, "available": True, "class": "normal", "level": 0, "side": None, "direction": None,
                "conflicting": False, "dominantComponent": None}

    others = [(c["id"], component_side(c["result"], c["highSide"]), c["result"]["level"]) for c in usable if c is not total]
    if any(s and s != side for _, s, _ in others):
        return {**base, "available": True, "class": "normal", "level": 0, "side": None, "direction": None,
                "conflicting": True, "dominantComponent": "total",
                "conflictWith": [cid for cid, s, _ in others if s and s != side]}

    support = [cid for cid, s, _ in others if s == side]
    level = total["result"]["level"] if support else min(total["result"]["level"], 2)
    high_cls, low_cls = _LEVEL_CLASS[level]
    return {
        **base,
        "available": True,
        "class": high_cls if side == "wet" else low_cls,
        "level": level,
        "side": side,
        "direction": "high" if side == "wet" else "low",
        "conflicting": False,
        "dominantComponent": "total",
        "corroboratedBy": support,
    }
