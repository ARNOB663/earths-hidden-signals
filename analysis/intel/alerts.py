"""Screening rules and alert lifecycle (alert-v1).

`screen` applies the rules to one assessed (year, period). `lifecycle` turns a chronological
run of screenings for one (location, hazard) into alerts: re-detection extends the open alert,
a change of severity closes it (superseded or eased) and opens a new one, and a quiet period
expires it. The (location, hazard) key guarantees no duplicate alerts.

Internal alerts are screening indicators and always say so. Official alerts (GDACS) are built
separately by official_alerts and are never mixed into the internal severity scale.
"""

from __future__ import annotations

from typing import Callable

from .periods import bn_num, label
from .thresholds import ALERTS_ID, INTERNAL_ALERT_PREFIX_BN, INTERNAL_ALERT_PREFIX_EN, SEVERITY_RANK, THRESHOLDS_ID

Lookup = Callable[[str, str, int], dict]

HAZARD_PERIOD = {"heat": None, "dry": "monsoon", "flood": "monsoon", "landslide": "monsoon",
                 "wildfire": "pre-monsoon", "cyclone": "annual"}
HAZARD_EN = {"heat": "Heat", "dry": "Dry conditions", "flood": "Flood", "landslide": "Landslide",
             "wildfire": "Wildfire", "cyclone": "Cyclone"}
HAZARD_BN = {"heat": "তাপ", "dry": "শুষ্ক অবস্থা", "flood": "বন্যা", "landslide": "ভূমিধস",
             "wildfire": "দাবানল", "cyclone": "ঘূর্ণিঝড়"}
SEVERITY_EN = {"info": "info", "watch": "watch", "warning": "warning"}
SEVERITY_BN = {"info": "তথ্য", "watch": "নজরদারি", "warning": "সতর্কতা"}


def _ev(var: str, period: str, year: int, r: dict) -> dict:
    return {
        "variable": var, "period": period, "year": year,
        "percentile": None if not r.get("available") else round(r["percentile"], 1),
        "class": r.get("class"), "n": r.get("n"),
    }


def _high(r: dict, level: int) -> bool:
    return bool(r.get("available")) and r["direction"] == "high" and r["level"] >= level


def _low(r: dict, level: int) -> bool:
    return bool(r.get("available")) and r["direction"] == "low" and r["level"] >= level


def _pct(r: dict) -> float | None:
    return r["percentile"] if r.get("available") else None


def heat(get: Lookup, year: int, period: str, previous: tuple[int, str] | None) -> dict:
    r = get("temperature", period, year)
    sev = None
    if _high(r, 3):
        sev = "warning"
    elif _high(r, 2):
        prev = get("temperature", previous[1], previous[0]) if previous else {}
        sev = "warning" if _high(prev, 2) else "watch"
    return {"severity": sev, "evidence": [_ev("temperature", period, year, r)]}


def dry_condition(get: Lookup, year: int) -> tuple[bool, list[dict]]:
    rain = get("rainfall", "monsoon", year)
    spell = get("dry-spell", "annual", year)  # longest Jun-Sep dry run, published as an annual series
    p = _pct(rain)
    ok = p is not None and p <= 10.0 and _high(spell, 2)
    return ok, [_ev("rainfall", "monsoon", year, rain), _ev("dry-spell", "annual", year, spell)]


def dry(get: Lookup, year: int) -> dict:
    ok, evidence = dry_condition(get, year)
    if not ok:
        return {"severity": None, "evidence": evidence}
    before, _ = dry_condition(get, year - 1)
    return {"severity": "warning" if before else "watch", "evidence": evidence}


def wet(get: Lookup, year: int) -> dict:
    rain = get("rainfall", "monsoon", year)
    heavy = get("heavy-rain", "annual", year)
    p = _pct(rain)
    evidence = [_ev("rainfall", "monsoon", year, rain), _ev("heavy-rain", "annual", year, heavy)]
    if p is None or p < 90.0:
        return {"severity": None, "evidence": evidence}
    if p >= 95.0 and _high(heavy, 2):
        return {"severity": "warning", "evidence": evidence}
    return {"severity": "watch", "evidence": evidence}


def wildfire(get: Lookup, year: int, linked: bool | None) -> dict:
    """linked=None means 'do not apply the link requirement' (used by the backtest, where the
    link itself is estimated from the full record and applying it would leak)."""
    t = get("temperature", "pre-monsoon", year)
    r = get("rainfall", "pre-monsoon", year)
    evidence = [_ev("temperature", "pre-monsoon", year, t), _ev("rainfall", "pre-monsoon", year, r)]
    if linked is False:
        return {"severity": None, "evidence": evidence, "note": "no-linked-driver"}
    hits = int(_high(t, 1)) + int(_low(r, 1))
    return {"severity": "watch" if hits == 2 else "info" if hits == 1 else None, "evidence": evidence}


