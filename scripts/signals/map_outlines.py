"""Complete the Signal map outlines with the ADM1 parent of every listed area.

`place.py` writes one ring per listed boundary into its own country file. A district whose parent
state has no listing of its own therefore has no shape the map can draw, and a district lying
inside no drawn state reads as a hole in the map. This step adds the missing ADM1 rings from the
same cached geoBoundaries geometry and the same simplifier, so no new data source enters the tree.

It reads committed files and the cached geometry only, and rewrites the same
``signals/places-map/{ISO}.json`` files deterministically:

    analysis/.venv/bin/python scripts/signals/map_outlines.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import place  # noqa: E402

OUT = place.SIGNALS / "places-map"


def _names(iso: str) -> dict[str, str]:
    path = place.GEO / "admin" / f"{iso}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    names: dict[str, str] = {}
    for level in data["levels"].values():
        for unit in level.get("units") or []:
            if unit.get("id") and unit.get("name"):
                names[unit["id"]] = unit["name"]
    return names


def build() -> list[str]:
    """Add every missing ADM1 ring to each country file. Returns the ids added."""
    places = json.loads((place.SIGNALS / "places.json").read_text(encoding="utf-8"))
    centres = {area["id"]: area["centre"] for area in places["areas"]}
    added: list[str] = []
    for path in sorted(OUT.glob("*.json")):
        if path.name == "index.json":
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        iso = path.stem
        have = {area["id"] for area in payload["areas"]}
        names = _names(iso)
        missing = []
        for area_id, geometry in place.load_geometry(iso, "ADM1"):
            if area_id in have or area_id not in centres:
                continue
            rings = place._outline(geometry)
            if not rings:
                continue
            missing.append(
                {
                    "id": area_id,
                    "name": names.get(area_id, area_id),
                    "level": "ADM1",
                    "trust": "low",
                    "centre": centres[area_id],
                    "rings": rings,
                }
            )
        if not missing:
            continue
        payload["areas"].extend(missing)
        payload["areas"].sort(key=lambda area: (area["level"], area["id"]))
        path.write_text(json.dumps(payload, separators=(",", ":"), sort_keys=True), encoding="utf-8")
        added.extend(area["id"] for area in missing)
    return added


if __name__ == "__main__":
    print("added", len(build()))
