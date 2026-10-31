"""Validation verdicts with explicit independence (validation-v1).

Every verdict is {check, status, sources, independence, limitations{En,Bn}, ...}. Nothing is
tagged "independent" unless the two records share no inputs. In this project no pair qualifies:
GISTEMP and CRU TS both draw on GHCN-family stations, and GPCP monthly contains GPCP 1DD.
"""

from __future__ import annotations

from .periods import bn_num

SOURCE_LINEAGE = [
    {
        "pair": ["GISTEMP v4", "CRU TS 4.10"],
        "independence": "same-input-family",
        "why": "Both are built largely from GHCN-family land stations; agreement checks processing (homogenisation, gridding), not the raw observations.",
    },
    {
        "pair": ["GPCP v2.3 monthly", "GPCP 1DD v1.3"],
        "independence": "consistency-check",
        "why": "GPCP monthly is an input to GPCP 1DD (the daily product is scaled to the monthly totals); agreement is internal consistency, never validation.",
    },
    {
        "pair": ["GPCP v2.3 monthly", "CRU TS 4.10 precipitation"],
        "independence": "same-input-family",
        "why": "GPCP's gauge component (GPCC) and CRU TS share many national rain gauges.",
    },
    {
        "pair": ["GPCP v2.3 monthly", "national met-service rainfall (IMD, BMD, PMD, DHM, NCHM, DoM)"],
        "independence": "independent",
        "why": "Would be the independent rainfall check, but these records are not available offline; no claim is made.",
    },
]


def _trend_overlap(a: dict, b: dict) -> bool:
    return a["lowerPerDecade"] <= b["upperPerDecade"] and b["lowerPerDecade"] <= a["upperPerDecade"]


def trend_consistency(variable: str, ours: dict | None, cru: dict | None, unit: str) -> dict:
    """Compare our regional trend with CRU TS over the same years and region."""
    sources = ["GISTEMP v4" if variable == "temperature" else "GPCP v2.3 monthly", "CRU TS 4.10"]
    base = {
        "check": f"{variable}-trend-vs-cru",
        "sources": sources,
        "independence": "same-input-family",
        "limitationsEn": "Compares 1981–2025 trends, not this period's anomaly (CRU values for the latest period are not in the committed record). Both records share station inputs.",
        "limitationsBn": "এটি ১৯৮১–২০২৫ সালের প্রবণতা তুলনা করে, এই সময়ের অস্বাভাবিকতা নয়। দুই রেকর্ড একই স্টেশনের তথ্য ব্যবহার করে।",
    }
    if not ours or not cru:
        return {**base, "status": "unavailable", "detailEn": "No CRU comparison exists for this area.", "detailBn": "এই এলাকার জন্য CRU তুলনা নেই।"}
    same_sign = (ours["slopePerDecade"] > 0) == (cru["slopePerDecade"] > 0)
    overlap = _trend_overlap(ours, cru)
    status = "agree" if same_sign and overlap else "partly" if same_sign or overlap else "disagree"
    d = 2 if variable == "temperature" else 0
    en = (f"Ours {ours['slopePerDecade']:+.{d}f} {unit}/decade (95% CI {ours['lowerPerDecade']:+.{d}f} to {ours['upperPerDecade']:+.{d}f}); "
          f"CRU {cru['slopePerDecade']:+.{d}f} ({cru['lowerPerDecade']:+.{d}f} to {cru['upperPerDecade']:+.{d}f}).")
    ours_s = f"{ours['slopePerDecade']:+.{d}f}"
    cru_s = f"{cru['slopePerDecade']:+.{d}f}"
    bn = f"আমাদের {bn_num(ours_s)} {unit}/দশক; CRU {bn_num(cru_s)} {unit}/দশক।"
    return {**base, "status": status, "detailEn": en, "detailBn": bn,
            "sameSign": same_sign, "intervalsOverlap": overlap}


def rainfall_provenance() -> dict:
    return {
        "check": "rainfall-gpcp-monthly-vs-daily",
        "status": "unavailable",
        "sources": ["GPCP v2.3 monthly", "GPCP 1DD v1.3"],
        "independence": "consistency-check",
        "countsAsValidation": False,
        "detailEn": "The daily product is scaled to the monthly one, so their agreement is a consistency check and is never counted as validation.",
        "detailBn": "দৈনিক তথ্য মাসিক তথ্যের সঙ্গে মেলানো হয়, তাই এদের মিল কেবল সামঞ্জস্য যাচাই, যাচাইকরণ নয়।",
        "limitationsEn": "Consistency, not independence.",
        "limitationsBn": "সামঞ্জস্য, স্বাধীনতা নয়।",
    }


def rainfall_direction() -> dict:
    return {
        "check": "rainfall-direction-vs-met-service",
        "status": "unavailable",
        "sources": ["GPCP v2.3 monthly", "national met-service rainfall"],
        "independence": "independent",
        "detailEn": "Needs station rainfall from IMD, BMD, PMD, DHM Nepal, NCHM Bhutan or the Sri Lanka Department of Meteorology for the same area and period. Not available offline, so no claim is made.",
        "detailBn": "একই এলাকা ও সময়ের জন্য জাতীয় আবহাওয়া দপ্তরের স্টেশনের বৃষ্টির তথ্য দরকার। অফলাইনে নেই, তাই কোনো দাবি করা হয় না।",
        "limitationsEn": "Required source documented; not performed.",
        "limitationsBn": "প্রয়োজনীয় উৎস উল্লেখ করা হয়েছে; যাচাই করা হয়নি।",
    }


def counted(verdicts: list[dict]) -> list[dict]:
    """Verdicts that may count toward the validation confidence."""
    return [v for v in verdicts if v.get("countsAsValidation", True) and v["status"] != "unavailable"]
