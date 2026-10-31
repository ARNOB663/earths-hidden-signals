"""City list and Bangla names, read from the web app's own source so the two never drift.

web/src/lib/places.ts lists the well-known places (P("Dhaka", "Bangladesh", 23.81, 90.41) ...);
web/src/lib/names.ts holds the Bangla names. Both are plain literal tables, parsed here.
"""

from __future__ import annotations

import re
from pathlib import Path

WEB_LIB = Path(__file__).resolve().parents[2] / "web" / "src" / "lib"

_PLACE = re.compile(r'P\("([^"]+)",\s*"([^"]+)",\s*(-?[\d.]+),\s*(-?[\d.]+)(?:,\s*"([^"]+)")?\)')
_ENTRY = re.compile(r'^\s*(?:"([^"]+)"|([A-Za-z][\w-]*)):\s*"([^"]+)",?\s*$')


def _slug(name: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


def cities() -> list[dict]:
    text = (WEB_LIB / "places.ts").read_text(encoding="utf-8")
    out = []
    for name, country, lat, lon, explicit in _PLACE.findall(text):
        out.append({"id": explicit or _slug(name), "name": name, "country": country, "lat": float(lat), "lon": float(lon)})
    return out


def _table(text: str, const: str) -> dict[str, str]:
    start = text.index(f"export const {const}")
    body = text[start: text.index("\n};", start)]
    out = {}
    for line in body.splitlines()[1:]:
        m = _ENTRY.match(line)
        if m:
            out[m.group(1) or m.group(2)] = m.group(3)
    return out


def bangla() -> dict[str, dict[str, str]]:
    text = (WEB_LIB / "names.ts").read_text(encoding="utf-8")
    zones_block = text[text.index("export const ZONE_BN"): text.index("export const zoneNameBn")]
    zones = dict(re.findall(r'"?([a-z-]+)"?:\s*\{\s*name:\s*"([^"]+)"', zones_block))
    return {"places": _table(text, "PLACE_BN"), "countries": _table(text, "COUNTRY_BN"), "zones": zones}
