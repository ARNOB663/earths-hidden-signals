"""Replay and accuracy data (plan §7, step 6).

No numbers are invented. Until real IMERG replays exist, every event is written as
`status: "pending-real-data"` and the /accuracy page says "not enough events yet". The backtest
counts come from the same committed files, so the page cannot drift from the data.
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "web" / "public" / "data" / "signals"

# Verified by GDACS SEARCH on 2026-11-03 (spike_report.md §11). Events are identified by GDACS id
# and coordinates only: no place or country names live in this tree (plan §3.1). Display names
# come from the official GDACS record at read time. Tuning events are <= 2010-09-30.
EVENTS = [
    {"id": "gdacs-4215-2014-12-20", "gdacsId": 4215, "lat": 7.909, "lon": 80.983, "start": "2014-12-20", "tile": "bengal", "split": "reporting"},
    {"id": "gdacs-1000226-2019-03-04", "gdacsId": 1000226, "lat": -15.38, "lon": 35.122, "start": "2019-03-04", "tile": None, "split": "reporting"},
    {"id": "gdacs-1000220-2019-01-25", "gdacsId": 1000220, "lat": -20.135, "lon": -44.173, "start": "2019-01-25", "tile": None, "split": "reporting"},
]


def accuracy(config: dict) -> dict:
    """Counts per plan §7. Unknown until real replays exist; never zero-filled to look good."""
    replays = []
    for event in EVENTS:
        path = OUT / "replay" / f"{event['id']}.json"
        if path.exists():
            replays.append(json.loads(path.read_text()))
    reporting = [e for e in EVENTS if e["split"] == "reporting"]
    measured = [r for r in replays if r.get("status") == "ok"]

    def count(key: str) -> int | None:
        if len(measured) < len(reporting):
            return None
        return sum(1 for r in measured if r.get(key))

    payload = {
        "label": "Historical replay, not live",
        "events": EVENT_ROWS(replays),
        "reportingEvents": len(reporting),
        "measuredEvents": len(measured),
        "hits": count("hit"),
        "misses": count("miss"),
        "unmatched": count("unmatched"),
        "satelliteConfirmed": count("satelliteConfirmed"),
        "notEnough": len(measured) < len(reporting),
        "notEnoughText": "Not enough events yet.",
        "unmatchedText": "Signals with no catalogued event (upper bound; flood catalogues are incomplete).",
        "product": config["baseline"]["product"],
        "radiusKm": config["eventRadiusKm"],
        "leadDays": config["hitLeadDays"],
    }
    target = OUT / "accuracy.json"
    target.write_text(json.dumps(payload, indent=1, sort_keys=True), encoding="utf-8")
    return payload


def EVENT_ROWS(replays: list[dict]) -> list[dict]:
    by_id = {r["id"]: r for r in replays}
    rows = []
    for event in EVENTS:
        replay = by_id.get(event["id"], {})
        rows.append(
            {
                "id": event["id"],
                "gdacsId": event["gdacsId"],
                "lat": event["lat"],
                "lon": event["lon"],
                "start": event["start"],
                "status": replay.get("status", "pending-real-data"),
                "hit": replay.get("hit"),
                "inCoverage": event["tile"] is not None,
            }
        )
    return rows