def cyclone(driver: dict | None, year: int) -> dict:
    """Uses the basin sea-warmth driver from hazards/zones.json (latest year only)."""
    if not driver or driver["latest"]["year"] != year:
        return {"severity": None, "evidence": [], "note": "no-driver-value"}
    evidence = [{"variable": "sea-warmth", "period": "annual", "year": year,
                 "percentile": driver["latest"]["percentile"], "class": None, "n": None}]
    if not driver["linked"]:
        return {"severity": None, "evidence": evidence, "note": "no-linked-driver"}
    typical = driver.get("highEventYearsPercentile")
    sev = "watch" if typical is not None and driver["latest"]["percentile"] >= typical else None
    return {"severity": sev, "evidence": evidence}


def describe(hazard: str, severity: str, name_en: str, name_bn: str, year: int, period: str, evidence: list[dict]) -> tuple[str, str]:
    """Alert text. Internal alerts always begin with the screening disclaimer."""
    first = evidence[0] if evidence else None
    pct_en = f" (P≈{first['percentile']:.0f} of {first['n']} baseline years)" if first and first.get("percentile") is not None and first.get("n") else ""
    pct_bn = f" (P≈{bn_num(round(first['percentile']))}, {bn_num(first['n'])} বছরের বেসলাইন)" if pct_en else ""
    en = (f"{INTERNAL_ALERT_PREFIX_EN} {HAZARD_EN[hazard]} {SEVERITY_EN[severity]} for {name_en}, "
          f"based on {label(period, year)}{pct_en}.")
    bn = (f"{INTERNAL_ALERT_PREFIX_BN} {name_bn}-এর জন্য {HAZARD_BN[hazard]} {SEVERITY_BN[severity]}, "
          f"{label(period, year, 'bn')}-এর ভিত্তিতে{pct_bn}।")
    return en, bn


def lifecycle(location_id: str, hazard: str, steps: list[dict], latest: tuple[int, str], names: tuple[str, str]) -> list[dict]:
    """steps: chronological [{year, period, severity, evidence}] for one (location, hazard)."""
    alerts: list[dict] = []
    current: dict | None = None

    def close(alert: dict, at: dict, reason: str, by: str | None = None) -> None:
        alert["status"] = "closed"
        alert["closedReason"] = reason
        alert["closedAt"] = f"{at['year']}-{at['period']}"
        alert["supersededBy"] = by

    for s in steps:
        key = f"{s['year']}-{s['period']}"
        sev = s["severity"]
        if sev and current and current["severity"] == sev:
            current["lastSeenPeriod"] = key
            current["occurrences"].append(key)
            current["evidence"] = s["evidence"]
            continue
        new = None
        if sev:
            en, bn = describe(hazard, sev, names[0], names[1], s["year"], s["period"], s["evidence"])
            new = {
                "id": f"{location_id}:{hazard}:{key}:{sev}",
                "kind": "internal",
                "official": False,
                "locationId": location_id,
                "hazard": hazard,
                "severity": sev,
                "status": "active",
                "firstPeriod": key,
                "lastSeenPeriod": key,
                "occurrences": [key],
                "closedAt": None,
                "closedReason": None,
                "supersededBy": None,
                "textEn": en,
                "textBn": bn,
                "evidence": s["evidence"],
                "thresholdsId": THRESHOLDS_ID,
                "alertsId": ALERTS_ID,
            }
        if current:
            if new:
                reason = "superseded" if SEVERITY_RANK[new["severity"]] > SEVERITY_RANK[current["severity"]] else "eased"
                close(current, s, reason, new["id"])
            else:
                close(current, s, "expired")
        if new:
            alerts.append(new)
        current = new

    latest_key = f"{latest[0]}-{latest[1]}"
    for a in alerts:
        a["reconstructed"] = not (a["status"] == "active" or a["closedAt"] == latest_key)
        if a["reconstructed"]:
            a["noteEn"] = "Historical replay: this alert would have triggered under alert-v1; it was never issued."
            a["noteBn"] = "ঐতিহাসিক পুনরাবৃত্তি: alert-v1 নিয়মে এই সতর্কতা তৈরি হতো; এটি কখনো জারি করা হয়নি।"
    return alerts


def official_alerts(location_id: str, floods: list[dict], inside: Callable[[float, float], bool], since: str, until: str) -> list[dict]:
    """GDACS flood records for the location in [since, until]. Attributed, official, never re-scaled."""
    out = []
    for e in floods:
        if not (since <= e["date"] <= until) or not inside(e["lat"], e["lon"]):
            continue
        out.append({
            "id": f"gdacs:{e['date']}:{e['lat']:.3f}:{e['lon']:.3f}",
            "kind": "official",
            "official": True,
            "provider": "GDACS (UN/EU Global Disaster Alert and Coordination System)",
            "providerUrl": "https://www.gdacs.org/",
            "eventId": None,
            "eventIdNote": "The GDACS event id is not kept in the committed flood record.",
            "hazard": "flood",
            "alertLevel": e.get("alert") or None,
            "date": e["date"],
            "end": e.get("end") or None,
            "title": e.get("title"),
            "country": e.get("country"),
            "locationId": location_id,
            "textEn": f"Official GDACS {e.get('alert') or ''} flood alert: {e.get('title')}, from {e['date']}.".replace("  ", " "),
            "textBn": f"GDACS-এর আনুষ্ঠানিক বন্যা সতর্কতা ({e.get('alert') or ''}): {e.get('title')}, {bn_num(e['date'])} থেকে।",
        })
    return out
