"""What to watch: a rise is a place whose status went up since the previous archive entry.

The comparison is against the last committed archive day only — never against a within-day change,
and never against the current reading twice. When there is one entry, or nothing rose, the page
says "no rise recorded yet" and shows no substitute numbers.
"""

from __future__ import annotations

import json
from pathlib import Path

RANK = {"grey": 0, "green": 1, "yellow": 2, "red": 3}


def read_archive(folder: Path) -> list[dict]:
    """All archive entries, oldest first."""
    if not folder.exists():
        return []
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(folder.glob("*.json"))]


def rises(entries: list[dict]) -> list[dict]:
    """Cells that rose from the previous entry to the latest one. Empty with fewer than two."""
    if len(entries) < 2:
        return []
    before, after = entries[-2], entries[-1]
    if after.get("sample") or before.get("sample"):
        return []
    was = {(r["lat"], r["lon"]): r["status"] for r in before.get("rises", [])}
    out = []
    for row in after.get("rises", []):
        previous = was.get((row["lat"], row["lon"]))
        if previous is None or RANK.get(row["status"], 0) <= RANK.get(previous, 0):
            continue
        out.append({**row, "from": previous})
    out.sort(key=lambda r: (-RANK[r["status"]], r["date"]))
    return out


def summary(entries: list[dict]) -> dict:
    return {
        "entries": len(entries),
        "latest": entries[-1].get("date") if entries else None,
        "previous": entries[-2].get("date") if len(entries) > 1 else None,
        "rises": rises(entries),
        "sample": any(e.get("sample") for e in entries),
    }
