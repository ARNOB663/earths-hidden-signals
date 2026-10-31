"""Load the committed pipeline outputs the intelligence engine runs on, with content hashes.

Offline by design: these files are in git, so CI can re-run the engine and require
byte-identical output. A --refresh run adds monthly series (monthly.py) on top.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "web" / "public" / "data"
OUT = DATA / "intelligence"

FILES = {
    "manifest": "trends/manifest.json",
    "placeSignals": "maps/place-signals.json",
    "trendZones": "trends/zones.json",
    "hazardZones": "hazards/zones.json",
    "floods": "hazards/floods.json",
    "crosscheck": "trends/crosscheck.json",
    "latest": "latest.json",
}
CELL_KEYS = ["temperature_annual", "temperature_pre-monsoon", "temperature_monsoon",
             "rainfall_annual", "rainfall_pre-monsoon", "rainfall_monsoon",
             "hot-months_annual", "heavy-rain_annual", "dry-spell_annual", "wettest-day_annual"]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load() -> dict:
    data = {name: json.loads((DATA / rel).read_text(encoding="utf-8")) for name, rel in FILES.items()}
    data["cells"] = {k: json.loads((DATA / "trends" / f"{k}_series.json").read_text(encoding="utf-8")) for k in CELL_KEYS}
    monthly = OUT / "inputs" / "monthly.json"
    data["monthly"] = json.loads(monthly.read_text(encoding="utf-8")) if monthly.exists() else None
    hashes = {rel: sha256(DATA / rel) for rel in FILES.values()}
    hashes.update({f"trends/{k}_series.json": sha256(DATA / "trends" / f"{k}_series.json") for k in CELL_KEYS})
    if monthly.exists():
        hashes["intelligence/inputs/monthly.json"] = sha256(monthly)
    data["hashes"] = dict(sorted(hashes.items()))
    data["inputsHash"] = hashlib.sha256(json.dumps(data["hashes"], sort_keys=True).encode()).hexdigest()
    return data


def code_hash() -> str:
    """Hash of the engine's own source, so a code change gives a new pipeline run id."""
    h = hashlib.sha256()
    for f in sorted(Path(__file__).parent.glob("*.py")):
        h.update(f.name.encode() + f.read_bytes())
    h.update((Path(__file__).parents[1] / "intelligence.py").read_bytes())
    return h.hexdigest()[:16]


def short_hash(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:16]
